/* =========================================================
   CONTENTFLOW — APP LOGIC
   Vanilla JavaScript, organized by section.
   Backed entirely by Supabase (no localStorage).
   ========================================================= */

/* =========================================================
   SUPABASE
   ========================================================= */

const SUPABASE_URL = 'https://lbddawmtbrxoqhxqgdaw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_iU8lq4qlevln9vRYxlJzWg_BBkwR0Go';

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

/* ============================================================
   1. STATE
   ============================================================ */
let projects = [];
let tasks = [];
let ideas = [];
let people = [];
let assignedTasks = [];

let currentView = 'dashboard';      // dashboard | calendar | ideas | people | projects
let calendarView = 'month';         // month | week | year
let currentDate = new Date();       // the date the calendar is centered on
let calProjectFilter = 'all';       // 'all' or a project id
let ideaTypeFilter = 'All';
let editingIdeaId = null;

const CONTENT_TYPES = ['Reel', 'Carousel', 'Story', 'Static Post'];
const NON_CONTENT_TYPES = ['Event', 'Meeting', 'Other'];
const CONTENT_STAGES = ['Idea', 'Planned', 'Creating', 'Ready', 'Posted'];
const NON_CONTENT_STAGES = ['To Do', 'In Progress', 'Done'];

const COLOR_PALETTE = [
  '#7A8F72', // sage green
  '#8B6F47', // brown
  '#C48B9F', // dusty rose
  '#6B8CAE', // blue
  '#D4A857', // mustard
  '#C46B4F', // terracotta
  '#9B8AA6', // lavender
  '#5F9E93'  // teal
];

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

/* ============================================================
   2. UTILITIES
   ============================================================ */
function formatDateKey(date) {
  // Returns YYYY-MM-DD using local time (avoids timezone shifting bugs)
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function todayKey() {
  return formatDateKey(new Date());
}

function getProjectById(id) {
  return projects.find(p => p.id === id) || null;
}

function getStageOptionsFor(contentType) {
  return CONTENT_TYPES.includes(contentType) ? CONTENT_STAGES : NON_CONTENT_STAGES;
}

function getTasksForDate(dateKey) {
  return tasks
    .filter(t => t.date === dateKey)
    .filter(t => calProjectFilter === 'all' || t.projectId === calProjectFilter);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : str;
  return div.innerHTML;
}

function showError(message, err) {
  console.error(message, err);
  alert(message + (err && err.message ? `\n\n${err.message}` : ''));
}

/* ============================================================
   3. SUPABASE — LOAD + ROW MAPPERS
   ============================================================ */

// snake_case (Supabase row) -> camelCase (app object)
function mapProjectRow(p) {
  return { id: p.id, name: p.name, color: p.color };
}
function mapTaskRow(t) {
  return {
    id: t.id,
    name: t.name,
    projectId: t.project_id,
    contentType: t.content_type,
    stage: t.stage,
    date: t.date,
    time: t.time || '',
    notes: t.notes || ''
  };
}
function mapIdeaRow(i) {
  return {
    id: i.id,
    title: i.title,
    description: i.description || '',
    projectId: i.project_id,
    contentType: i.content_type,
    tags: i.tags || [],
    dateAdded: i.date_added
  };
}
function mapPersonRow(p) {
  return { id: p.id, name: p.name, projectId: p.project_id };
}
function mapAssignedTaskRow(t) {
  return {
    id: t.id,
    name: t.name,
    personId: t.person_id,
    projectId: t.project_id,
    deadline: t.deadline || '',
    completed: !!t.completed
  };
}

async function loadFromSupabase() {
  const [
    projectsResult,
    tasksResult,
    ideasResult,
    peopleResult,
    assignedTasksResult
  ] = await Promise.all([
    supabaseClient.from('projects').select('*').order('created_at', { ascending: true }),
    supabaseClient.from('tasks').select('*').order('created_at', { ascending: true }),
    supabaseClient.from('ideas').select('*').order('created_at', { ascending: true }),
    supabaseClient.from('people').select('*').order('created_at', { ascending: true }),
    supabaseClient.from('assigned_tasks').select('*').order('created_at', { ascending: true })
  ]);

  if (projectsResult.error) throw projectsResult.error;
  if (tasksResult.error) throw tasksResult.error;
  if (ideasResult.error) throw ideasResult.error;
  if (peopleResult.error) throw peopleResult.error;
  if (assignedTasksResult.error) throw assignedTasksResult.error;

  projects = (projectsResult.data || []).map(mapProjectRow);
  tasks = (tasksResult.data || []).map(mapTaskRow);
  ideas = (ideasResult.data || []).map(mapIdeaRow);
  people = (peopleResult.data || []).map(mapPersonRow);
  assignedTasks = (assignedTasksResult.data || []).map(mapAssignedTaskRow);
}

/* ============================================================
   4. NAVIGATION
   ============================================================ */
function initNavigation() {
  document.querySelectorAll('.nav-item, .mobile-nav-item').forEach(el => {
    el.addEventListener('click', () => switchView(el.dataset.view));
  });
}

function switchView(viewName) {
  currentView = viewName;

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`${viewName}-view`).classList.add('active');

  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === viewName);
  });
  document.querySelectorAll('.mobile-nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === viewName);
  });

  renderCurrentView();
}

function renderCurrentView() {
  if (currentView === 'dashboard') renderDashboard();
  else if (currentView === 'calendar') renderCalendar();
  else if (currentView === 'ideas') renderIdeas();
  else if (currentView === 'people') renderPeople();
  else if (currentView === 'projects') renderProjects();
}

/* Re-render whatever is currently visible, plus shared bits like selects */
function renderAll() {
  populateProjectSelects();
  renderProjectFilterList();
  renderLegend();
  renderCurrentView();
}

/* ============================================================
   5. SHARED: PROJECT SELECTS / FILTERS / LEGEND
   ============================================================ */
function populateProjectSelects() {
  const selects = [
    document.getElementById('taskProject'),
    document.getElementById('ideaProject'),
    document.getElementById('ideaToCalendarProject')
  ];
  selects.forEach(sel => {
    if (!sel) return;
    const prevValue = sel.value;
    sel.innerHTML = projects.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
    if (prevValue) sel.value = prevValue;
  });

  // Selects that allow "none"
  const optionalSelects = [
    document.getElementById('personProject'),
    document.getElementById('assignedTaskProject')
  ];
  optionalSelects.forEach(sel => {
    if (!sel) return;
    const prevValue = sel.value;
    sel.innerHTML = '<option value="">— none —</option>' +
      projects.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
    if (prevValue) sel.value = prevValue;
  });

  // Idea project filter (has an "All" option)
  const ideaFilter = document.getElementById('ideaProjectFilter');
  if (ideaFilter) {
    const prevValue = ideaFilter.value;
    ideaFilter.innerHTML = '<option value="all">All projects</option>' +
      projects.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
    ideaFilter.value = prevValue || 'all';
  }

  // Assigned task person select
  const personSelect = document.getElementById('assignedTaskPerson');
  if (personSelect) {
    const prevValue = personSelect.value;
    personSelect.innerHTML = people.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
    if (prevValue) personSelect.value = prevValue;
  }
}

