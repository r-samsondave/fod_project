const categories = ['Teaching Effectiveness', 'Communication', 'Classroom Management', 'Professionalism'];
const roleNames = { student: 'Student', admin: 'Guidance Office', faculty: 'Faculty Member' };
const navigation = {
  student: [['dashboard', 'Dashboard'], ['evaluation', 'Evaluations']],
  admin: [['dashboard', 'Dashboard'], ['questions', 'Questions'], ['faculty', 'Faculty'], ['results', 'Results']],
  faculty: [['dashboard', 'Dashboard'], ['results', 'My Results']]
};
const app = document.getElementById('app');
let currentUser = null;
let currentPage = 'dashboard';
let evaluationQuestions = [];
let evaluationTarget = null;
let databaseState = { faculty: [], questions: [], responses: [], submittedTargets: [] };

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || 'GET',
    credentials: 'same-origin',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'The local server could not complete that request.');
  return data;
}

function applyDatabaseState(data) {
  currentUser = data.user;
  databaseState = {
    faculty: data.faculty || [],
    questions: data.questions || [],
    responses: data.responses || [],
    submittedTargets: data.submittedTargets || []
  };
}

async function refreshDatabaseState() { applyDatabaseState(await apiRequest('/api/bootstrap')); }
function getQuestions() { return databaseState.questions; }
function getFaculty() { return databaseState.faculty; }
function getResponses() { return databaseState.responses; }

function hasSubmitted(target = evaluationTarget) {
  return target ? databaseState.submittedTargets.some(item => item.facultyId === target.facultyId && item.subject === target.subject) : databaseState.submittedTargets.length > 0;
}

function escapeHtml(value) {
  const element = document.createElement('span');
  element.textContent = String(value);
  return element.innerHTML;
}

function icon(name) {
  const paths = {
    dashboard: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
    questions: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    faculty: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-3-5"/>',
    results: '<path d="M4 20V10M12 20V4M20 20v-7"/>',
    evaluation: '<path d="M8 3H4v18h16V3h-4M8 2h8v4H8zM8 11h8M8 16h5"/>'
  };
  return `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">${paths[name] || paths.dashboard}</svg>`;
}

function brand() {
  return '<div class="brand"><img class="brand-logo" src="assets/olopsc-crest.png" alt=""><span class="brand-copy"><strong>Our Lady of Perpetual Succor College</strong><small>FACULTY EVALUATION</small></span></div>';
}

function renderLogin() {
  document.title = 'Sign in | Faculty Evaluation';
  app.innerHTML = `<main class="login-shell" id="main-content"><div class="login-page">
    <section class="login-story" aria-labelledby="login-title">
      ${brand()}
      <div class="login-intro">
        <span class="system-label">FACULTY EVALUATION SYSTEM</span>
        <h1 id="login-title">TEACHING QUALITY<br>GROWS THROUGH<br>THOUGHTFUL<br><span>REFLECTION.</span></h1>
        <div class="editorial-rule"></div>
      </div>
    </section>
    <section class="login-form-area" aria-labelledby="signin-title"><div class="login-card">
      <span class="eyebrow">FACULTY EVALUATION SYSTEM</span><h2 id="signin-title">Welcome back</h2>
      <p class="subtitle">Sign in with your OLOPSC account.</p>
      <form id="login-form">
        <div class="field"><label class="field-label" for="username">Email</label><input id="username" name="username" autocomplete="username" placeholder="@olopsc.edu.ph" required></div>
        <div class="field"><label class="field-label" for="password">Password</label><div class="password-field"><input id="password" name="password" type="password" autocomplete="current-password" placeholder="Enter your password" required><button type="button" class="password-toggle" id="toggle-password" aria-label="Show password" aria-pressed="false">Show</button></div></div>
        <div class="login-options"><label><input type="checkbox" id="keep-signed-in"> <span>Keep me signed in</span></label><a href="#forgot-password" id="forgot-password">Forgot password?</a></div>
        <p id="login-error" class="error" role="alert"></p>
        <button class="button full-width" type="submit"><span aria-hidden="true">→</span> Sign in to the portal</button>
      </form>
      <div class="demo-accounts"><div class="demo-heading"><span class="eyebrow">Demo accounts</span><span class="demo-tag">PROTOTYPE</span></div>
        <button class="account-row" type="button" data-demo="student"><span>Student</span><code>student / student123</code></button>
        <button class="account-row" type="button" data-demo="faculty"><span>Faculty</span><code>faculty / ruby123</code></button>
        <button class="account-row" type="button" data-demo="admin"><span>Administrator</span><code>admin / admin123</code></button>
      </div>
      <div class="login-bottom"><a href="#privacy-policy">Privacy policy</a><span>© 2026 Our Lady Of Perpetual Succor College</span></div>
    </div></section>
  </div></main>`;
  document.getElementById('login-form').addEventListener('submit', login);
  document.querySelectorAll('[data-demo]').forEach(button => button.addEventListener('click', () => {
    const role = button.dataset.demo;
    document.getElementById('username').value = role === 'faculty' ? 'rubycruz' : role;
    document.getElementById('password').value = role === 'student' ? 'student123' : role === 'faculty' ? 'ruby123' : 'admin123';
    document.getElementById('username').focus();
  }));
  document.getElementById('toggle-password').addEventListener('click', function () {
    const input = document.getElementById('password');
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    this.textContent = show ? 'Hide' : 'Show';
    this.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    this.setAttribute('aria-pressed', String(show));
  });
}

