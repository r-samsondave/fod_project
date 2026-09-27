// School prototype only: never use hardcoded passwords in production.
// Real applications require server-side authentication and authorization.
const accounts = [
  { name: 'Juan Dela Cruz', username: 'student', password: 'student123', role: 'student' },
  { name: 'Guidance Administrator', username: 'admin', password: 'admin123', role: 'admin' },
  { name: 'Ruby Cruz', username: 'rubycruz', password: 'ruby123', role: 'faculty', facultyId: 'FAC-001', department: 'Computer Studies' }
];
const categories = ['Teaching Effectiveness', 'Communication', 'Classroom Management', 'Professionalism'];
const defaultQuestions = [
  { id: 1, category: categories[0], text: 'The instructor explains lessons clearly.' },
  { id: 2, category: categories[0], text: 'The instructor demonstrates good knowledge of the subject.' },
  { id: 3, category: categories[0], text: 'The instructor uses effective teaching methods.' },
  { id: 4, category: categories[1], text: 'The instructor communicates instructions clearly.' },
  { id: 5, category: categories[1], text: 'The instructor responds appropriately to student questions.' },
  { id: 6, category: categories[2], text: 'The instructor manages class time effectively.' },
  { id: 7, category: categories[2], text: 'The instructor maintains an organized learning environment.' },
  { id: 8, category: categories[3], text: 'The instructor treats students respectfully.' },
  { id: 9, category: categories[3], text: 'The instructor comes prepared for class.' },
  { id: 10, category: categories[3], text: 'The instructor demonstrates professional behavior.' }
];
const storageKeys = { questions: 'facultyEvaluationQuestions', responses: 'facultyEvaluationResponses' };
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

function loadFromLocalStorage(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved === null ? fallback : JSON.parse(saved);
  } catch (error) {
    return fallback;
  }
}

function saveToLocalStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    alert('Your browser could not save this change. Enable local storage or free up browser storage, then try again.');
    return false;
  }
}

function getQuestions() {
  return loadFromLocalStorage(storageKeys.questions, defaultQuestions);
}

function getResponses() {
  return loadFromLocalStorage(storageKeys.responses, []).filter(response => response.facultyId === 'FAC-001');
}

function hasSubmitted() {
  // There is exactly one student and one faculty evaluation in this prototype.
  // The saved response is also the completion record; no student name is stored.
  return getResponses().length > 0;
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
  return '<div class="brand"><span class="brand-mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 20V4h16M4 11h13M10 20V4M10 17h10"/></svg></span><span>FACULTY<br>EVALUATION</span></div>';
}

function renderLogin() {
  document.title = 'Sign in | Faculty Evaluation';
  app.innerHTML = `<main class="login-page" id="main-content">
    <section class="login-story" aria-labelledby="login-title">
      ${brand()}
      <div class="login-intro">
        <div class="editorial-rule"></div><span class="eyebrow">Faculty Evaluation System</span>
        <h1 id="login-title">Evaluate.<br>Improve.<br>Grow.</h1>
        <p>Better learning starts with a conversation. Your feedback helps shape what comes next.</p>
        <div class="principles"><div><span>01 / REFLECT</span><strong>Share your experience.</strong></div><div><span>02 / UNDERSTAND</span><strong>Find room to improve.</strong></div><div><span>03 / GROW</span><strong>Move forward together.</strong></div></div>
      </div>
      <p class="login-foot">A thoughtful approach to better teaching.</p>
    </section>
    <section class="login-form-area" aria-labelledby="signin-title"><div class="login-card">
      <span class="eyebrow">Your academic workspace</span><h2 id="signin-title">Welcome back.</h2>
      <p class="subtitle">Sign in to your faculty evaluation account.</p>
      <form id="login-form">
        <div class="field"><label class="field-label" for="username">Username</label><input id="username" name="username" autocomplete="username" placeholder="Enter your username" required></div>
        <div class="field"><label class="field-label" for="password">Password</label><div class="password-field"><input id="password" name="password" type="password" autocomplete="current-password" placeholder="Enter your password" required><button type="button" class="password-toggle" id="toggle-password" aria-label="Show password" aria-pressed="false">Show</button></div></div>
        <p id="login-error" class="error" role="alert"></p>
        <button class="button full-width" type="submit">Log in <span aria-hidden="true">↗</span></button>
      </form>
      <div class="demo-accounts"><div class="demo-heading"><span class="eyebrow">Demo accounts</span><span class="demo-tag">PROTOTYPE</span></div>
        <div class="account-row"><span>Student</span><code>student / student123</code></div>
        <div class="account-row"><span>Guidance Office</span><code>admin / admin123</code></div>
        <div class="account-row"><span>Faculty</span><code>rubycruz / ruby123</code></div>
        <p class="demo-note">Use a demo account above. Your workspace is assigned automatically.</p>
      </div>
    </div></section>
  </main>`;
  document.getElementById('login-form').addEventListener('submit', login);
  document.getElementById('toggle-password').addEventListener('click', function () {
    const input = document.getElementById('password');
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    this.textContent = show ? 'Hide' : 'Show';
    this.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    this.setAttribute('aria-pressed', String(show));
  });
}