function renderProjectFilterList() {
  const container = document.getElementById('calProjectFilterList');
  if (!container) return;
  let html = `<button class="filter-chip ${calProjectFilter === 'all' ? 'active' : ''}" data-pid="all">All</button>`;
  projects.forEach(p => {
    html += `<button class="filter-chip ${calProjectFilter === p.id ? 'active' : ''}" data-pid="${p.id}">
      <span class="chip-dot" style="background:${p.color}"></span>${escapeHtml(p.name)}
    </button>`;
  });
  container.innerHTML = html;

  container.querySelectorAll('.filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      calProjectFilter = btn.dataset.pid;
      renderProjectFilterList();
      renderCalendar();
    });
  });
}

function renderLegend() {
  const legend = document.getElementById('calLegend');
  if (!legend) return;
  legend.innerHTML = projects.map(p => `
    <span class="legend-item"><span class="legend-dot" style="background:${p.color}"></span>${escapeHtml(p.name)}</span>
  `).join('');
}

/* ============================================================
   6. CALENDAR — RENDER DISPATCH
   ============================================================ */
function initCalendarControls() {
  document.getElementById('calPrevBtn').addEventListener('click', () => shiftCalendar(-1));
  document.getElementById('calNextBtn').addEventListener('click', () => shiftCalendar(1));
  document.getElementById('calTodayBtn').addEventListener('click', () => {
    currentDate = new Date();
    renderCalendar();
  });

  document.querySelectorAll('.view-switch-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      calendarView = btn.dataset.cview;
      document.querySelectorAll('.view-switch-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderCalendar();
    });
  });
}

function shiftCalendar(direction) {
  if (calendarView === 'month') {
    currentDate.setMonth(currentDate.getMonth() + direction);
  } else if (calendarView === 'week') {
    currentDate.setDate(currentDate.getDate() + direction * 7);
  } else if (calendarView === 'year') {
    currentDate.setFullYear(currentDate.getFullYear() + direction);
  }
  currentDate = new Date(currentDate); // force fresh object
  renderCalendar();
}