async function login(event) {
  event.preventDefault();
  const entered = document.getElementById('username').value.trim();
  const username = entered.includes('@') ? entered.split('@')[0] : entered;
  const password = document.getElementById('password').value;
  try {
    await apiRequest('/api/login', { method: 'POST', body: { username, password, remember: document.getElementById('keep-signed-in').checked } });
    await refreshDatabaseState();
    renderPage('dashboard');
  } catch (error) {
    document.getElementById('login-error').textContent = error.message;
  }
}

async function logout() {
  try { await apiRequest('/api/logout', { method: 'POST', body: {} }); } catch (error) { /* Clear the local view even if the server has stopped. */ }
  currentUser = null;
  evaluationQuestions = [];
  evaluationTarget = null;
  databaseState = { faculty: [], questions: [], responses: [], submittedTargets: [] };
  renderLogin();
  document.getElementById('username').focus();
}

function pageHeading(title, description, label = 'Your workspace') {
  return `<header class="page-heading"><div><span class="eyebrow">${label}</span><h1 tabindex="-1">${title}</h1><p class="subtitle">${description}</p></div><span class="page-number" aria-hidden="true">FE / 01</span></header>`;
}

function stat(label, value, note = '') {
  return `<div class="stat"><span class="stat-label">${label}</span><div class="stat-value">${value}</div>${note ? `<span class="stat-note">${note}</span>` : ''}</div>`;
}

function emptyState(title, description) {
  return `<div class="panel empty-state"><div class="empty-symbol" aria-hidden="true">—</div><h3>${title}</h3><p>${description}</p></div>`;
}