function login(event) {
  event.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const account = accounts.find(user => user.username === username && user.password === password);
  if (!account) {
    document.getElementById('login-error').textContent = 'Invalid username or password.';
    return;
  }
  try {
    sessionStorage.setItem('currentUser', JSON.stringify({ username: account.username }));
  } catch (error) {
    document.getElementById('login-error').textContent = 'Enable browser session storage to log in.';
    return;
  }
  currentUser = account;
  renderPage('dashboard');
}

function logout() {
  sessionStorage.removeItem('currentUser');
  currentUser = null;
  evaluationQuestions = [];
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
  if (page === 'evaluation') content = hasSubmitted() ? renderConfirmation() : renderEvaluation();
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
      <main class="page" id="main-content">${content}<footer class="page-footer"><span>Faculty Evaluation System</span><span>School prototype · Stored in this browser</span></footer></main>
    </div></div>`;
  document.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => renderPage(button.dataset.page)));
  document.getElementById('logout').addEventListener('click', logout);
  document.getElementById('menu-toggle').addEventListener('click', function () {
    const open = document.querySelector('.sidebar').classList.toggle('open');
    this.setAttribute('aria-expanded', String(open));
  });
  if (page === 'questions') bindQuestionActions();
  document.getElementById('evaluation-form')?.addEventListener('submit', submitEvaluation);
  document.querySelector('h1')?.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

function renderDashboard() {
  if (currentUser.role === 'student') return renderStudentDashboard();
  if (currentUser.role === 'admin') return renderAdminDashboard();
  return renderFacultyDashboard();
}

function renderStudentDashboard() {
  const completed = hasSubmitted();
  const questionCount = getQuestions().length;
  return `${pageHeading('Welcome, Juan.', 'A few thoughtful answers can make a lasting difference.', 'Student dashboard')}
    <div class="stats">${stat('Available faculty', '01', 'Computer Studies')}${stat('Evaluations completed', completed ? '01' : '00', 'Of 1 assigned evaluation')}${stat('Evaluation period', 'Active', 'Your feedback is welcome')}</div>
    <div class="section-heading"><h2>Available Evaluation</h2><span>01 faculty member</span></div>
    <div class="panel faculty-card"><div class="faculty-avatar" aria-hidden="true">RC</div><div class="faculty-details"><span class="eyebrow">FAC-001</span><h3>Ruby Cruz</h3><p>Computer Studies</p></div>
      <div class="card-action"><span class="badge ${completed ? 'complete' : ''}">${completed ? '✓ Completed' : 'Not Completed'}</span><button class="button" data-page="evaluation" ${!questionCount && !completed ? 'disabled' : ''}>${completed ? 'View confirmation' : 'Start Evaluation'} <span aria-hidden="true">↗</span></button></div></div>
    ${!questionCount && !completed ? '<p class="subtitle">No questions are available yet. Please check back later.</p>' : ''}
    <div class="info-grid section"><div class="note"><span class="eyebrow">01 / Be thoughtful</span><h3>Your perspective matters.</h3><p>Reflect on your classroom experience. Rate each statement honestly on a scale of 1 to 5.</p></div><div class="note"><span class="eyebrow">02 / Share with confidence</span><h3>Feedback, with purpose.</h3><p>Your name is not shown in faculty results. You can submit once, so review your answers before sending.</p></div></div>`;
}

function renderAdminDashboard() {
  const count = getResponses().length;
  return `${pageHeading('A clearer view of teaching.', 'Manage evaluations and turn student feedback into understanding.', 'Guidance Office / Dashboard')}
    <div class="stats four">${stat('Total Faculty', '1', 'Active faculty member')}${stat('Total Students', '1', 'Demo student account')}${stat('Evaluation Questions', getQuestions().length, 'Across 4 categories')}${stat('Submitted Evaluations', count, 'Of 1 student')}</div>
    <div class="section-heading"><h2>Evaluation overview</h2><button class="text-button" data-page="results">View results ↗</button></div>
    <div class="panel faculty-card"><div class="faculty-avatar" aria-hidden="true">RC</div><div class="faculty-details"><span class="eyebrow">Computer Studies</span><h3>Ruby Cruz</h3><p>FAC-001 · ${count} ${count === 1 ? 'response' : 'responses'} received</p></div><span class="badge complete">Active</span></div>
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
  return `<div class="stats">${stat('Overall Rating', `${formatRating(calculateOverallAverage())} <small>/ 5.00</small>`, 'Average of all submitted ratings')}${stat('Responses', getResponses().length, 'Total student responses')}${stat('Evaluation Status', 'Active', 'Computer Studies')}</div>`;
}