function renderCalendar() {
  renderProjectFilterList();
  renderLegend();
  const grid = document.getElementById('calendarGrid');
  const label = document.getElementById('calCurrentLabel');

  if (calendarView === 'month') {
    label.textContent = `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    grid.innerHTML = buildMonthView();
  } else if (calendarView === 'week') {
    const { start, end } = getWeekRange(currentDate);
    label.textContent = `${MONTH_NAMES[start.getMonth()]} ${start.getDate()} – ${MONTH_NAMES[end.getMonth()]} ${end.getDate()}`;
    grid.innerHTML = buildWeekView();
  } else if (calendarView === 'year') {
    label.textContent = `${currentDate.getFullYear()}`;
    grid.innerHTML = buildYearView();
  }

  attachCalendarCellHandlers();
}

/* ---------- MONTH VIEW ---------- */
function buildMonthView() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay(); // 0 = Sunday
  const gridStart = new Date(year, month, 1 - startOffset);

  let html = '<div class="month-grid">';
  WEEKDAY_NAMES.forEach(w => { html += `<div class="weekday-label">${w}</div>`; });

  for (let i = 0; i < 42; i++) {
    const cellDate = new Date(gridStart);
    cellDate.setDate(gridStart.getDate() + i);
    const key = formatDateKey(cellDate);
    const isOtherMonth = cellDate.getMonth() !== month;
    const isToday = key === todayKey();
    const dayTasks = getTasksForDate(key);

    html += `<div class="day-cell ${isOtherMonth ? 'other-month' : ''} ${isToday ? 'is-today' : ''}" data-date="${key}">
      <div class="day-number">${cellDate.getDate()}</div>`;

    const visible = dayTasks.slice(0, 3);
    visible.forEach(t => {
      const project = getProjectById(t.projectId);
      const color = project ? project.color : '#8A8C83';
      html += `<div class="day-task-chip" style="border-color:${color}">${escapeHtml(t.name)}</div>`;
    });
    if (dayTasks.length > 3) {
      html += `<div class="day-more-label">+ ${dayTasks.length - 3} more</div>`;
    }

    html += `</div>`;

    // stop once we've filled at least 5 full weeks and passed the month
    if (i >= 34 && cellDate.getMonth() !== month) break;
  }

  html += '</div>';
  return html;
}

/* ---------- WEEK VIEW ---------- */
function getWeekRange(date) {
  const start = new Date(date);
  const day = start.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day; // week starts Monday
  start.setDate(start.getDate() + diffToMonday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

function buildWeekView() {
  const { start } = getWeekRange(currentDate);
  const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  let html = '<div class="week-grid">';
  for (let i = 0; i < 7; i++) {
    const cellDate = new Date(start);
    cellDate.setDate(start.getDate() + i);
    const key = formatDateKey(cellDate);
    const isToday = key === todayKey();
    const dayTasks = getTasksForDate(key);

    html += `<div class="week-day-col ${isToday ? 'is-today' : ''}" data-date="${key}">
      <div class="week-day-header">${dayOrder[i]}<br><span class="wd-date">${cellDate.getDate()}</span></div>`;

    if (dayTasks.length === 0) {
      html += `<div class="empty-state">No tasks</div>`;
    } else {
      dayTasks.forEach(t => {
        const project = getProjectById(t.projectId);
        const color = project ? project.color : '#8A8C83';
        html += `<div class="day-task-chip" style="border-color:${color}; margin-bottom:5px;">${escapeHtml(t.name)}</div>`;
      });
    }

    html += `</div>`;
  }
  html += '</div>';
  return html;
}

/* ---------- YEAR VIEW ---------- */
function buildYearView() {
  const year = currentDate.getFullYear();
  let html = '<div class="year-grid">';

  for (let m = 0; m < 12; m++) {
    const firstOfMonth = new Date(year, m, 1);
    const startOffset = firstOfMonth.getDay();
    const gridStart = new Date(year, m, 1 - startOffset);

    html += `<div class="mini-month" data-month="${m}">
      <div class="mini-month-title">${MONTH_NAMES[m]}</div>
      <div class="mini-month-grid">`;

    for (let i = 0; i < 42; i++) {
      const cellDate = new Date(gridStart);
      cellDate.setDate(gridStart.getDate() + i);
      const key = formatDateKey(cellDate);
      const isOtherMonth = cellDate.getMonth() !== m;
      const isToday = key === todayKey();
      const dayTasks = isOtherMonth ? [] : getTasksForDate(key);

      const uniqueProjectColors = [...new Set(dayTasks.map(t => {
        const proj = getProjectById(t.projectId);
        return proj ? proj.color : '#8A8C83';
      }))].slice(0, 3);

      html += `<div class="mini-day ${isOtherMonth ? 'other-month' : ''} ${isToday ? 'is-today' : ''}">
        ${cellDate.getDate()}
        <div class="mini-day-dots">${uniqueProjectColors.map(c => `<span class="mini-day-dot" style="background:${c}"></span>`).join('')}</div>
      </div>`;

      if (i >= 34 && cellDate.getMonth() !== m) break;
    }

    html += `</div></div>`;
  }

  html += '</div>';
  return html;
}

/* ---------- CELL CLICK HANDLERS ---------- */
function attachCalendarCellHandlers() {
  document.querySelectorAll('.day-cell[data-date], .week-day-col[data-date]').forEach(cell => {
    cell.addEventListener('click', () => openDatePanel(cell.dataset.date));
  });
  document.querySelectorAll('.mini-month[data-month]').forEach(cell => {
    cell.addEventListener('click', () => {
      currentDate = new Date(currentDate.getFullYear(), Number(cell.dataset.month), 1);
      calendarView = 'month';
      document.querySelectorAll('.view-switch-btn').forEach(b => b.classList.remove('active'));
      document.getElementById('viewMonthBtn').classList.add('active');
      renderCalendar();
    });
  });
}

/* ============================================================
   7. DATE SIDE PANEL
   ============================================================ */
let activeDateKey = null;

function openDatePanel(dateKey) {
  activeDateKey = dateKey;
  const d = new Date(dateKey + 'T00:00:00');
  document.getElementById('datePanelTitle').textContent =
    `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;

  renderDatePanelTasks();

  document.getElementById('datePanel').classList.add('open');
  document.getElementById('overlay').classList.add('open');
}

function closeDatePanel() {
  document.getElementById('datePanel').classList.remove('open');
  document.getElementById('overlay').classList.remove('open');
  activeDateKey = null;
}

function renderDatePanelTasks() {
  const container = document.getElementById('datePanelContent');
  const dayTasks = tasks.filter(t => t.date === activeDateKey);

  if (dayTasks.length === 0) {
    container.innerHTML = '<p class="empty-state">No tasks yet for this date.</p>';
    return;
  }

  container.innerHTML = dayTasks.map(t => renderTaskCard(t)).join('');
  attachTaskCardHandlers(container);
}

function renderTaskCard(t) {
  const project = getProjectById(t.projectId);
  const color = project ? project.color : '#8A8C83';
  const stages = getStageOptionsFor(t.contentType);
  const currentIndex = stages.indexOf(t.stage);

  const stepsHtml = stages.map((s, i) => {
    let cls = '';
    if (i < currentIndex) cls = 'done';
    else if (i === currentIndex) cls = 'current';
    return `<span class="pipeline-step ${cls}" data-taskid="${t.id}" data-stage="${s}">${s}</span>`;
  }).join('');

  return `
    <div class="task-card" style="border-left-color:${color}">
      <div class="task-card-top">
        <div>
          <div class="task-card-name">${escapeHtml(t.name)}</div>
          <div class="task-card-meta">${project ? escapeHtml(project.name) : 'No project'} · ${escapeHtml(t.contentType)}${t.time ? ' · ' + t.time : ''}</div>
        </div>
        <div class="task-card-actions">
          <button class="icon-btn edit-task-btn" data-taskid="${t.id}" title="Edit">✎</button>
          <button class="icon-btn delete-task-btn" data-taskid="${t.id}" title="Delete">🗑</button>
        </div>
      </div>
      ${t.notes ? `<div class="task-card-notes">${escapeHtml(t.notes)}</div>` : ''}
      <div class="pipeline-steps">${stepsHtml}</div>
    </div>
  `;
}

function attachTaskCardHandlers(container) {
  container.querySelectorAll('.edit-task-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const task = tasks.find(t => t.id === btn.dataset.taskid);
      if (task) openTaskModal(task);
    });
  });
  container.querySelectorAll('.delete-task-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      showConfirm('Delete this task? This cannot be undone.', () => deleteTask(btn.dataset.taskid));
    });
  });
  container.querySelectorAll('.pipeline-step').forEach(step => {
    step.addEventListener('click', () => updateTaskStage(step.dataset.taskid, step.dataset.stage));
  });
}

async function updateTaskStage(taskId, newStage) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;
  const previousStage = task.stage;
  task.stage = newStage; // optimistic
  renderDatePanelTasks();
  renderAll();

  try {
    const { error } = await supabaseClient.from('tasks').update({ stage: newStage }).eq('id', taskId);
    if (error) throw error;
  } catch (err) {
    task.stage = previousStage; // revert on failure
    renderDatePanelTasks();
    renderAll();
    showError('Could not update the task stage.', err);
  }
}

/* ============================================================
   8. TASK MODAL (ADD / EDIT)
   ============================================================ */
function initTaskModal() {
  document.getElementById('closeTaskModal').addEventListener('click', closeTaskModal);
  document.getElementById('cancelTaskModal').addEventListener('click', closeTaskModal);
  document.getElementById('taskForm').addEventListener('submit', saveTask);
  document.getElementById('taskContentType').addEventListener('change', () => {
    populateStageSelect('taskContentType', 'taskStage');
  });
  document.getElementById('datePanelAddTaskBtn').addEventListener('click', () => {
    openTaskModal(null, activeDateKey);
  });
}

function populateStageSelect(typeSelectId, stageSelectId) {
  const type = document.getElementById(typeSelectId).value;
  const stageSelect = document.getElementById(stageSelectId);
  const prevValue = stageSelect.value;
  const stages = getStageOptionsFor(type);
  stageSelect.innerHTML = stages.map(s => `<option value="${s}">${s}</option>`).join('');
  stageSelect.value = stages.includes(prevValue) ? prevValue : stages[0];
}

function renderTaskTypeCheckboxes(selectedTypes) {
  const container = document.getElementById('taskContentTypeCheckboxes');
  const allTypes = [...CONTENT_TYPES, ...NON_CONTENT_TYPES];
  container.innerHTML = allTypes.map(t => `
    <label class="checkbox-pill">
      <input type="checkbox" value="${t}" ${selectedTypes && selectedTypes.includes(t) ? 'checked' : ''}>
      <span>${t}</span>
    </label>
  `).join('');
}