function renderPage(page) {
  if (!currentUser) return renderLogin();
  // Check access before rendering, even if a hidden button or function is invoked.
  const allowed = navigation[currentUser.role].some(item => item[0] === page);
  if (!allowed && !(page === 'confirmation' && currentUser.role === 'student' && hasSubmitted())) page = 'dashboard';
  currentPage = page;
  let content = '';
  if (page === 'dashboard') content = renderDashboard();
  if (page === 'evaluation') { content = renderEvaluation(); if (hasSubmitted()) content = renderConfirmation(); }
  if (page === 'confirmation') content = renderConfirmation();
  if (page === 'questions') content = renderQuestions();
  if (page === 'faculty') content = renderFaculty();
  if (page === 'results') content = renderResults();
  const pageLabel = navigation[currentUser.role].find(item => item[0] === page)?.[1] || 'Evaluations';
  const initials = currentUser.name.split(' ').map(part => part[0]).slice(0, 2).join('');
  document.title = `${pageLabel} | Faculty Evaluation`;
  app.innerHTML = `<div class="workspace">
    <aside class="sidebar"><div class="sidebar-heading">${brand()}<button class="button secondary menu-toggle" id="menu-toggle" aria-expanded="false" aria-controls="main-navigation">Menu</button></div>
      <nav id="main-navigation" aria-label="Main navigation"><p class="nav-caption">WORKSPACE</p><div class="nav-links">${navigation[currentUser.role].map(([target, title]) => `<button class="nav-link ${target === page || (target === 'evaluation' && page === 'confirmation') ? 'active' : ''}" data-page="${target}" ${target === page ? 'aria-current="page"' : ''}>${icon(target)}${title}</button>`).join('')}</div></nav>
      <div class="user-panel"><div class="user-info"><div class="avatar" aria-hidden="true">${initials}</div><div><div class="user-name">${currentUser.name}</div><div class="user-role">${roleNames[currentUser.role]}</div></div></div><button class="button secondary full-width logout" id="logout">↗ &nbsp; Log out</button></div>
    </aside>
    <div class="workspace-main"><div class="topbar"><span>${roleNames[currentUser.role]} <span aria-hidden="true"> / </span> <strong>${pageLabel}</strong></span><span class="small-status">Evaluation period active</span></div>
      <main class="page" id="main-content">${content}<footer class="page-footer"><span>Faculty Evaluation System</span><span>School prototype · Saved in the local SQLite database</span></footer></main>
    </div></div>`;
  document.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', async () => {
    if (button.dataset.page === 'evaluation' && currentUser?.role === 'student') {
      try {
        await refreshDatabaseState();
      } catch (error) {
        renderPage('evaluation');
        const message = document.getElementById('evaluation-error');
        if (message) message.textContent = error.message;
        return;
      }
    }
    renderPage(button.dataset.page);
  }));
  document.querySelectorAll('[data-start-evaluation]').forEach(button => button.addEventListener('click', () => { location.hash = `faculty=${encodeURIComponent(button.dataset.startEvaluation)}&subject=${encodeURIComponent(button.dataset.subject)}`; renderPage('evaluation'); }));
  document.getElementById('logout').addEventListener('click', logout);
  document.getElementById('menu-toggle').addEventListener('click', function () {
    const open = document.querySelector('.sidebar').classList.toggle('open');
    this.setAttribute('aria-expanded', String(open));
  });
  if (page === 'questions') bindQuestionActions();
  if (page === 'faculty') bindFacultyActions();
  document.getElementById('evaluation-form')?.addEventListener('submit', submitEvaluation);
  document.getElementById('evaluation-subject')?.addEventListener('change', event => { location.hash = `faculty=${encodeURIComponent(evaluationTarget?.facultyId || '')}&subject=${encodeURIComponent(event.target.value)}`; renderPage('evaluation'); });
  document.querySelector('h1')?.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

function renderDashboard() {
  if (currentUser.role === 'student') return renderStudentDashboard();
  if (currentUser.role === 'admin') return renderAdminDashboard();
  return renderFacultyDashboard();
}

function renderStudentDashboard() {
  const faculty = getFaculty();
  const targets = faculty.flatMap(member => (member.subjects || []).map(subject => ({ ...member, subject })));
  const completed = targets.filter(target => hasSubmitted(target)).length;
  return `${pageHeading('Welcome, Juan.', 'Choose a faculty member and the subject you are taking with them.', 'Student dashboard')}
    <div class="stats">${stat('Available evaluations', String(targets.length), 'Faculty and subject combinations')}${stat('Evaluations completed', String(completed), `Of ${targets.length} available`)}${stat('Evaluation period', 'Active', 'Your feedback is welcome')}</div>
    <div class="section-heading"><h2>Available Evaluations</h2><span>${targets.length} subjects</span></div>
    ${targets.length ? targets.map(target => { const done = hasSubmitted(target); return `<div class="panel faculty-card section"><div class="faculty-avatar" aria-hidden="true">${escapeHtml(target.name.split(' ').map(part => part[0]).slice(0,2).join(''))}</div><div class="faculty-details"><span class="eyebrow">${escapeHtml(target.facultyId)} / ${escapeHtml(target.department)}</span><h3>${escapeHtml(target.name)}</h3><p>${escapeHtml(target.subject)}</p></div><div class="card-action"><span class="badge ${done ? 'complete' : ''}">${done ? 'Completed' : 'Not Completed'}</span><button class="button" data-start-evaluation="${escapeHtml(target.facultyId)}" data-subject="${escapeHtml(target.subject)}" ${done || !getQuestions().length ? 'disabled' : ''}>${done ? 'Submitted' : 'Start Evaluation'}</button></div></div>`; }).join('') : emptyState('No faculty are available yet.', 'Please check back after the administrator adds faculty and subjects.')}
    <div class="info-grid section"><div class="note"><span class="eyebrow">Be thoughtful</span><h3>Your perspective matters.</h3><p>Your name is not shown in faculty results. You can submit one evaluation for each subject.</p></div></div>`;
}

