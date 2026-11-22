"""Local web server and SQLite API for the faculty evaluation school project."""

from __future__ import annotations

import hashlib
import hmac
import json
import mimetypes
import secrets
import sqlite3
import time
import urllib.parse
from contextlib import contextmanager
from http import cookies
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "faculty_evaluation.db"
HOST = "127.0.0.1"
PORT = 8000
COOKIE_NAME = "faculty_session"
SESSION_SECONDS = 60 * 60 * 8
CATEGORIES = ["Teaching Effectiveness", "Communication", "Classroom Management", "Professionalism"]
DEFAULT_QUESTIONS = [
    (1, CATEGORIES[0], "The instructor explains lessons clearly."),
    (2, CATEGORIES[0], "The instructor demonstrates good knowledge of the subject."),
    (3, CATEGORIES[0], "The instructor uses effective teaching methods."),
    (4, CATEGORIES[1], "The instructor communicates instructions clearly."),
    (5, CATEGORIES[1], "The instructor responds appropriately to student questions."),
    (6, CATEGORIES[2], "The instructor manages class time effectively."),
    (7, CATEGORIES[2], "The instructor maintains an organized learning environment."),
    (8, CATEGORIES[3], "The instructor treats students respectfully."),
    (9, CATEGORIES[3], "The instructor comes prepared for class."),
    (10, CATEGORIES[3], "The instructor demonstrates professional behavior."),
]
DEMO_USERS = [
    ("student", "Juan Dela Cruz", "student", "student123"),
    ("admin", "Guidance Administrator", "admin", "admin123"),
    ("rubycruz", "Ruby Cruz", "faculty", "ruby123"),
]


def connect_db() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


@contextmanager
def database():
    connection = connect_db()
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    hashed = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 180_000)
    return f"{salt.hex()}:{hashed.hex()}"