function openTaskModal(task, prefillDate) {
  populateProjectSelects();
  const isEdit = !!task;

  document.getElementById('taskModalTitle').textContent = isEdit ? 'Edit Task' : 'Add Task';
  document.getElementById('taskId').value = isEdit ? task.id : '';
  document.getElementById('taskName').value = isEdit ? task.name : '';
  document.getElementById('taskDate').value = isEdit ? task.date : (prefillDate || todayKey());
  document.getElementById('taskTime').value = isEdit && task.time ? task.time : '';
  document.getElementById('taskNotes').value = isEdit && task.notes ? task.notes : '';

  if (projects.length > 0) {
    document.getElementById('taskProject').value = isEdit ? task.projectId : projects[0].id;
  }

  const singleWrap = document.getElementById('taskContentTypeSingleWrap');
  const multiWrap = document.getElementById('taskContentTypeMultiWrap');
  const stageWrap = document.getElementById('taskStageWrap');
  const stageHint = document.getElementById('multiStageHint');
  const contentTypeSelect = document.getElementById('taskContentType');
  const stageSelect = document.getElementById('taskStage');

  if (isEdit) {
    singleWrap.style.display = '';
    multiWrap.style.display = 'none';
    stageWrap.style.display = '';
    stageHint.style.display = 'none';
    contentTypeSelect.disabled = false;
    stageSelect.disabled = false;
    contentTypeSelect.value = task.contentType;
    populateStageSelect('taskContentType', 'taskStage');
    stageSelect.value = task.stage;
  } else {
    singleWrap.style.display = 'none';
    multiWrap.style.display = '';
    stageWrap.style.display = 'none';
    stageHint.style.display = '';
    contentTypeSelect.disabled = true;
    stageSelect.disabled = true;
    renderTaskTypeCheckboxes();
  }

  document.getElementById('taskModal').classList.add('open');
  document.getElementById('overlay').classList.add('open');
}

function closeTaskModal() {
  document.getElementById('taskModal').classList.remove('open');
  if (!document.getElementById('datePanel').classList.contains('open')) {
    document.getElementById('overlay').classList.remove('open');
  }
  document.getElementById('taskForm').reset();
}

async function saveTask(e) {
  e.preventDefault();
  const id = document.getElementById('taskId').value;
  const submitBtn = e.target.querySelector('button[type="submit"]');

  const name = document.getElementById('taskName').value.trim();
  const projectId = document.getElementById('taskProject').value;
  const date = document.getElementById('taskDate').value;
  const time = document.getElementById('taskTime').value || null;
  const notes = document.getElementById('taskNotes').value.trim();

  if (!name || !projectId || !projects.length) return;

  setBusy(submitBtn, true);
  try {
    if (id) {
      // Editing an existing task: single row, single type + stage, as before.
      const row = {
        name,
        project_id: projectId,
        content_type: document.getElementById('taskContentType').value,
        stage: document.getElementById('taskStage').value,
        date, time, notes
      };
      const { data, error } = await supabaseClient.from('tasks').update(row).eq('id', id).select().single();
      if (error) throw error;
      const existing = tasks.find(t => t.id === id);
      Object.assign(existing, mapTaskRow(data));
    } else {
      // Adding a new task: one or more content types checked, each becomes its own row,
      // starting at that type's first pipeline stage, so each can be tracked separately.
      const checkedTypes = Array.from(
        document.querySelectorAll('#taskContentTypeCheckboxes input[type="checkbox"]:checked')
      ).map(cb => cb.value);

      if (checkedTypes.length === 0) {
        alert('Tick at least one content type.');
        setBusy(submitBtn, false);
        return;
      }

      const rows = checkedTypes.map(type => ({
        name,
        project_id: projectId,
        content_type: type,
        stage: getStageOptionsFor(type)[0],
        date, time, notes
      }));

      const { data, error } = await supabaseClient.from('tasks').insert(rows).select();
      if (error) throw error;
      data.forEach(r => tasks.push(mapTaskRow(r)));
    }
    closeTaskModal();
    if (activeDateKey) renderDatePanelTasks();
    renderAll();
  } catch (err) {
    showError('Could not save the task.', err);
  } finally {
    setBusy(submitBtn, false);
  }
}

async function deleteTask(id) {
  try {
    const { error } = await supabaseClient.from('tasks').delete().eq('id', id);
    if (error) throw error;
    tasks = tasks.filter(t => t.id !== id);
    if (activeDateKey) renderDatePanelTasks();
    renderAll();
  } catch (err) {
    showError('Could not delete the task.', err);
  }
}

/* ============================================================
   9. DASHBOARD
   ============================================================ */
function renderDashboard() {
  renderDashboardToday();
  renderDashboardWeekStats();
  renderDashboardPipeline();
  renderDashboardUpcoming();
  renderDashboardQuickIdeas();
}

function renderDashboardToday() {
  const container = document.getElementById('dashboardToday');
  const key = todayKey();
  const todays = tasks.filter(t => t.date === key);

  if (todays.length === 0) {
    container.innerHTML = '<p class="empty-state">Nothing scheduled today.</p>';
    return;
  }
  container.innerHTML = todays.map(t => renderMiniTaskRow(t)).join('');
}

function renderMiniTaskRow(t) {
  const project = getProjectById(t.projectId);
  const color = project ? project.color : '#8A8C83';
  return `<div class="mini-task-row"><span class="chip-dot" style="background:${color}"></span>
    <span class="mini-task-name">${escapeHtml(t.name)}</span> <span style="color:var(--muted); flex-shrink:0;">${t.date}</span></div>`;
}

function renderDashboardWeekStats() {
  const container = document.getElementById('dashboardWeekStats');
  const { start, end } = getWeekRange(new Date());
  const startKey = formatDateKey(start);
  const endKey = formatDateKey(end);

  const weekTasks = tasks.filter(t => t.date >= startKey && t.date <= endKey);
  const completed = weekTasks.filter(t => t.stage === 'Posted' || t.stage === 'Done').length;
  const remaining = weekTasks.length - completed;

  container.innerHTML = `
    <div class="week-stat"><div class="num">${weekTasks.length}</div><div class="label">Planned</div></div>
    <div class="week-stat"><div class="num">${completed}</div><div class="label">Completed</div></div>
    <div class="week-stat"><div class="num">${remaining}</div><div class="label">Remaining</div></div>
  `;
}