function renderAdminDashboard() {
  const count = getResponses().length;
  const faculty = getFaculty();
  return `${pageHeading('A clearer view of teaching.', 'Manage evaluations and turn student feedback into understanding.', 'Guidance Office / Dashboard')}
    <div class="stats four">${stat('Total Faculty', String(faculty.length), 'Active faculty members')}${stat('Total Students', '1', 'Demo student account')}${stat('Evaluation Questions', getQuestions().length, 'Across 4 categories')}${stat('Submitted Evaluations', count, 'Of 1 student')}</div>
    <div class="section-heading"><h2>Evaluation overview</h2><button class="text-button" data-page="results">View results ↗</button></div>
    ${faculty.map(member => { const responses = getResponses().filter(response => response.facultyId === member.facultyId); return `<div class="panel faculty-card section"><div class="faculty-avatar" aria-hidden="true">${escapeHtml(member.name.split(' ').map(part => part[0]).slice(0,2).join(''))}</div><div class="faculty-details"><span class="eyebrow">${escapeHtml(member.department)}</span><h3>${escapeHtml(member.name)}</h3><p>${escapeHtml(member.facultyId)} / ${responses.length} responses / ${member.subjects.map(escapeHtml).join(', ')}</p></div><span class="badge complete">Active</span></div>`; }).join('')}
    <div class="info-grid section"><div class="note"><span class="eyebrow">Question bank</span><h3>Make every question count.</h3><p>Review and organize the questions students use to evaluate their faculty.</p><button class="text-button" data-page="questions">Manage questions ↗</button></div><div class="note"><span class="eyebrow">Faculty directory</span><h3>The people behind the learning.</h3><p>View the faculty member participating in this evaluation period.</p><button class="text-button" data-page="faculty">View faculty ↗</button></div></div>`;
}

function calculateCategoryAverage(category, responses = getResponses()) {
  const ratings = responses.flatMap(response => response.answers).filter(answer => answer.category === category).map(answer => answer.rating);
  return ratings.length ? ratings.reduce((total, rating) => total + rating, 0) / ratings.length : null;
}

function calculateOverallAverage(responses = getResponses()) {
  const ratings = responses.flatMap(response => response.answers).map(answer => answer.rating);
  return ratings.length ? ratings.reduce((total, rating) => total + rating, 0) / ratings.length : null;
}

function formatRating(rating) { return rating === null ? '—' : rating.toFixed(2); }

function resultStats() {
  const responses = currentUser?.role === 'faculty' ? getResponses().filter(response => response.facultyId === currentUser.facultyId) : getResponses();
  return `<div class="stats">${stat('Overall Rating', `${formatRating(calculateOverallAverage(responses))} <small>/ 5.00</small>`, 'Average of all submitted ratings')}${stat('Responses', responses.length, 'Total student responses')}${stat('Evaluation Status', 'Active', currentUser?.role === 'faculty' ? currentUser.department : 'All departments')}</div>`;
}

function renderFacultyDashboard() {
  const responses = getResponses().filter(response => response.facultyId === currentUser.facultyId);
  return `${pageHeading(`Welcome, ${escapeHtml(currentUser.name.split(' ')[0])}.`, 'A space to reflect on your teaching and see where you shine.', 'Faculty dashboard')}
    <div class="section-heading"><h2>Evaluation Overview</h2><span>${escapeHtml(currentUser.facultyId)}</span></div>${resultStats()}
    ${responses.length ? '<div class="panel"><h2>Your feedback is ready.</h2><p class="subtitle">Explore how students rated each evaluation category.</p><div class="section"><button class="button" data-page="results">View My Results</button></div></div>' : emptyState('No evaluations have been submitted yet.', 'Your overview will update after students submit evaluations.')}
    <div class="note section"><h3>A little reflection. Meaningful progress.</h3><p>Results show aggregate ratings only. Student identities are not displayed.</p></div>`;
}