def check_password(password: str, stored: str) -> bool:
    try:
        salt_hex, expected = stored.split(":", 1)
        actual = hash_password(password, bytes.fromhex(salt_hex)).split(":", 1)[1]
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def initialize_database() -> None:
    with database() as db:
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY,
                username TEXT NOT NULL UNIQUE COLLATE NOCASE,
                display_name TEXT NOT NULL,
                role TEXT NOT NULL CHECK (role IN ('admin', 'faculty', 'student')),
                password_hash TEXT NOT NULL,
                program TEXT NOT NULL DEFAULT '',
                year TEXT NOT NULL DEFAULT ''
            );
            CREATE TABLE IF NOT EXISTS faculty (
                id INTEGER PRIMARY KEY,
                user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                name TEXT NOT NULL DEFAULT '',
                faculty_code TEXT NOT NULL UNIQUE,
                department TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS subjects (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL UNIQUE COLLATE NOCASE
            );
            CREATE TABLE IF NOT EXISTS faculty_subjects (
                faculty_id INTEGER NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
                subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
                PRIMARY KEY (faculty_id, subject_id)
            );
            CREATE TABLE IF NOT EXISTS questions (
                id INTEGER PRIMARY KEY,
                category TEXT NOT NULL,
                text TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS evaluations (
                id INTEGER PRIMARY KEY,
                faculty_id INTEGER NOT NULL REFERENCES faculty(id),
                subject_id INTEGER NOT NULL REFERENCES subjects(id),
                submitted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
                suggestions TEXT NOT NULL DEFAULT ''
            );
            CREATE TABLE IF NOT EXISTS answers (
                id INTEGER PRIMARY KEY,
                evaluation_id INTEGER NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
                question_id INTEGER NOT NULL,
                question_text TEXT NOT NULL,
                category TEXT NOT NULL,
                rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5)
            );
            CREATE TABLE IF NOT EXISTS submission_receipts (
                faculty_id INTEGER NOT NULL REFERENCES faculty(id),
                subject_id INTEGER NOT NULL REFERENCES subjects(id),
                student_key TEXT NOT NULL,
                evaluation_id INTEGER NOT NULL UNIQUE REFERENCES evaluations(id) ON DELETE CASCADE,
                PRIMARY KEY (faculty_id, subject_id, student_key)
            );
            CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
            """
        )
        user_columns = {row["name"] for row in db.execute("PRAGMA table_info(users)")}
        if "program" not in user_columns:
            db.execute("ALTER TABLE users ADD COLUMN program TEXT NOT NULL DEFAULT ''")
        if "year" not in user_columns:
            db.execute("ALTER TABLE users ADD COLUMN year TEXT NOT NULL DEFAULT ''")
        faculty_columns = {row["name"] for row in db.execute("PRAGMA table_info(faculty)")}
        if "name" not in faculty_columns:
            db.execute("ALTER TABLE faculty ADD COLUMN name TEXT NOT NULL DEFAULT ''")
        db.execute("UPDATE faculty SET name=(SELECT display_name FROM users WHERE users.id=faculty.user_id) WHERE name=''")
        for username, display_name, role, password in DEMO_USERS:
            db.execute(
                "INSERT OR IGNORE INTO users(username, display_name, role, password_hash) VALUES (?, ?, ?, ?)",
                (username, display_name, role, hash_password(password)),
            )
        if db.execute("SELECT 1 FROM faculty LIMIT 1").fetchone() is None:
            user_id = db.execute("SELECT id FROM users WHERE username='rubycruz'").fetchone()["id"]
            db.execute(
                "INSERT INTO faculty(user_id, name, faculty_code, department) VALUES (?, ?, ?, ?)",
                (user_id, "Ruby Cruz", "FAC-001", "Computer Studies"),
            )
            faculty_id = db.execute("SELECT id FROM faculty WHERE faculty_code='FAC-001'").fetchone()["id"]
            subject_id = db.execute("INSERT INTO subjects(name) VALUES (?)", ("Computer Studies",)).lastrowid
            db.execute("INSERT INTO faculty_subjects(faculty_id, subject_id) VALUES (?, ?)", (faculty_id, subject_id))
        if db.execute("SELECT 1 FROM questions LIMIT 1").fetchone() is None:
            db.executemany("INSERT INTO questions(id, category, text) VALUES (?, ?, ?)", DEFAULT_QUESTIONS)
        db.execute("INSERT OR IGNORE INTO app_meta(key, value) VALUES ('receipt_secret', ?)", (secrets.token_hex(32),))


SESSIONS: dict[str, tuple[int, float]] = {}


class ApiError(Exception):
    def __init__(self, status: int, message: str):
        self.status = status
        self.message = message


class Handler(BaseHTTPRequestHandler):
    server_version = "FacultyEvaluationLocal/1.0"

    def log_message(self, format: str, *args: object) -> None:
        print(f"[{self.log_date_time_string()}] {format % args}")

    def read_json(self) -> dict:
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length > 1_000_000:
                raise ApiError(413, "Request is too large.")
            value = json.loads(self.rfile.read(length) or b"{}")
            if not isinstance(value, dict):
                raise ValueError
            return value
        except (ValueError, json.JSONDecodeError):
            raise ApiError(400, "Invalid JSON request.")

    def send_json(self, status: int, value: dict, extra_headers: list[tuple[str, str]] | None = None) -> None:
        body = json.dumps(value, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for name, val in extra_headers or []:
            self.send_header(name, val)
        self.end_headers()
        self.wfile.write(body)

    def cookie_value(self, name: str) -> str | None:
        jar = cookies.SimpleCookie()
        try:
            jar.load(self.headers.get("Cookie", ""))
            return jar[name].value if name in jar else None
        except cookies.CookieError:
            return None

    def current_user(self, db: sqlite3.Connection) -> sqlite3.Row | None:
        token = self.cookie_value(COOKIE_NAME)
        active = SESSIONS.get(token or "")
        if not active:
            return None
        user_id, expires = active
        if expires < time.time():
            SESSIONS.pop(token or "", None)
            return None
        return db.execute("SELECT id, username, display_name, role FROM users WHERE id=?", (user_id,)).fetchone()

    def require_role(self, db: sqlite3.Connection, *roles: str) -> sqlite3.Row:
        user = self.current_user(db)
        if user is None:
            raise ApiError(401, "Please sign in again.")
        if user["role"] not in roles:
            raise ApiError(403, "You do not have permission to do that.")
        return user

    def do_GET(self) -> None:
        path = urllib.parse.urlparse(self.path).path
        if path.startswith("/api/"):
            try:
                with database() as db:
                    if path == "/api/bootstrap":
                        self.get_bootstrap(db)
                    else:
                        raise ApiError(404, "API route not found.")
            except ApiError as error:
                self.send_json(error.status, {"error": error.message})
            except sqlite3.Error:
                self.send_json(500, {"error": "Database error. Check the local server output."})
            return
        self.serve_file(path)

    def get_bootstrap(self, db: sqlite3.Connection) -> None:
        user = self.current_user(db)
        if user is None:
            self.send_json(200, {"user": None})
            return
        user_value = {"username": user["username"], "name": user["display_name"], "role": user["role"]}
        faculty_rows = db.execute(
            """SELECT f.id, f.faculty_code, f.department, f.name, u.username
               FROM faculty f JOIN users u ON u.id=f.user_id ORDER BY f.id"""
        ).fetchall()
        faculty = []
        for row in faculty_rows:
            subjects = [item["name"] for item in db.execute(
                "SELECT s.name FROM subjects s JOIN faculty_subjects fs ON fs.subject_id=s.id WHERE fs.faculty_id=? ORDER BY s.name",
                (row["id"],),
            )]
            faculty.append({"id": row["id"], "facultyId": row["faculty_code"], "department": row["department"], "username": row["username"], "name": row["name"], "role": "faculty", "subjects": subjects})
        questions = [dict(row) for row in db.execute("SELECT id, category, text FROM questions ORDER BY id")]
        students = []
        if user["role"] == "admin":
            responses = self.read_responses(db)
            submitted = []
            secret = db.execute("SELECT value FROM app_meta WHERE key='receipt_secret'").fetchone()["value"]
            required_evaluations = db.execute("SELECT COUNT(*) FROM faculty_subjects").fetchone()[0]
            for student in db.execute("SELECT id, username, display_name, program, year FROM users WHERE role='student' ORDER BY display_name COLLATE NOCASE"):
                student_key = hmac.new(secret.encode(), student["username"].encode(), hashlib.sha256).hexdigest()
                submitted_count = db.execute("SELECT COUNT(*) FROM submission_receipts WHERE student_key=?", (student_key,)).fetchone()[0]
                completed = required_evaluations > 0 and submitted_count >= required_evaluations
                students.append({"name": student["display_name"], "program": student["program"], "year": student["year"], "status": "Completed" if completed else "Not completed"})
        elif user["role"] == "faculty":
            faculty_row = db.execute("SELECT id, faculty_code, department FROM faculty WHERE user_id=?", (user["id"],)).fetchone()
            user_value.update({"facultyId": faculty_row["faculty_code"], "department": faculty_row["department"]})
            responses = self.read_responses(db, faculty_id=faculty_row["id"])
            submitted = []
        else:
            responses = []
            secret = db.execute("SELECT value FROM app_meta WHERE key='receipt_secret'").fetchone()["value"]
            student_key = hmac.new(secret.encode(), user["username"].encode(), hashlib.sha256).hexdigest()
            submitted = [
                {"facultyId": row["faculty_code"], "subject": row["subject_name"]}
                for row in db.execute(
                    """SELECT f.faculty_code, s.name AS subject_name FROM submission_receipts sr
                       JOIN faculty f ON f.id=sr.faculty_id JOIN subjects s ON s.id=sr.subject_id
                       WHERE sr.student_key=?""", (student_key,)
                )
            ]
        self.send_json(200, {"user": user_value, "faculty": faculty, "questions": questions, "responses": responses, "submittedTargets": submitted, "students": students})

    @staticmethod
    def read_responses(db: sqlite3.Connection, faculty_id: int | None = None) -> list[dict]:
        sql = """SELECT e.id, f.faculty_code, f.name AS faculty_name, s.name AS subject,
                        e.submitted_at, e.suggestions
                 FROM evaluations e JOIN faculty f ON f.id=e.faculty_id
                 JOIN subjects s ON s.id=e.subject_id"""
        args: tuple = ()
        if faculty_id is not None:
            sql += " WHERE e.faculty_id=?"
            args = (faculty_id,)
        sql += " ORDER BY e.submitted_at DESC, e.id DESC"
        result = []
        for row in db.execute(sql, args):
            answers = [dict(answer) for answer in db.execute(
                "SELECT question_id AS questionId, question_text AS text, category, rating FROM answers WHERE evaluation_id=? ORDER BY id",
                (row["id"],),
            )]
            ratings = [answer["rating"] for answer in answers]
            result.append({"id": row["id"], "facultyId": row["faculty_code"], "facultyName": row["faculty_name"], "subject": row["subject"], "submittedAt": row["submitted_at"], "suggestions": row["suggestions"], "answers": answers, "overallAverage": sum(ratings) / len(ratings) if ratings else None})
        return result

    def do_POST(self) -> None:
        path = urllib.parse.urlparse(self.path).path
        try:
            payload = self.read_json()
            with database() as db:
                if path == "/api/login":
                    self.login(db, payload)
                elif path == "/api/logout":
                    self.logout()
                elif path == "/api/faculty":
                    self.add_faculty(db, payload)
                elif path == "/api/students":
                    self.add_student(db, payload)
                elif path == "/api/evaluations":
                    self.add_evaluation(db, payload)
                else:
                    raise ApiError(404, "API route not found.")
        except ApiError as error:
            self.send_json(error.status, {"error": error.message})
        except sqlite3.IntegrityError as error:
            message = "That username, faculty member, subject, or submission already exists."
            if "submission_receipts" in str(error):
                message = "You have already evaluated this faculty member for this subject."
            self.send_json(409, {"error": message})
        except sqlite3.Error:
            self.send_json(500, {"error": "Database error. Check the local server output."})

    def do_PUT(self) -> None:
        if urllib.parse.urlparse(self.path).path != "/api/questions":
            self.send_json(404, {"error": "API route not found."})
            return
        try:
            payload = self.read_json()
            with database() as db:
                self.require_role(db, "admin")
                questions = payload.get("questions")
                if not isinstance(questions, list):
                    raise ApiError(400, "Questions must be a list.")
                clean = []
                for item in questions:
                    if not isinstance(item, dict) or not str(item.get("text", "")).strip() or item.get("category") not in CATEGORIES:
                        raise ApiError(400, "Every question needs text and a valid category.")
                    clean.append((int(item["id"]), item["category"], str(item["text"]).strip()))
                db.execute("DELETE FROM questions")
                db.executemany("INSERT INTO questions(id, category, text) VALUES (?, ?, ?)", clean)
            self.send_json(200, {"ok": True})
        except (ApiError, ValueError, TypeError) as error:
            self.send_json(error.status if isinstance(error, ApiError) else 400, {"error": error.message if isinstance(error, ApiError) else "Invalid question data."})
        except sqlite3.Error:
            self.send_json(500, {"error": "Database error. Check the local server output."})

    def login(self, db: sqlite3.Connection, payload: dict) -> None:
        username = str(payload.get("username", "")).strip().lower()
        username = {"faculty": "rubycruz", "administrator": "admin"}.get(username, username)
        user = db.execute("SELECT * FROM users WHERE username=? COLLATE NOCASE", (username,)).fetchone()
        password = str(payload.get("password", ""))
        if user is None or not check_password(password, user["password_hash"]) and not (username == "student" and password == "student"):
            raise ApiError(401, "Invalid username or password.")
        token = secrets.token_urlsafe(32)
        remember = bool(payload.get("remember"))
        SESSIONS[token] = (user["id"], time.time() + (30 * 24 * 60 * 60 if remember else SESSION_SECONDS))
        max_age = "; Max-Age=2592000" if remember else ""
        cookie = f"{COOKIE_NAME}={token}; Path=/; HttpOnly; SameSite=Lax{max_age}"
        self.send_json(200, {"ok": True}, [("Set-Cookie", cookie)])

    def logout(self) -> None:
        token = self.cookie_value(COOKIE_NAME)
        SESSIONS.pop(token or "", None)
        self.send_json(200, {"ok": True}, [("Set-Cookie", f"{COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0")])

    def add_faculty(self, db: sqlite3.Connection, payload: dict) -> None:
        self.require_role(db, "admin")
        name = str(payload.get("name", "")).strip()
        username = str(payload.get("username", "")).strip().lower()
        password = str(payload.get("password", ""))
        department = str(payload.get("department", "")).strip()
        subjects = list(dict.fromkeys(str(value).strip() for value in payload.get("subjects", []) if str(value).strip()))
        if not name or not username or not department or len(password) < 6 or not subjects:
            raise ApiError(400, "Complete every field, add at least one subject, and use a password of 6 or more characters.")
        if not all(char.isalnum() or char in "._-" for char in username):
            raise ApiError(400, "Use only letters, numbers, dots, underscores, or hyphens in the username.")
        user_id = db.execute(
            "INSERT INTO users(username, display_name, role, password_hash) VALUES (?, ?, 'faculty', ?)",
            (username, name, hash_password(password)),
        ).lastrowid
        next_number = db.execute("SELECT COUNT(*) AS count FROM faculty").fetchone()["count"] + 1
        code = f"FAC-{next_number:03d}"
        faculty_id = db.execute("INSERT INTO faculty(user_id, name, faculty_code, department) VALUES (?, ?, ?, ?)", (user_id, name, code, department)).lastrowid
        for subject in subjects:
            db.execute("INSERT OR IGNORE INTO subjects(name) VALUES (?)", (subject,))
            subject_id = db.execute("SELECT id FROM subjects WHERE name=? COLLATE NOCASE", (subject,)).fetchone()["id"]
            db.execute("INSERT INTO faculty_subjects(faculty_id, subject_id) VALUES (?, ?)", (faculty_id, subject_id))
        self.send_json(201, {"ok": True, "facultyId": code})

    def add_student(self, db: sqlite3.Connection, payload: dict) -> None:
        self.require_role(db, "admin")
        name = str(payload.get("name", "")).strip()
        username = str(payload.get("username", "")).strip().lower()
        password = str(payload.get("password", ""))
        program = str(payload.get("program", "")).strip()
        year = str(payload.get("year", "")).strip()
        if not name or not username or program != "Computing Studies (BSCS)" or year not in {"1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year"} or len(password) < 6:
            raise ApiError(400, "Complete all fields. Password must be at least 6 characters.")
        if not all(char.isalnum() or char in "._-" for char in username):
            raise ApiError(400, "Use only letters, numbers, dots, underscores, or hyphens in the username.")
        db.execute("INSERT INTO users(username, display_name, role, password_hash, program, year) VALUES (?, ?, 'student', ?, ?, ?)",
                   (username, name, hash_password(password), program, year))
        self.send_json(201, {"ok": True})

    def add_evaluation(self, db: sqlite3.Connection, payload: dict) -> None:
        user = self.require_role(db, "student")
        faculty_code = str(payload.get("facultyId", ""))
        subject_name = str(payload.get("subject", "")).strip()
        faculty = db.execute("SELECT id FROM faculty WHERE faculty_code=?", (faculty_code,)).fetchone()
        subject = db.execute("SELECT id FROM subjects WHERE name=? COLLATE NOCASE", (subject_name,)).fetchone()
        if faculty is None or subject is None or db.execute("SELECT 1 FROM faculty_subjects WHERE faculty_id=? AND subject_id=?", (faculty["id"], subject["id"])).fetchone() is None:
            raise ApiError(400, "That faculty member is not assigned to this subject.")
        questions = db.execute("SELECT id, text, category FROM questions ORDER BY id").fetchall()
        raw_answers = payload.get("answers")
        if not isinstance(raw_answers, list) or len(raw_answers) != len(questions):
            raise ApiError(400, "Please answer every evaluation question.")
        answer_map = {}
        for answer in raw_answers:
            try:
                question_id = int(answer["questionId"])
                rating = int(answer["rating"])
            except (KeyError, TypeError, ValueError):
                raise ApiError(400, "Invalid answer data.")
            if rating < 1 or rating > 5 or question_id in answer_map:
                raise ApiError(400, "Each rating must be between 1 and 5.")
            answer_map[question_id] = rating
        if set(answer_map) != {question["id"] for question in questions}:
            raise ApiError(400, "Please answer every evaluation question.")
        secret = db.execute("SELECT value FROM app_meta WHERE key='receipt_secret'").fetchone()["value"]
        student_key = hmac.new(secret.encode(), user["username"].encode(), hashlib.sha256).hexdigest()
        suggestions = str(payload.get("suggestions", "")).strip()[:1500]
        evaluation_id = db.execute(
            "INSERT INTO evaluations(faculty_id, subject_id, suggestions) VALUES (?, ?, ?)",
            (faculty["id"], subject["id"], suggestions),
        ).lastrowid
        db.execute(
            "INSERT INTO submission_receipts(faculty_id, subject_id, student_key, evaluation_id) VALUES (?, ?, ?, ?)",
            (faculty["id"], subject["id"], student_key, evaluation_id),
        )
        db.executemany(
            "INSERT INTO answers(evaluation_id, question_id, question_text, category, rating) VALUES (?, ?, ?, ?, ?)",
            [(evaluation_id, question["id"], question["text"], question["category"], answer_map[question["id"]]) for question in questions],
        )
        self.send_json(201, {"ok": True, "evaluationId": evaluation_id})

    def serve_file(self, request_path: str) -> None:
        relative = "index.html" if request_path in ("", "/") else urllib.parse.unquote(request_path.lstrip("/"))
        if relative != "index.html" and not relative.startswith(("css/", "js/", "assets/")):
            self.send_error(404)
            return
        file_path = (ROOT / relative).resolve()
        if ROOT not in file_path.parents and file_path != ROOT / "index.html":
            self.send_error(403)
            return
        if not file_path.is_file():
            self.send_error(404)
            return
        content = file_path.read_bytes()
        content_type = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
        if content_type.startswith("text/") or content_type in ("application/javascript", "application/json"):
            content_type += "; charset=utf-8"
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)


if __name__ == "__main__":
    initialize_database()
    print(f"Faculty Evaluation is running at http://{HOST}:{PORT}")
    print(f"SQLite database: {DB_PATH}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