function renderDashboardPipeline() {
  const container = document.getElementById('dashboardPipeline');
  const counts = {};
  CONTENT_STAGES.forEach(s => counts[s] = 0);
  counts['Ideas'] = ideas.length;

  tasks.forEach(t => {
    if (CONTENT_STAGES.includes(t.stage)) {
      counts[t.stage] = (counts[t.stage] || 0) + 1;
    }
  });

  const order = ['Ideas', 'Planned', 'Creating', 'Ready', 'Posted'];
  container.innerHTML = order.map(stage => `
    <div class="pipeline-stat-row"><span class="stage-name">${stage}</span><span class="stage-count">${counts[stage] || 0}</span></div>
  `).join('');
}

function renderDashboardUpcoming() {
  const container = document.getElementById('dashboardUpcoming');
  const key = todayKey();
  const upcoming = tasks
    .filter(t => t.date >= key)
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
    .slice(0, 5);

  if (upcoming.length === 0) {
    container.innerHTML = '<p class="empty-state">No upcoming tasks.</p>';
    return;
  }
  container.innerHTML = upcoming.map(t => renderMiniTaskRow(t)).join('');
}

function renderDashboardQuickIdeas() {
  const container = document.getElementById('dashboardQuickIdeas');
  const recent = [...ideas].sort((a, b) => b.dateAdded.localeCompare(a.dateAdded)).slice(0, 3);

  if (recent.length === 0) {
    container.innerHTML = '<p class="empty-state">No ideas saved yet.</p>';
    return;
  }
  container.innerHTML = recent.map(idea => `
    <div class="mini-task-row">💡 ${escapeHtml(idea.title)}</div>
  `).join('');
}

/* ============================================================
   10. IDEAS
   ============================================================ */
function initIdeasView() {
  document.getElementById('newIdeaBtn').addEventListener('click', () => openIdeaModal(null));
  document.getElementById('closeIdeaModal').addEventListener('click', closeIdeaModal);
  document.getElementById('cancelIdeaModal').addEventListener('click', closeIdeaModal);
  document.getElementById('ideaForm').addEventListener('submit', saveIdea);
  document.getElementById('ideaSearchInput').addEventListener('input', renderIdeas);
  document.getElementById('ideaProjectFilter').addEventListener('change', renderIdeas);

  document.getElementById('closeIdeaToCalendarModal').addEventListener('click', closeIdeaToCalendarModal);
  document.getElementById('cancelIdeaToCalendarModal').addEventListener('click', closeIdeaToCalendarModal);
  document.getElementById('ideaToCalendarForm').addEventListener('submit', saveIdeaToCalendar);

  const typeFilterContainer = document.getElementById('ideaTypeFilter');
  const types = ['All', 'Reel', 'Carousel', 'Story', 'Static Post'];
  typeFilterContainer.innerHTML = types.map(t =>
    `<button class="filter-chip ${t === 'All' ? 'active' : ''}" data-type="${t}">${t === 'Static Post' ? 'Posts' : t + (t === 'All' ? '' : 's')}</button>`
  ).join('');
  typeFilterContainer.querySelectorAll('.filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      ideaTypeFilter = btn.dataset.type;
      typeFilterContainer.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderIdeas();
    });
  });
}