function renderResults() {
  if (!['admin', 'faculty'].includes(currentUser.role)) return '';
  const responses = currentUser.role === 'faculty' ? getResponses().filter(response => response.facultyId === currentUser.facultyId) : getResponses();
  const title = currentUser.role === 'faculty' ? `${currentUser.name} - ${currentUser.department} - ${currentUser.facultyId}` : 'Results across all faculty';
  return `${pageHeading(currentUser.role === 'faculty' ? 'Your teaching, reflected.' : 'Faculty results.', title, 'Evaluation results')}${resultStats()}
    <div class="section-heading"><h2>Category averages</h2><span>Scale of 1-5</span></div>
    ${responses.length ? `<div class="panel">${categories.map(category => { const average = calculateCategoryAverage(category, responses); return `<div class="result-category"><div class="result-category-label"><span>${category}</span><strong>${formatRating(average)} <small>/ 5.00</small></strong></div><div class="result-bar" aria-hidden="true"><div class="result-bar-fill" style="width:${average === null ? 0 : average / 5 * 100}%"></div></div></div>`; }).join('')}</div>` : emptyState(currentUser.role === 'faculty' ? 'No evaluations have been submitted yet.' : 'No evaluation data available.', 'Submitted feedback will appear here automatically.')}
    ${responses.some(response => response.suggestions?.trim()) ? `<section class="section"><div class="section-heading"><h2>Constructive suggestions</h2></div><div class="question-list">${responses.filter(response => response.suggestions?.trim()).map(response => `<article class="question-row"><div class="question-copy"><p>${escapeHtml(response.suggestions)}</p><p class="question-category">${escapeHtml(response.facultyName || 'Faculty member')} / ${escapeHtml(response.subject || 'Subject not specified')}</p></div></article>`).join('')}</div></section>` : ''}
    <div class="note section"><h3>About these results</h3><p>Category scores average all ratings in that category. Student names are never displayed.</p></div>`;
}

function renderFaculty() {
  if (currentUser.role !== 'admin') return '';
  const faculty = getFaculty();
  return `${pageHeading('Faculty directory.', 'Add faculty members and assign the subjects they teach.', 'Guidance Office / Faculty')}
    <div class="section-heading"><div class="section-title-group"><h2>All faculty</h2><span>${faculty.length} members</span></div><button class="button" id="add-faculty">+ Add Faculty</button></div>
    <div id="faculty-editor"></div><div class="table-wrap"><table><caption class="eyebrow">Participating faculty</caption><thead><tr><th>Faculty member</th><th>Faculty ID</th><th>Department</th><th>Subjects</th><th>Status</th></tr></thead><tbody>${faculty.map(member => `<tr><td><strong>${escapeHtml(member.name)}</strong><br><span class="muted">${escapeHtml(member.username)}</span></td><td>${escapeHtml(member.facultyId)}</td><td>${escapeHtml(member.department)}</td><td>${member.subjects.map(escapeHtml).join(', ')}</td><td><span class="badge complete">Active</span></td></tr>`).join('')}</tbody></table></div>`;
}


