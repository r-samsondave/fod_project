# Faculty Evaluation System

A beginner-friendly school prototype built with HTML, CSS, and vanilla JavaScript. No build process, frameworks, backend, database, or external assets are needed.

## How to run

1. Open this folder in VS Code.
2. If you have the Live Server extension, right-click `index.html` and select **Open with Live Server**.
3. Sign in with one of the demo accounts below.

You can also open `index.html` directly in a modern browser with JavaScript and browser storage enabled. Live Server provides a consistent storage origin. Always use the same browser and URL/port to see the same saved data.

## Demo accounts

| Role | Username | Password |
| --- | --- | --- |
| Student — Juan Dela Cruz | `student` | `student123` |
| Admin — Guidance Administrator | `admin` | `admin123` |
| Faculty — Ruby Cruz | `rubycruz` | `ruby123` |

The account determines the role. There is no role selector.

## Files

- `index.html`: document, stylesheet/script references, and application container.
- `css/style.css`: shared design tokens, layouts, forms, rating controls, and mobile styles.
- `js/app.js`: demo accounts, storage helpers, view rendering, role checks, question management, submissions, and averages.

## Features

- Student: evaluate Ruby Cruz, answer every question on a 1–5 scale, submit once, and see confirmation/completed status.
- Admin: view dashboard counts, add/edit/delete categorized questions, view the faculty directory, and review calculated results.
- Faculty: view her overall and category averages without student identities.
- All roles: session persistence on refresh, responsive navigation, keyboard focus indicators, and logout without deleting evaluation data.

## How the JavaScript works

`initialize()` restores a recognized username from sessionStorage. `login()` checks the three demo accounts. `renderPage()` checks the role's allowed pages before rendering the shared workspace. It then calls a small view function such as `renderStudentDashboard()` or `renderQuestions()`.

Event listeners connect buttons and forms to named functions. Admin mutations and student submission check the role again. Text entered by the admin is escaped before being inserted into HTML.

`calculateCategoryAverage()` divides a category's sum of ratings by its number of ratings. `calculateOverallAverage()` does the same across all answers, so categories with more questions carry proportionally more weight. Only displayed values are rounded to two decimal places. Missing data displays an em dash or empty state, not a fabricated score.

## Browser storage

| Storage | Key | Contents |
| --- | --- | --- |
| localStorage | `facultyEvaluationQuestions` | Array of `{ id, category, text }`; initially 10 questions |
| localStorage | `facultyEvaluationResponses` | Array containing the single permitted response with faculty ID, timestamp, answer snapshots, and calculated overall average |
| sessionStorage | `currentUser` | Recognized username; no password is saved here |

The saved response also acts as the student's completion status, avoiding a separate status value that could become inconsistent. This works because the prototype has exactly one student and one faculty member. Logging out only removes `currentUser`.

Each answer preserves its question text and category at submission. Editing or deleting a question later does not rewrite existing results. If questions change in another tab while a student is completing the form, submission asks the student to complete the refreshed form.

To reset the demo, use browser developer tools → Application/Storage → Local Storage and delete the two `facultyEvaluation…` keys, then reload. This deletes the saved questions and response and restores the defaults. Changing the URL, browser, profile, or port creates a separate storage area. Private browsing or browser cleanup may remove saved data.

## Presentation walkthrough

1. Sign in as admin: see 10 questions and 0 responses; add, edit, and delete a sample question.
2. Log out and sign in as student: start the evaluation and submit with unanswered questions to see validation.
3. Complete all ratings and submit; the dashboard changes to Completed. Refresh to confirm it stays completed.
4. Log out and sign in as Ruby Cruz: view the overall score and four category averages.
5. Sign in as admin to see the same results and updated submitted count.

For the original 10 questions, ratings `5, 4, 5, 4, 5, 3, 4, 5, 4, 5` produce category averages **4.67, 4.50, 3.50, 4.67** and overall **4.40**.

## Important prototype limitation

Hardcoded credentials and client-side authorization are only suitable for a school prototype. A person with developer tools can inspect passwords and change JavaScript or browser storage. Real deployment requires server-side authentication, authorization, and protected storage. Results omit student identity, but a single response cannot provide meaningful statistical anonymity. Data is local to one browser, not shared across devices. This prototype is not intended to collect real confidential evaluations.