function renderIdeas() {
  const container = document.getElementById('ideasList');
  const search = (document.getElementById('ideaSearchInput').value || '').toLowerCase();
  const projectFilter = document.getElementById('ideaProjectFilter').value || 'all';

  let filtered = ideas.filter(idea => {
    const matchesType = ideaTypeFilter === 'All' || idea.contentType === ideaTypeFilter;
    const matchesProject = projectFilter === 'all' || idea.projectId === projectFilter;
    const matchesSearch = !search ||
      idea.title.toLowerCase().includes(search) ||
      (idea.description || '').toLowerCase().includes(search) ||
      (idea.tags || []).join(' ').toLowerCase().includes(search);
    return matchesType && matchesProject && matchesSearch;
  });

  filtered.sort((a, b) => b.dateAdded.localeCompare(a.dateAdded));

  if (filtered.length === 0) {
    container.innerHTML = '<p class="empty-state">No ideas match your filters.</p>';
    return;
  }

  container.innerHTML = filtered.map(idea => {
    const project = getProjectById(idea.projectId);
    const color = project ? project.color : '#8A8C83';
    return `
      <div class="idea-card" style="border-left-color:${color}">
        <div class="idea-card-title">${escapeHtml(idea.title)}</div>
        ${idea.description ? `<div class="idea-card-desc">${escapeHtml(idea.description)}</div>` : ''}
        <div class="idea-card-meta">
          <span>${project ? escapeHtml(project.name) : 'No project'}</span>
          <span>· ${escapeHtml(idea.contentType)}</span>
        </div>
        ${idea.tags && idea.tags.length ? `<div class="idea-card-meta">${idea.tags.map(t => `<span class="idea-tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
        <div class="idea-card-actions">
          <button class="btn-add-cal" data-ideaid="${idea.id}">+ Add to Calendar</button>
          <button class="edit-idea-btn" data-ideaid="${idea.id}">Edit</button>
          <button class="delete-idea-btn" data-ideaid="${idea.id}">Delete</button>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.btn-add-cal').forEach(btn => {
    btn.addEventListener('click', () => openIdeaToCalendarModal(btn.dataset.ideaid));
  });
  container.querySelectorAll('.edit-idea-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idea = ideas.find(i => i.id === btn.dataset.ideaid);
      if (idea) openIdeaModal(idea);
    });
  });
  container.querySelectorAll('.delete-idea-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      showConfirm('Delete this idea? This cannot be undone.', () => deleteIdea(btn.dataset.ideaid));
    });
  });
}

function openIdeaModal(idea) {
  populateProjectSelects();
  editingIdeaId = idea ? idea.id : null;
  document.getElementById('ideaModalTitle').textContent = idea ? 'Edit Idea' : 'New Idea';
  document.getElementById('ideaId').value = idea ? idea.id : '';
  document.getElementById('ideaTitle').value = idea ? idea.title : '';
  document.getElementById('ideaDescription').value = idea ? idea.description : '';
  document.getElementById('ideaContentType').value = idea ? idea.contentType : 'Reel';
  document.getElementById('ideaTags').value = idea && idea.tags ? idea.tags.join(', ') : '';
  if (projects.length > 0) {
    document.getElementById('ideaProject').value = idea ? idea.projectId : projects[0].id;
  }
  document.getElementById('ideaModal').classList.add('open');
  document.getElementById('overlay').classList.add('open');
}

function closeIdeaModal() {
  document.getElementById('ideaModal').classList.remove('open');
  document.getElementById('overlay').classList.remove('open');
  document.getElementById('ideaForm').reset();
  editingIdeaId = null;
}

async function saveIdea(e) {
  e.preventDefault();
  const id = document.getElementById('ideaId').value;
  const tagsRaw = document.getElementById('ideaTags').value.trim();
  const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];
  const submitBtn = e.target.querySelector('button[type="submit"]');

  const row = {
    title: document.getElementById('ideaTitle').value.trim(),
    description: document.getElementById('ideaDescription').value.trim(),
    project_id: document.getElementById('ideaProject').value,
    content_type: document.getElementById('ideaContentType').value,
    tags
  };

  if (!row.title || !projects.length) return;

  setBusy(submitBtn, true);
  try {
    if (id) {
      const { data, error } = await supabaseClient.from('ideas').update(row).eq('id', id).select().single();
      if (error) throw error;
      const existing = ideas.find(i => i.id === id);
      Object.assign(existing, mapIdeaRow(data));
    } else {
      const { data, error } = await supabaseClient
        .from('ideas')
        .insert({ ...row, date_added: todayKey() })
        .select()
        .single();
      if (error) throw error;
      ideas.push(mapIdeaRow(data));
    }
    closeIdeaModal();
    renderIdeas();
    renderDashboard();
  } catch (err) {
    showError('Could not save the idea.', err);
  } finally {
    setBusy(submitBtn, false);
  }
}

async function deleteIdea(id) {
  try {
    const { error } = await supabaseClient.from('ideas').delete().eq('id', id);
    if (error) throw error;
    ideas = ideas.filter(i => i.id !== id);
    renderIdeas();
    renderDashboard();
  } catch (err) {
    showError('Could not delete the idea.', err);
  }
}

/* ---------- Idea -> Calendar conversion ---------- */
function openIdeaToCalendarModal(ideaId) {
  const idea = ideas.find(i => i.id === ideaId);
  if (!idea) return;
  populateProjectSelects();

  document.getElementById('ideaToCalendarIdeaId').value = ideaId;
  document.getElementById('ideaToCalendarDate').value = todayKey();
  document.getElementById('ideaToCalendarTime').value = '';
  document.getElementById('ideaToCalendarProject').value = idea.projectId;
  document.getElementById('ideaToCalendarStage').innerHTML =
    getStageOptionsFor(idea.contentType).map(s => `<option value="${s}">${s}</option>`).join('');

  document.getElementById('ideaToCalendarModal').classList.add('open');
  document.getElementById('overlay').classList.add('open');
}

function closeIdeaToCalendarModal() {
  document.getElementById('ideaToCalendarModal').classList.remove('open');
  document.getElementById('overlay').classList.remove('open');
  document.getElementById('ideaToCalendarForm').reset();
}

async function saveIdeaToCalendar(e) {
  e.preventDefault();
  const ideaId = document.getElementById('ideaToCalendarIdeaId').value;
  const idea = ideas.find(i => i.id === ideaId);
  if (!idea) return;
  const submitBtn = e.target.querySelector('button[type="submit"]');

  const row = {
    name: idea.title,
    project_id: document.getElementById('ideaToCalendarProject').value,
    content_type: idea.contentType,
    stage: document.getElementById('ideaToCalendarStage').value,
    date: document.getElementById('ideaToCalendarDate').value,
    time: document.getElementById('ideaToCalendarTime').value || null,
    notes: idea.description || ''
  };

  setBusy(submitBtn, true);
  try {
    const { data, error } = await supabaseClient.from('tasks').insert(row).select().single();
    if (error) throw error;
    tasks.push(mapTaskRow(data));
    closeIdeaToCalendarModal();
    renderAll();
  } catch (err) {
    showError('Could not add the idea to the calendar.', err);
  } finally {
    setBusy(submitBtn, false);
  }
}

/* ============================================================
   11. PEOPLE & ASSIGNED TASKS
   ============================================================ */
function initPeopleView() {
  document.getElementById('addPersonBtn').addEventListener('click', () => openPersonModal(null));
  document.getElementById('closePersonModal').addEventListener('click', closePersonModal);
  document.getElementById('cancelPersonModal').addEventListener('click', closePersonModal);
  document.getElementById('personForm').addEventListener('submit', savePerson);

  document.getElementById('closeAssignedTaskModal').addEventListener('click', closeAssignedTaskModal);
  document.getElementById('cancelAssignedTaskModal').addEventListener('click', closeAssignedTaskModal);
  document.getElementById('assignedTaskForm').addEventListener('submit', saveAssignedTask);
}

function renderPeople() {
  const container = document.getElementById('peopleList');
  if (people.length === 0) {
    container.innerHTML = '<p class="empty-state">No people added yet. Click "+ Add Person" to get started.</p>';
    return;
  }

  container.innerHTML = people.map(person => {
    const project = getProjectById(person.projectId);
    const personTasks = assignedTasks.filter(t => t.personId === person.id);

    return `
      <div class="person-card">
        <div class="person-card-header">
          <div>
            <div class="person-name">${escapeHtml(person.name)}</div>
            ${project ? `<div class="person-project-tag">${escapeHtml(project.name)}</div>` : ''}
          </div>
        </div>
        <div class="assigned-tasks-list">
          ${personTasks.length === 0 ? '<p class="empty-state">No tasks assigned.</p>' :
            personTasks.map(t => `
              <div class="assigned-task-row ${t.completed ? 'completed' : ''}">
                <input type="checkbox" class="toggle-complete-cb" data-taskid="${t.id}" ${t.completed ? 'checked' : ''}>
                <span class="assigned-task-name">${escapeHtml(t.name)}</span>
                ${t.deadline ? `<span class="assigned-task-deadline">${t.deadline}</span>` : ''}
                <button class="icon-btn edit-assigned-btn" data-taskid="${t.id}" title="Edit">✎</button>
                <button class="icon-btn delete-assigned-btn" data-taskid="${t.id}" title="Delete">🗑</button>
              </div>
            `).join('')}
        </div>
        <div class="person-card-footer">
          <button class="assign-task-btn" data-personid="${person.id}">+ Assign Task</button>
          <button class="delete-person-btn" data-personid="${person.id}">Delete Person</button>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.toggle-complete-cb').forEach(cb => {
    cb.addEventListener('change', () => toggleAssignedTaskComplete(cb.dataset.taskid, cb));
  });
  container.querySelectorAll('.edit-assigned-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = assignedTasks.find(a => a.id === btn.dataset.taskid);
      if (t) openAssignedTaskModal(t);
    });
  });
  container.querySelectorAll('.delete-assigned-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      showConfirm('Delete this assigned task?', () => deleteAssignedTask(btn.dataset.taskid));
    });
  });
  container.querySelectorAll('.assign-task-btn').forEach(btn => {
    btn.addEventListener('click', () => openAssignedTaskModal(null, btn.dataset.personid));
  });
  container.querySelectorAll('.delete-person-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      showConfirm('Delete this person and their assigned tasks?', () => deletePerson(btn.dataset.personid));
    });
  });
}