function bindFacultyActions() {
  if (currentUser?.role !== 'admin') return;
  document.getElementById('add-faculty')?.addEventListener('click', () => {
    document.getElementById('faculty-editor').innerHTML = `<form class="panel question-editor" id="faculty-form"><h2>Add faculty member</h2><div class="field"><label class="field-label" for="faculty-name">Full name</label><input id="faculty-name" required></div><div class="field"><label class="field-label" for="faculty-username">Username</label><input id="faculty-username" required autocomplete="off"></div><div class="field"><label class="field-label" for="faculty-password">Initial password</label><input id="faculty-password" type="password" required></div><div class="field"><label class="field-label" for="faculty-department">Department</label><input id="faculty-department" required></div><div class="field"><label class="field-label" for="faculty-subjects">Subjects taught</label><input id="faculty-subjects" placeholder="Mathematics, Algebra, Statistics" required><small>Enter multiple subjects separated by commas.</small></div><p class="error" id="faculty-error" role="alert"></p><div class="actions"><button class="button" type="submit">Save faculty</button><button class="button secondary" type="button" id="cancel-faculty">Cancel</button></div></form>`;
    document.getElementById('cancel-faculty').addEventListener('click', () => renderPage('faculty'));
    document.getElementById('faculty-form').addEventListener('submit', async event => {
      event.preventDefault(); if (currentUser?.role !== 'admin') return;
      const name = document.getElementById('faculty-name').value.trim();
      const username = document.getElementById('faculty-username').value.trim().toLowerCase();
      const password = document.getElementById('faculty-password').value;
      const department = document.getElementById('faculty-department').value.trim();
      const subjects = [...new Set(document.getElementById('faculty-subjects').value.split(',').map(value => value.trim()).filter(Boolean))];
      if (!name || !/^[a-z0-9._-]+$/.test(username) || password.length < 6 || !department || !subjects.length) {
        document.getElementById('faculty-error').textContent = 'Enter all fields and choose a password of at least 6 characters.'; return;
      }
      try {
        await apiRequest('/api/faculty', { method: 'POST', body: { name, username, password, department, subjects } });
        await refreshDatabaseState();
        renderPage('faculty');
      } catch (error) { document.getElementById('faculty-error').textContent = error.message; }
    });
    document.getElementById('faculty-name').focus();
  });
}

function renderQuestions() {
  if (currentUser.role !== 'admin') return '';
  const questions = getQuestions();
  return `${pageHeading('Better questions. Better insight.', 'Shape the questions that guide meaningful student feedback.', 'Guidance Office / Questions')}
    <div class="section-heading"><h2>Question bank <span class="badge">${questions.length}</span></h2><button class="button" id="add-question">+ Add Question</button></div>
    <div id="question-editor"></div>
    ${questions.length ? `<div class="question-list">${questions.map((question, index) => `<div class="question-row"><span class="question-number">${String(index + 1).padStart(2, '0')}</span><div class="question-copy"><p>${escapeHtml(question.text)}</p><p class="question-category">${escapeHtml(question.category)}</p></div><div class="table-actions"><button class="text-button" data-edit="${question.id}" aria-label="Edit question ${index + 1}">Edit</button><button class="text-button danger" data-delete="${question.id}" aria-label="Delete question ${index + 1}">Delete</button></div></div>`).join('')}</div>` : emptyState('No questions have been created.', 'Add a question to make the evaluation available to students.')}
    <p class="demo-note">Changes apply to new evaluations. Previously submitted results retain their original questions and categories.</p>`;
}

function bindQuestionActions() {
  if (currentUser.role !== 'admin') return;
  document.getElementById('add-question').addEventListener('click', addQuestion);
  document.querySelectorAll('[data-edit]').forEach(button => button.addEventListener('click', () => editQuestion(Number(button.dataset.edit))));
  document.querySelectorAll('[data-delete]').forEach(button => button.addEventListener('click', () => deleteQuestion(Number(button.dataset.delete))));
}

function addQuestion() { if (currentUser?.role === 'admin') showQuestionEditor(); }
function editQuestion(id) { if (currentUser?.role === 'admin') showQuestionEditor(getQuestions().find(question => question.id === id)); }