function renderFacultyDashboard() {
  return `${pageHeading('Welcome, Ruby.', 'A space to reflect on your teaching and see where you shine.', 'Faculty dashboard')}
    <div class="section-heading"><h2>Evaluation Overview</h2><span>FAC-001</span></div>${resultStats()}
    ${getResponses().length ? '<div class="panel"><h2>Your feedback is ready.</h2><p class="subtitle">Explore how students rated each of the four evaluation categories.</p><div class="section"><button class="button" data-page="results">View My Results ↗</button></div></div>' : emptyState('No evaluations have been submitted yet.', 'Your overview will update after a student submits an evaluation.')}
    <div class="note section"><h3>A little reflection. Meaningful progress.</h3><p>Results show aggregate ratings only. Student identities are not displayed.</p></div>`;
}

function renderResults() {
  if (!['admin', 'faculty'].includes(currentUser.role)) return '';
  const responses = getResponses();
  return `${pageHeading(currentUser.role === 'faculty' ? 'Your teaching, reflected.' : 'Faculty results.', 'Ruby Cruz · Computer Studies · FAC-001', 'Evaluation results')}${resultStats()}
    <div class="section-heading"><h2>Category averages</h2><span>Scale of 1–5</span></div>
    ${responses.length ? `<div class="panel">${categories.map(category => {
      const average = calculateCategoryAverage(category, responses);
      return `<div class="result-category"><div class="result-category-label"><span>${category}</span><strong>${formatRating(average)} <small>/ 5.00</small></strong></div><div class="result-bar" aria-hidden="true"><div class="result-bar-fill" style="width:${average === null ? 0 : average / 5 * 100}%"></div></div>${average === null ? '<p class="question-category">No ratings for this category.</p>' : ''}</div>`;
    }).join('')}</div>` : emptyState(currentUser.role === 'faculty' ? 'No evaluations have been submitted yet.' : 'No evaluation data available.', 'Total Responses: 0. Submitted feedback will appear here automatically.')}
    <div class="note section"><h3>About these results</h3><p>Category scores average all ratings in that category. The overall score averages all submitted question ratings. Results are rounded to two decimal places; student names are never displayed.</p></div>`;
}

function renderFaculty() {
  if (currentUser.role !== 'admin') return '';
  return `${pageHeading('Faculty directory.', 'The faculty member participating in this evaluation period.', 'Guidance Office / Faculty')}
    <div class="section-heading"><h2>All faculty</h2><span>1 member</span></div><div class="table-wrap"><table><caption class="eyebrow">Participating faculty</caption><thead><tr><th scope="col">Faculty member</th><th scope="col">Faculty ID</th><th scope="col">Department</th><th scope="col">Status</th><th scope="col">Results</th></tr></thead><tbody><tr><td><strong>Ruby Cruz</strong></td><td>FAC-001</td><td>Computer Studies</td><td><span class="badge complete">Active</span></td><td><button class="text-button" data-page="results">View results ↗</button></td></tr></tbody></table></div>`;
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
  document.getElementById('question-form').addEventListener('submit', event => {
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
    if (saveToLocalStorage(storageKeys.questions, questions)) renderPage('questions');
  });
}