function openPersonModal(person) {
  populateProjectSelects();
  document.getElementById('personModalTitle').textContent = person ? 'Edit Person' : 'Add Person';
  document.getElementById('personId').value = person ? person.id : '';
  document.getElementById('personName').value = person ? person.name : '';
  document.getElementById('personProject').value = person && person.projectId ? person.projectId : '';
  document.getElementById('personModal').classList.add('open');
  document.getElementById('overlay').classList.add('open');
}

function closePersonModal() {
  document.getElementById('personModal').classList.remove('open');
  document.getElementById('overlay').classList.remove('open');
  document.getElementById('personForm').reset();
}

async function savePerson(e) {
  e.preventDefault();
  const id = document.getElementById('personId').value;
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const row = {
    name: document.getElementById('personName').value.trim(),
    project_id: document.getElementById('personProject').value || null
  };
  if (!row.name) return;

  setBusy(submitBtn, true);
  try {
    if (id) {
      const { data, error } = await supabaseClient.from('people').update(row).eq('id', id).select().single();
      if (error) throw error;
      const existing = people.find(p => p.id === id);
      Object.assign(existing, mapPersonRow(data));
    } else {
      const { data, error } = await supabaseClient.from('people').insert(row).select().single();
      if (error) throw error;
      people.push(mapPersonRow(data));
    }
    closePersonModal();
    renderAll();
  } catch (err) {
    showError('Could not save this person.', err);
  } finally {
    setBusy(submitBtn, false);
  }
}

async function deletePerson(id) {
  try {
    const { error } = await supabaseClient.from('people').delete().eq('id', id);
    if (error) throw error;
    people = people.filter(p => p.id !== id);
    assignedTasks = assignedTasks.filter(t => t.personId !== id);
    renderAll();
  } catch (err) {
    showError('Could not delete this person.', err);
  }
}

function openAssignedTaskModal(task, prefillPersonId) {
  populateProjectSelects();
  document.getElementById('assignedTaskModalTitle').textContent = task ? 'Edit Assigned Task' : 'Assign Task';
  document.getElementById('assignedTaskId').value = task ? task.id : '';
  document.getElementById('assignedTaskName').value = task ? task.name : '';
  document.getElementById('assignedTaskDeadline').value = task && task.deadline ? task.deadline : '';
  document.getElementById('assignedTaskProject').value = task && task.projectId ? task.projectId : '';

  if (people.length > 0) {
    document.getElementById('assignedTaskPerson').value = task ? task.personId : (prefillPersonId || people[0].id);
  }

  document.getElementById('assignedTaskModal').classList.add('open');
  document.getElementById('overlay').classList.add('open');
}

function closeAssignedTaskModal() {
  document.getElementById('assignedTaskModal').classList.remove('open');
  document.getElementById('overlay').classList.remove('open');
  document.getElementById('assignedTaskForm').reset();
}

async function saveAssignedTask(e) {
  e.preventDefault();
  const id = document.getElementById('assignedTaskId').value;
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const row = {
    name: document.getElementById('assignedTaskName').value.trim(),
    person_id: document.getElementById('assignedTaskPerson').value,
    project_id: document.getElementById('assignedTaskProject').value || null,
    deadline: document.getElementById('assignedTaskDeadline').value || null
  };
  if (!row.name || !people.length) return;

  setBusy(submitBtn, true);
  try {
    if (id) {
      const { data, error } = await supabaseClient.from('assigned_tasks').update(row).eq('id', id).select().single();
      if (error) throw error;
      const existing = assignedTasks.find(t => t.id === id);
      Object.assign(existing, mapAssignedTaskRow(data));
    } else {
      const { data, error } = await supabaseClient
        .from('assigned_tasks')
        .insert({ ...row, completed: false })
        .select()
        .single();
      if (error) throw error;
      assignedTasks.push(mapAssignedTaskRow(data));
    }
    closeAssignedTaskModal();
    renderPeople();
  } catch (err) {
    showError('Could not save the assigned task.', err);
  } finally {
    setBusy(submitBtn, false);
  }
}

async function deleteAssignedTask(id) {
  try {
    const { error } = await supabaseClient.from('assigned_tasks').delete().eq('id', id);
    if (error) throw error;
    assignedTasks = assignedTasks.filter(t => t.id !== id);
    renderPeople();
  } catch (err) {
    showError('Could not delete the assigned task.', err);
  }
}

async function toggleAssignedTaskComplete(id, checkbox) {
  const t = assignedTasks.find(a => a.id === id);
  if (!t) return;
  const newValue = !t.completed;
  t.completed = newValue; // optimistic
  renderPeople();

  try {
    const { error } = await supabaseClient.from('assigned_tasks').update({ completed: newValue }).eq('id', id);
    if (error) throw error;
  } catch (err) {
    t.completed = !newValue; // revert
    renderPeople();
    showError('Could not update the task.', err);
  }
}

/* ============================================================
   12. PROJECTS
   ============================================================ */
function initProjectsView() {
  document.getElementById('addProjectBtn').addEventListener('click', () => openProjectModal(null));
  document.getElementById('closeProjectModal').addEventListener('click', closeProjectModal);
  document.getElementById('cancelProjectModal').addEventListener('click', closeProjectModal);
  document.getElementById('projectForm').addEventListener('submit', saveProject);
}