function showQuestionEditor(question = null) {
  if (currentUser?.role !== 'admin') return;
  document.getElementById('question-editor').innerHTML = `<form class="panel question-editor" id="question-form"><h2>${question ? 'Edit question' : 'Add a question'}</h2>
    <div class="field"><label for="question-text" class="field-label">Question</label><textarea id="question-text" maxlength="500" required>${question ? escapeHtml(question.text) : ''}</textarea></div>
    <div class="field"><label for="question-category" class="field-label">Category</label><select id="question-category" required><option value="">Select a category</option>${categories.map(category => `<option ${question?.category === category ? 'selected' : ''}>${category}</option>`).join('')}</select></div>
    <p class="error" id="question-error" role="alert"></p><div class="actions"><button class="button" type="submit">Save</button><button class="button secondary" type="button" id="cancel-question">Cancel</button></div></form>`;
  document.getElementById('question-text').focus();
  document.getElementById('cancel-question').addEventListener('click', () => renderPage('questions'));
  document.getElementById('question-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (currentUser?.role !== 'admin') return;
    const text = document.getElementById('question-text').value.trim();
    const category = document.getElementById('question-category').value;
    if (!text || !categories.includes(category)) {
      document.getElementById('question-error').textContent = 'Enter a question and select a category.';
      return;
    }
    const questions = getQuestions();
    if (question) {
      const index = questions.findIndex(item => item.id === question.id);
      if (index === -1) return renderPage('questions');
      questions[index] = { id: question.id, text, category };
    } else {
      const id = Math.max(0, ...questions.map(item => item.id)) + 1;
      questions.push({ id, text, category });
    }
    try {
      await apiRequest('/api/questions', { method: 'PUT', body: { questions } });
      await refreshDatabaseState();
      renderPage('questions');
    } catch (error) { document.getElementById('question-error').textContent = error.message; }
  });
}

async function deleteQuestion(id) {
  if (currentUser?.role !== 'admin') return;
  if (!confirm('Delete this question? Existing submitted results will be preserved.')) return;
  try {
    const questions = getQuestions().filter(question => question.id !== id);
    await apiRequest('/api/questions', { method: 'PUT', body: { questions } });
    await refreshDatabaseState();
    renderPage('questions');
  } catch (error) { alert(error.message); }
}

function renderEvaluation() {
  if (currentUser.role !== 'student') return '';
  const faculty = getFaculty();
  const selection = new URLSearchParams(location.hash.slice(1));
  const member = faculty.find(item => item.facultyId === selection.get('faculty')) || faculty[0];
  const selectedSubject = (member?.subjects || []).includes(selection.get('subject')) ? selection.get('subject') : member?.subjects[0];
  evaluationTarget = member ? { facultyId: member.facultyId, name: member.name, department: member.department, subject: selectedSubject } : null;
  evaluationQuestions = getQuestions();
  if (!member) return `${pageHeading('Faculty Evaluation', 'No faculty members are available.')}${emptyState('No faculty are available.', 'Please check back later.')}`;
  if (!evaluationQuestions.length) return `${pageHeading('Faculty Evaluation', 'Choose the subject you are taking with this faculty member.')}${emptyState('No questions have been created.', 'Please check back later.')}`;
  const ratingNames = ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];
  let number = 0;
  return `${pageHeading('Faculty Evaluation', 'Choose the subject you are taking, then evaluate this faculty member.', 'Student / Evaluation')}
    <div class="panel evaluation-details"><div class="evaluation-person"><span class="field-label">Faculty member</span><p>${escapeHtml(member.name)}</p><small>${escapeHtml(member.department)} / ${escapeHtml(member.facultyId)}</small></div><div class="field"><label class="field-label" for="evaluation-subject">Subject</label><select id="evaluation-subject">${member.subjects.map(subject => `<option ${subject === selectedSubject ? 'selected' : ''}>${escapeHtml(subject)}</option>`).join('')}</select></div><div class="rating-guide">${ratingNames.map((name, index) => `<span><strong>${index + 1}</strong> ${name}</span>`).join('')}</div></div>
    <form id="evaluation-form" novalidate>${categories.map(category => { const questions = evaluationQuestions.filter(question => question.category === category); if (!questions.length) return ''; return `<section class="evaluation-category"><h2>${category}</h2>${questions.map(question => { number++; return `<fieldset class="rating-question" id="rating-question-${question.id}"><legend>${number}. ${escapeHtml(question.text)}</legend><div class="rating-options">${ratingNames.map((name, index) => `<label class="rating-option"><input type="radio" name="question-${question.id}" value="${index + 1}" required aria-label="${index + 1} - ${name}"><span>${index + 1}<small>${name}</small></span></label>`).join('')}</div></fieldset>`; }).join('')}</section>`; }).join('')}<section class="evaluation-category"><h2>Additional feedback</h2><div class="field"><label class="field-label" for="constructive-suggestions">Provide constructive suggestions</label><p class="question-category">Examples: pacing of lectures, clarity of assignments, availability for help, or use of class time.</p><textarea id="constructive-suggestions" name="suggestions" maxlength="1500" rows="5" placeholder="Share your suggestions for this faculty member and subject (optional)."></textarea></div></section><p class="error" id="evaluation-error" role="alert"></p><div class="submit-row"><p>Answer all ${evaluationQuestions.length} questions.<br>Your evaluation can only be submitted once for this subject.</p><div class="actions"><button class="button secondary" type="button" data-page="dashboard">Back</button><button class="button" type="submit">Submit Evaluation</button></div></div></form>`;
}