function deleteQuestion(id) {
  if (currentUser?.role !== 'admin') return;
  if (!confirm('Delete this question? Existing submitted results will be preserved.')) return;
  if (saveToLocalStorage(storageKeys.questions, getQuestions().filter(question => question.id !== id))) renderPage('questions');
}

function renderEvaluation() {
  if (currentUser.role !== 'student') return '';
  evaluationQuestions = getQuestions();
  if (!evaluationQuestions.length) return `${pageHeading('Faculty Evaluation', 'Ruby Cruz · Computer Studies')}${emptyState('No questions have been created.', 'Please check back when the Guidance Office has added questions.')}`;
  const ratingNames = ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];
  let number = 0;
  return `${pageHeading('Faculty Evaluation', 'Please evaluate the faculty member honestly based on your experience.', 'Student / Evaluation')}
    <div class="panel"><h2>Ruby Cruz</h2><p class="subtitle">Computer Studies · FAC-001</p><div class="rating-guide">${ratingNames.map((name, index) => `<span><strong>${index + 1}</strong> ${name}</span>`).join('')}</div></div>
    <form id="evaluation-form" novalidate>${categories.map(category => {
      const questions = evaluationQuestions.filter(question => question.category === category);
      if (!questions.length) return '';
      return `<section class="evaluation-category"><h2>${category}</h2>${questions.map(question => {
        number++;
        return `<fieldset class="rating-question" id="rating-question-${question.id}"><legend>${number}. ${escapeHtml(question.text)}</legend><div class="rating-options">${ratingNames.map((name, index) => `<label class="rating-option"><input type="radio" name="question-${question.id}" value="${index + 1}" required aria-label="${index + 1} — ${name}"><span>${index + 1}<small>${name}</small></span></label>`).join('')}</div></fieldset>`;
      }).join('')}</section>`;
    }).join('')}<p class="error" id="evaluation-error" role="alert"></p><div class="submit-row"><p>Answer all ${evaluationQuestions.length} questions.<br>Your evaluation can only be submitted once.</p><div class="actions"><button class="button secondary" type="button" data-page="dashboard">Back</button><button class="button" type="submit">Submit Evaluation ↗</button></div></div></form>`;
}

function submitEvaluation(event) {
  event.preventDefault();
  if (currentUser?.role !== 'student') return;
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
  const response = { facultyId: 'FAC-001', submittedAt: new Date().toISOString(), answers };
  response.overallAverage = calculateOverallAverage([response]);
  if (saveToLocalStorage(storageKeys.responses, [response])) renderPage('confirmation');
}

function renderConfirmation() {
  return `${pageHeading('Your feedback makes a difference.', 'One step toward a better learning experience.', 'Student / Evaluation')}
    <div class="panel confirmation"><div class="confirmation-symbol" aria-hidden="true">✓</div><span class="eyebrow">Ruby Cruz · Computer Studies</span><h2>Evaluation Submitted</h2><p>Thank you for providing your feedback.</p><p class="muted">Your evaluation has been saved. No further action is needed.</p><button class="button" data-page="dashboard">Back to Dashboard ↗</button></div>`;
}

function initialize() {
  if (loadFromLocalStorage(storageKeys.questions, null) === null) saveToLocalStorage(storageKeys.questions, defaultQuestions);
  try {
    const session = JSON.parse(sessionStorage.getItem('currentUser'));
    currentUser = accounts.find(account => account.username === session?.username) || null;
  } catch (error) {
    currentUser = null;
  }
  if (currentUser) renderPage('dashboard');
  else renderLogin();
}

// Keep results fresh if another tab submits feedback. Preserve forms being edited.
window.addEventListener('storage', event => {
  if (!currentUser || !Object.values(storageKeys).includes(event.key)) return;
  if (currentPage === 'evaluation' || currentPage === 'questions') return;
  renderPage(currentPage);
});

initialize();