function renderProjects() {
  const container = document.getElementById('projectsList');
  if (projects.length === 0) {
    container.innerHTML = '<p class="empty-state">No projects yet. Click "+ Add Project" to create one.</p>';
    return;
  }

  container.innerHTML = projects.map(project => {
    const taskCount = tasks.filter(t => t.projectId === project.id).length;
    return `
      <div class="project-card" style="border-top-color:${project.color}">
        <div class="project-card-header">
          <span class="project-color-dot" style="background:${project.color}"></span>
          <span class="project-card-name">${escapeHtml(project.name)}</span>
        </div>
        <div class="project-card-count">${taskCount} task${taskCount === 1 ? '' : 's'}</div>
        <div class="project-card-actions">
          <button class="edit-project-btn" data-projectid="${project.id}">Edit</button>
          <button class="delete-project-btn" data-projectid="${project.id}">Delete</button>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.edit-project-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const project = projects.find(p => p.id === btn.dataset.projectid);
      if (project) openProjectModal(project);
    });
  });
  container.querySelectorAll('.delete-project-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.projectid;
      const taskCount = tasks.filter(t => t.projectId === id).length;
      const message = taskCount > 0
        ? `This project has ${taskCount} task(s). Deleting it will also delete those tasks and ideas. Continue?`
        : 'Delete this project?';
      showConfirm(message, () => deleteProject(id));
    });
  });
}

function openProjectModal(project) {
  document.getElementById('projectModalTitle').textContent = project ? 'Edit Project' : 'Add Project';
  document.getElementById('projectId').value = project ? project.id : '';
  document.getElementById('projectName').value = project ? project.name : '';
  const chosenColor = project ? project.color : COLOR_PALETTE[0];
  document.getElementById('projectColor').value = chosenColor;

  const swatchContainer = document.getElementById('colorSwatches');
  swatchContainer.innerHTML = COLOR_PALETTE.map(c => `
    <div class="color-swatch ${c === chosenColor ? 'selected' : ''}" style="background:${c}" data-color="${c}"></div>
  `).join('');

  swatchContainer.querySelectorAll('.color-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      swatchContainer.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
      document.getElementById('projectColor').value = sw.dataset.color;
    });
  });

  document.getElementById('projectModal').classList.add('open');
  document.getElementById('overlay').classList.add('open');
}

function closeProjectModal() {
  document.getElementById('projectModal').classList.remove('open');
  document.getElementById('overlay').classList.remove('open');
  document.getElementById('projectForm').reset();
}

async function saveProject(e) {
  e.preventDefault();
  const id = document.getElementById('projectId').value;
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const row = {
    name: document.getElementById('projectName').value.trim(),
    color: document.getElementById('projectColor').value || COLOR_PALETTE[0]
  };
  if (!row.name) return;

  setBusy(submitBtn, true);
  try {
    if (id) {
      const { data, error } = await supabaseClient.from('projects').update(row).eq('id', id).select().single();
      if (error) throw error;
      const existing = projects.find(p => p.id === id);
      Object.assign(existing, mapProjectRow(data)); // tasks reference projectId, so color updates automatically
    } else {
      const { data, error } = await supabaseClient.from('projects').insert(row).select().single();
      if (error) throw error;
      projects.push(mapProjectRow(data));
    }
    closeProjectModal();
    renderAll();
  } catch (err) {
    showError('Could not save the project.', err);
  } finally {
    setBusy(submitBtn, false);
  }
}

async function deleteProject(id) {
  try {
    const { error } = await supabaseClient.from('projects').delete().eq('id', id);
    if (error) throw error;
    projects = projects.filter(p => p.id !== id);
    tasks = tasks.filter(t => t.projectId !== id);
    ideas = ideas.filter(i => i.projectId !== id);
    people.forEach(p => { if (p.projectId === id) p.projectId = null; });
    assignedTasks.forEach(t => { if (t.projectId === id) t.projectId = null; });
    if (calProjectFilter === id) calProjectFilter = 'all';
    renderAll();
  } catch (err) {
    showError('Could not delete the project. Note it may still be referenced by people or assigned tasks.', err);
  }
}

/* ============================================================
   13. QUICK ADD FLOATING BUTTON
   ============================================================ */
function initQuickAdd() {
  const fab = document.getElementById('fabBtn');
  const menu = document.getElementById('quickAddMenu');

  fab.addEventListener('click', () => {
    fab.classList.toggle('open');
    menu.classList.toggle('open');
  });

  document.getElementById('quickAddTaskBtn').addEventListener('click', () => {
    closeQuickAdd();
    openTaskModal(null, todayKey());
  });
  document.getElementById('quickAddIdeaBtn').addEventListener('click', () => {
    closeQuickAdd();
    openIdeaModal(null);
  });
  document.getElementById('quickAddAssignBtn').addEventListener('click', () => {
    closeQuickAdd();
    if (people.length === 0) {
      alert('Add a person first, then you can assign tasks to them.');
      switchView('people');
      return;
    }
    openAssignedTaskModal(null);
  });
}

function closeQuickAdd() {
  document.getElementById('fabBtn').classList.remove('open');
  document.getElementById('quickAddMenu').classList.remove('open');
}

/* ============================================================
   14. GENERIC CONFIRM MODAL
   ============================================================ */
let confirmCallback = null;

function initConfirmModal() {
  document.getElementById('confirmCancelBtn').addEventListener('click', closeConfirm);
  document.getElementById('confirmYesBtn').addEventListener('click', () => {
    if (confirmCallback) confirmCallback();
    closeConfirm();
  });
}

function showConfirm(message, onYes) {
  document.getElementById('confirmMessage').textContent = message;
  confirmCallback = onYes;
  document.getElementById('confirmModal').classList.add('open');
}

function closeConfirm() {
  document.getElementById('confirmModal').classList.remove('open');
  confirmCallback = null;
}

/* ============================================================
   15. OVERLAY (shared close behavior)
   ============================================================ */
function initOverlay() {
  document.getElementById('overlay').addEventListener('click', () => {
    closeDatePanel();
    closeTaskModal();
    closeIdeaModal();
    closeIdeaToCalendarModal();
    closeProjectModal();
    closePersonModal();
    closeAssignedTaskModal();
  });
  document.getElementById('closeDatePanel').addEventListener('click', closeDatePanel);
}

/* ============================================================
   16. BUSY STATE HELPER (disables a submit button while awaiting Supabase)
   ============================================================ */
function setBusy(button, busy) {
  if (!button) return;
  button.disabled = busy;
  if (busy) {
    button.dataset.originalText = button.textContent;
    button.textContent = 'Saving…';
  } else if (button.dataset.originalText) {
    button.textContent = button.dataset.originalText;
  }
}

/* ============================================================
   17. APP LOADING STATE
   ============================================================ */
function setAppLoading(isLoading, errorMessage) {
  const loader = document.getElementById('appLoading');
  if (!loader) return;
  if (errorMessage) {
    loader.innerHTML = `
      <div class="app-loading-box">
        <div class="app-loading-title">Couldn't connect to Supabase</div>
        <p class="app-loading-text">${escapeHtml(errorMessage)}</p>
        <button class="btn-primary" id="appLoadingRetry">Retry</button>
      </div>`;
    document.getElementById('appLoadingRetry').addEventListener('click', init);
    loader.classList.add('open');
    return;
  }
  loader.classList.toggle('open', isLoading);
}

/* ============================================================
   18. INIT
   ============================================================ */
async function init() {
  setAppLoading(true);
  try {
    await loadFromSupabase();
    setAppLoading(false);
  } catch (err) {
    console.error('Failed to load data from Supabase', err);
    setAppLoading(false, err.message || 'Unknown error while loading data.');
    return;
  }

  initNavigation();
  initCalendarControls();
  initTaskModal();
  initIdeasView();
  initPeopleView();
  initProjectsView();
  initQuickAdd();
  initConfirmModal();
  initOverlay();

  populateStageSelect('taskContentType', 'taskStage');

  renderAll();
}

document.addEventListener('DOMContentLoaded', init);