async function submitEvaluation(event) {
  event.preventDefault();
  if (currentUser?.role !== 'student') return;
  try { await refreshDatabaseState(); }
  catch (error) { document.getElementById('evaluation-error').textContent = error.message; return; }
  if (hasSubmitted()) return renderPage('confirmation');
  // If the admin changed questions in another tab, refresh the form before saving.
  if (JSON.stringify(evaluationQuestions) !== JSON.stringify(getQuestions())) {
    renderPage('evaluation');
    const message = document.getElementById('evaluation-error');
    if (message) message.textContent = 'The questions were updated. Please complete the refreshed form.';
    return;
  }
  if (!evaluationQuestions.length) return;
  const answers = [];
  let firstMissing = null;
  evaluationQuestions.forEach(question => {
    const selected = document.querySelector(`input[name="question-${question.id}"]:checked`);
    const rating = selected ? Number(selected.value) : 0;
    const missing = !Number.isInteger(rating) || rating < 1 || rating > 5;
    document.getElementById(`rating-question-${question.id}`).classList.toggle('unanswered', missing);
    if (missing && !firstMissing) firstMissing = question;
    if (!missing) answers.push({ questionId: question.id, text: question.text, category: question.category, rating });
  });
  if (firstMissing) {
    const message = document.getElementById('evaluation-error');
    message.textContent = 'Please answer every question before submitting.';
    const missingQuestion = document.getElementById(`rating-question-${firstMissing.id}`);
    missingQuestion.appendChild(message);
    document.querySelector(`input[name="question-${firstMissing.id}"]`).setAttribute('aria-describedby', 'evaluation-error');
    document.querySelector(`input[name="question-${firstMissing.id}"]`).focus();
    return;
  }
  const suggestions = document.getElementById('constructive-suggestions').value.trim();
  try {
    await apiRequest('/api/evaluations', { method: 'POST', body: { facultyId: evaluationTarget.facultyId, subject: evaluationTarget.subject, answers, suggestions } });
    await refreshDatabaseState();
    renderPage('confirmation');
  } catch (error) {
    const message = document.getElementById('evaluation-error');
    message.textContent = error.message;
    document.querySelector('.evaluation-category')?.prepend(message);
  }
}

function renderConfirmation() {
  return `${pageHeading('Your feedback makes a difference.', 'One step toward a better learning experience.', 'Student / Evaluation')}
    <div class="panel confirmation"><div class="confirmation-symbol" aria-hidden="true">✓</div><span class="eyebrow">${escapeHtml(evaluationTarget?.name || "")} / ${escapeHtml(evaluationTarget?.subject || "")}</span><h2>Evaluation Submitted</h2><p>Thank you for providing your feedback.</p><p class="muted">Your evaluation has been saved. No further action is needed.</p><button class="button" data-page="dashboard">Back to Dashboard ↗</button></div>`;
}

async function initialize() {
  try {
    await refreshDatabaseState();
    if (currentUser) renderPage('dashboard');
    else renderLogin();
  } catch (error) {
    app.innerHTML = `<main class="login-shell"><section class="login-form-area"><div class="login-card"><span class="eyebrow">Faculty Evaluation System</span><h1>Start the local database server</h1><p class="subtitle">From the project folder, run <code>python server.py</code>, then open <code>http://127.0.0.1:8000</code>.</p></div></section></main>`;
  }
}

initialize();
