// ===== GOOGLE SHEETS BACKEND =====
const API_URL = 'https://script.google.com/macros/s/AKfycbxzPHbAf8cdcm30gapCoRMm8VAI78mRiX7Tv2fjDTYxRi2sGvhhey5DhYZ9KL7INbL34w/exec';

const SHEETS = {
  appointments: ['id','doctor','date','time','location','notes'],
  reminders:    ['id','title','day','time','repeat','notes'],
  travel:       ['id','dest','depart','ret','airline','hotel','notes'],
  payments:     ['id','name','amount','date','category','status','notes'],
  workdays:     ['id','date','type','notes'],
  college:      ['id','student','term','start','end','campus','notes'],
  school:       ['id','child','type','name','start','end','notes'],
};

async function dbGet(sheet) {
  try {
    // Use JSONP-style callback to bypass CORS on GET requests
    return new Promise((resolve) => {
      const cbName = 'cb_' + sheet + '_' + Date.now();
      const script = document.createElement('script');
      window[cbName] = (rows) => {
        delete window[cbName];
        document.body.removeChild(script);
        if (!Array.isArray(rows) || rows.length < 2) { resolve([]); return; }
        const headers = rows[0];
        resolve(rows.slice(1).map(row => {
          const obj = {};
          headers.forEach((h, i) => obj[h] = row[i] !== undefined ? String(row[i]) : '');
          return obj;
        }));
      };
      script.onerror = () => { delete window[cbName]; resolve([]); };
      script.src = `${API_URL}?sheet=${encodeURIComponent(sheet)}&callback=${cbName}&t=${Date.now()}`;
      document.body.appendChild(script);
    });
  } catch(e) { console.error('dbGet error', e); return []; }
}

async function dbSave(sheet, obj) {
  const headers = SHEETS[sheet];
  const row = headers.map(h => obj[h] !== undefined ? obj[h] : '');
  await fetch(API_URL, {
    method: 'POST',
    mode: 'no-cors',
    body: JSON.stringify({ action: 'save', sheet, id: obj.id, headers, row }),
  });
}

async function dbDelete(sheet, id) {
  await fetch(API_URL, {
    method: 'POST',
    mode: 'no-cors',
    body: JSON.stringify({ action: 'delete', sheet, id }),
  });
}

function showSpinner(sheet) { /* silent */ }

// ===== DATE / TIME CLOCK =====
function updateClock() {
  const now = new Date();
  document.getElementById('current-datetime').textContent =
    now.toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' }) +
    '  •  ' + now.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
}
setInterval(updateClock, 1000);
updateClock();

// ===== TABS =====
function showTab(name) {
  document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  event.currentTarget.classList.add('active');
  if (name === 'workschedule') renderWorkCalendar();
}

// ===== MODALS =====
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function closeModalOutside(e, id) { if (e.target.id === id) closeModal(id); }

// ===== HELPERS =====
function daysFromToday(dateStr) {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(dateStr + 'T00:00:00'); d.setHours(0,0,0,0);
  return Math.round((d - today) / 86400000);
}

function countdownBadge(dateStr) {
  const diff = daysFromToday(dateStr);
  if (diff === null) return '';
  if (diff < 0)  return `<div class="countdown past"><i class="fa-solid fa-clock-rotate-left"></i> ${Math.abs(diff)} days ago</div>`;
  if (diff === 0) return `<div class="countdown today"><i class="fa-solid fa-star"></i> Today!</div>`;
  if (diff <= 7)  return `<div class="countdown soon"><i class="fa-solid fa-triangle-exclamation"></i> In ${diff} day${diff>1?'s':''}</div>`;
  return `<div class="countdown future"><i class="fa-regular fa-calendar"></i> In ${diff} days</div>`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' });
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const hr = parseInt(h); const ampm = hr >= 12 ? 'PM' : 'AM';
  return `${hr % 12 || 12}:${m} ${ampm}`;
}

function loadingCard() {
  return `<div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>`;
}

// ===== DOCTOR APPOINTMENTS =====
async function saveAppointment() {
  const doctor   = document.getElementById('appt-doctor').value.trim();
  const date     = document.getElementById('appt-date').value;
  const time     = document.getElementById('appt-time').value;
  const location = document.getElementById('appt-location').value.trim();
  const notes    = document.getElementById('appt-notes').value.trim();
  if (!doctor || !date) return alert('Please enter doctor name and date.');
  const obj = { id: Date.now(), doctor, date, time, location, notes };
  closeModal('appt-modal');
  ['appt-doctor','appt-date','appt-time','appt-location','appt-notes'].forEach(id => document.getElementById(id).value = '');
  await dbSave('appointments', obj);
  renderAppointments();
}

async function deleteAppointment(id) {
  if (!confirm('Delete this appointment?')) return;
  await dbDelete('appointments', id);
  renderAppointments();
}

async function renderAppointments() {
  const el = document.getElementById('appt-list');
  el.innerHTML = loadingCard();
  const list = await dbGet('appointments');
  list.sort((a,b) => a.date.localeCompare(b.date));
  if (!list.length) {
    el.innerHTML = `<div class="empty-state"><i class="fa-solid fa-stethoscope"></i>No appointments yet. Click "Add Appointment" to get started.</div>`;
    return;
  }
  el.innerHTML = list.map(a => `
    <div class="card">
      <div class="card-color-bar" style="background:linear-gradient(to bottom,#0097a7,#00bcd4)"></div>
      <div class="card-title"><i class="fa-solid fa-user-doctor" style="color:#0097a7;margin-right:.4rem"></i>${a.doctor}</div>
      <div class="card-meta">
        <span><i class="fa-regular fa-calendar"></i>${formatDate(a.date)}</span>
        ${a.time ? `<span><i class="fa-regular fa-clock"></i>${formatTime(a.time)}</span>` : ''}
        ${a.location ? `<span><i class="fa-solid fa-location-dot"></i>${a.location}</span>` : ''}
      </div>
      ${countdownBadge(a.date)}
      ${a.notes ? `<div class="card-notes">${a.notes}</div>` : ''}
      <div class="card-actions">
        <button class="btn-delete" onclick="deleteAppointment(${a.id})"><i class="fa-solid fa-trash"></i> Delete</button>
      </div>
    </div>`).join('');
}

// ===== WEEKLY REMINDERS =====
async function saveReminder() {
  const title  = document.getElementById('reminder-title').value.trim();
  const day    = document.getElementById('reminder-day').value;
  const time   = document.getElementById('reminder-time').value;
  const repeat = document.getElementById('reminder-repeat').value;
  const notes  = document.getElementById('reminder-notes').value.trim();
  if (!title) return alert('Please enter a reminder title.');
  const obj = { id: Date.now(), title, day, time, repeat, notes };
  closeModal('reminder-modal');
  ['reminder-title','reminder-time','reminder-notes'].forEach(id => document.getElementById(id).value = '');
  await dbSave('reminders', obj);
  renderReminders();
}

async function deleteReminder(id) {
  if (!confirm('Delete this reminder?')) return;
  await dbDelete('reminders', id);
  renderReminders();
}

const dayColors = { Monday:'#0097a7', Tuesday:'#00bcd4', Wednesday:'#00897b', Thursday:'#f97316', Friday:'#eab308', Saturday:'#a855f7', Sunday:'#ec4899' };
const repeatLabel = { weekly:'Every Week', biweekly:'Every 2 Weeks', monthly:'Monthly', once:'One Time' };

async function renderReminders() {
  const el = document.getElementById('reminder-list');
  el.innerHTML = loadingCard();
  const list = await dbGet('reminders');
  if (!list.length) {
    el.innerHTML = `<div class="empty-state"><i class="fa-solid fa-bell"></i>No reminders yet. Click "Add Reminder" to get started.</div>`;
    return;
  }
  const order = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const sorted = [...list].sort((a,b) => order.indexOf(a.day) - order.indexOf(b.day));
  el.innerHTML = sorted.map(r => `
    <div class="card">
      <div class="card-color-bar" style="background:${dayColors[r.day]||'#0097a7'}"></div>
      <div class="card-title"><i class="fa-solid fa-bell" style="color:${dayColors[r.day]||'#0097a7'};margin-right:.4rem"></i>${r.title}</div>
      <div class="card-meta">
        <span><i class="fa-regular fa-calendar-days"></i>${r.day}</span>
        ${r.time ? `<span><i class="fa-regular fa-clock"></i>${formatTime(r.time)}</span>` : ''}
        <span><i class="fa-solid fa-rotate"></i>${repeatLabel[r.repeat] || r.repeat}</span>
      </div>
      ${r.notes ? `<div class="card-notes">${r.notes}</div>` : ''}
      <div class="card-actions">
        <button class="btn-delete" onclick="deleteReminder(${r.id})"><i class="fa-solid fa-trash"></i> Delete</button>
      </div>
    </div>`).join('');
}

// ===== TRAVEL =====
async function saveTravel() {
  const dest    = document.getElementById('travel-dest').value.trim();
  const depart  = document.getElementById('travel-depart').value;
  const ret     = document.getElementById('travel-return').value;
  const airline = document.getElementById('travel-airline').value.trim();
  const hotel   = document.getElementById('travel-hotel').value.trim();
  const notes   = document.getElementById('travel-notes').value.trim();
  if (!dest || !depart) return alert('Please enter a destination and departure date.');
  const obj = { id: Date.now(), dest, depart, ret, airline, hotel, notes };
  closeModal('travel-modal');
  ['travel-dest','travel-depart','travel-return','travel-airline','travel-hotel','travel-notes'].forEach(id => document.getElementById(id).value = '');
  await dbSave('travel', obj);
  renderTravel();
}

async function deleteTravel(id) {
  if (!confirm('Delete this travel plan?')) return;
  await dbDelete('travel', id);
  renderTravel();
}

async function renderTravel() {
  const el = document.getElementById('travel-list');
  el.innerHTML = loadingCard();
  const list = await dbGet('travel');
  list.sort((a,b) => a.depart.localeCompare(b.depart));
  if (!list.length) {
    el.innerHTML = `<div class="empty-state"><i class="fa-solid fa-plane"></i>No trips planned yet. Click "Add Trip" to get started.</div>`;
    return;
  }
  el.innerHTML = list.map(t => {
    let duration = '';
    if (t.depart && t.ret) {
      const days = Math.round((new Date(t.ret) - new Date(t.depart)) / 86400000);
      duration = `${days} day${days !== 1 ? 's' : ''}`;
    }
    return `
    <div class="card">
      <div class="card-color-bar" style="background:linear-gradient(to bottom,#f97316,#eab308)"></div>
      <div class="card-title"><i class="fa-solid fa-plane" style="color:#f97316;margin-right:.4rem"></i>${t.dest}</div>
      <div class="card-meta">
        <span><i class="fa-solid fa-plane-departure"></i>Depart: ${formatDate(t.depart)}</span>
        ${t.ret ? `<span><i class="fa-solid fa-plane-arrival"></i>Return: ${formatDate(t.ret)}</span>` : ''}
        ${duration ? `<span><i class="fa-regular fa-clock"></i>Duration: ${duration}</span>` : ''}
        ${t.airline ? `<span><i class="fa-solid fa-jet-fighter-up"></i>${t.airline}</span>` : ''}
        ${t.hotel   ? `<span><i class="fa-solid fa-hotel"></i>${t.hotel}</span>` : ''}
      </div>
      ${countdownBadge(t.depart)}
      ${t.notes ? `<div class="card-notes">${t.notes}</div>` : ''}
      <div class="card-actions">
        <button class="btn-delete" onclick="deleteTravel(${t.id})"><i class="fa-solid fa-trash"></i> Delete</button>
      </div>
    </div>`;
  }).join('');
}

// ===== PAYMENTS =====
async function savePayment() {
  const name     = document.getElementById('pay-name').value.trim();
  const amount   = parseFloat(document.getElementById('pay-amount').value) || 0;
  const date     = document.getElementById('pay-date').value;
  const category = document.getElementById('pay-category').value;
  const status   = document.getElementById('pay-status').value;
  const notes    = document.getElementById('pay-notes').value.trim();
  if (!name || !date) return alert('Please enter a payment name and due date.');
  const obj = { id: Date.now(), name, amount, date, category, status, notes };
  closeModal('payment-modal');
  ['pay-name','pay-amount','pay-date','pay-notes'].forEach(id => document.getElementById(id).value = '');
  await dbSave('payments', obj);
  renderPayments();
}

async function deletePayment(id) {
  if (!confirm('Delete this payment?')) return;
  await dbDelete('payments', id);
  renderPayments();
}

async function togglePaid(id) {
  const list = await dbGet('payments');
  const p = list.find(p => String(p.id) === String(id));
  if (!p) return;
  p.status = p.status === 'paid' ? 'unpaid' : 'paid';
  await dbSave('payments', p);
  renderPayments();
}

const catColors = { Utilities:'#00bcd4','Rent / Mortgage':'#0097a7', Insurance:'#00897b', Subscriptions:'#a855f7','Credit Card':'#ef4444', Loan:'#f97316', Medical:'#ec4899', Other:'#94a3b8' };

async function renderPayments() {
  const sumEl  = document.getElementById('payment-summary');
  const listEl = document.getElementById('payment-list');
  listEl.innerHTML = loadingCard();
  const list = await dbGet('payments');
  list.sort((a,b) => a.date.localeCompare(b.date));
  const total  = list.reduce((s,p) => s + parseFloat(p.amount||0), 0);
  const unpaid = list.filter(p => p.status === 'unpaid').reduce((s,p) => s + parseFloat(p.amount||0), 0);
  const paid   = list.filter(p => p.status === 'paid').reduce((s,p) => s + parseFloat(p.amount||0), 0);
  sumEl.innerHTML = `
    <div class="summary-card total"><div class="amount">$${total.toFixed(2)}</div><div class="label">Total Due</div></div>
    <div class="summary-card unpaid"><div class="amount">$${unpaid.toFixed(2)}</div><div class="label">Unpaid</div></div>
    <div class="summary-card paid"><div class="amount">$${paid.toFixed(2)}</div><div class="label">Paid</div></div>`;
  if (!list.length) {
    listEl.innerHTML = `<div class="empty-state"><i class="fa-solid fa-credit-card"></i>No payments yet.</div>`;
    return;
  }
  listEl.innerHTML = list.map(p => {
    const diff = daysFromToday(p.date);
    let statusBadge = `<span class="badge ${p.status}">${p.status === 'paid' ? 'Paid' : 'Unpaid'}</span>`;
    if (p.status === 'unpaid' && diff !== null && diff < 0) statusBadge += ` <span class="badge overdue">Overdue</span>`;
    else if (p.status === 'unpaid' && diff !== null && diff <= 3) statusBadge += ` <span class="badge upcoming">Due Soon</span>`;
    const color = catColors[p.category] || '#94a3b8';
    return `
    <div class="card">
      <div class="card-color-bar" style="background:${color}"></div>
      <div class="card-title" style="display:flex;justify-content:space-between;align-items:center;padding-right:.5rem">
        <span><i class="fa-solid fa-receipt" style="color:${color};margin-right:.4rem"></i>${p.name}</span>
        <span style="font-size:1.1rem;color:${color}">$${parseFloat(p.amount||0).toFixed(2)}</span>
      </div>
      <div class="card-meta">
        <span><i class="fa-regular fa-calendar"></i>Due: ${formatDate(p.date)}</span>
        <span><i class="fa-solid fa-tag"></i>${p.category}</span>
        <span style="margin-top:.2rem">${statusBadge}</span>
      </div>
      ${countdownBadge(p.date)}
      ${p.notes ? `<div class="card-notes">${p.notes}</div>` : ''}
      <div class="card-actions">
        <button class="btn-toggle-paid" onclick="togglePaid(${p.id})">
          <i class="fa-solid fa-${p.status === 'paid' ? 'rotate-left' : 'check'}"></i>
          ${p.status === 'paid' ? 'Mark Unpaid' : 'Mark Paid'}
        </button>
        <button class="btn-delete" onclick="deletePayment(${p.id})"><i class="fa-solid fa-trash"></i> Delete</button>
      </div>
    </div>`;
  }).join('');
}

// ===== WORK SCHEDULE =====
async function saveWorkDay() {
  const date  = document.getElementById('work-date').value;
  const type  = document.getElementById('work-type').value;
  const notes = document.getElementById('work-notes').value.trim();
  if (!date) return alert('Please select a date.');
  const obj = { id: date, date, type, notes };
  closeModal('work-modal');
  document.getElementById('work-date').value = '';
  document.getElementById('work-notes').value = '';
  await dbSave('workdays', obj);
  renderWorkCalendar();
}

async function deleteWorkDay(date) {
  if (!confirm('Remove this work day?')) return;
  await dbDelete('workdays', date);
  renderWorkCalendar();
}

async function renderWorkCalendar() {
  const list = await dbGet('workdays');
  const map = {};
  list.forEach(w => map[w.date] = w.type);
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const todayStr = now.toISOString().slice(0,10);
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = now.toLocaleDateString('en-US', { month:'long', year:'numeric' });
  const dayLabels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  let html = `<div class="work-month-title">${monthName}</div>`;
  html += `<div class="work-week-row">${dayLabels.map(d => `<div class="work-day-label">${d}</div>`).join('')}</div>`;
  let cells = '<div class="work-week-row">';
  for (let i = 0; i < firstDay; i++) cells += '<div class="work-day-cell empty"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const type = map[dateStr];
    const todayClass = dateStr === todayStr ? ' today' : '';
    const typeClass = type ? ` is-${type}` : ' normal';
    const tag = type ? `<span class="work-day-tag">${type === 'office' ? 'Office' : type === 'wfh' ? 'WFH' : 'Off'}</span>` : '';
    cells += `<div class="work-day-cell${typeClass}${todayClass}"><span class="work-day-num">${d}</span>${tag}</div>`;
    if ((firstDay + d) % 7 === 0 && d !== daysInMonth) cells += '</div><div class="work-week-row">';
  }
  cells += '</div>';
  document.getElementById('work-calendar').innerHTML = html + cells;
  renderWorkList(list);
}

function renderWorkList(list) {
  const el = document.getElementById('work-list');
  if (!list || !list.length) {
    el.innerHTML = `<div class="empty-state"><i class="fa-solid fa-briefcase"></i>No work days logged yet.</div>`;
    return;
  }
  const today = new Date().toISOString().slice(0,10);
  const upcoming = list.filter(w => w.date >= today).slice(0,12);
  const colors = { office:'#0097a7', wfh:'#00bcd4', off:'#94a3b8' };
  el.innerHTML = upcoming.map(w => `
    <div class="card">
      <div class="card-color-bar" style="background:${colors[w.type]||'#0097a7'}"></div>
      <div class="card-title"><span class="badge ${w.type}">${w.type === 'office' ? 'Office' : w.type === 'wfh' ? 'Work From Home' : 'Day Off'}</span></div>
      <div class="card-meta" style="margin-top:.5rem">
        <span><i class="fa-regular fa-calendar"></i>${formatDate(w.date)}</span>
      </div>
      ${countdownBadge(w.date)}
      ${w.notes ? `<div class="card-notes">${w.notes}</div>` : ''}
      <div class="card-actions">
        <button class="btn-delete" onclick="deleteWorkDay('${w.date}')"><i class="fa-solid fa-trash"></i> Delete</button>
      </div>
    </div>`).join('');
}

// ===== COLLEGE =====
async function saveCollege() {
  const student = document.getElementById('college-student').value;
  const term    = document.getElementById('college-term').value.trim();
  const start   = document.getElementById('college-start').value;
  const end     = document.getElementById('college-end').value;
  const campus  = document.getElementById('college-campus').value.trim();
  const notes   = document.getElementById('college-notes').value.trim();
  if (!term || !start) return alert('Please enter term and start date.');
  const obj = { id: Date.now(), student, term, start, end, campus, notes };
  closeModal('college-modal');
  ['college-term','college-start','college-end','college-campus','college-notes'].forEach(id => document.getElementById(id).value = '');
  await dbSave('college', obj);
  renderCollege();
}

async function deleteCollege(id) {
  if (!confirm('Delete this semester?')) return;
  await dbDelete('college', id);
  renderCollege();
}

async function renderCollege() {
  document.getElementById('college-list-rg').innerHTML = loadingCard();
  document.getElementById('college-list-kg').innerHTML = loadingCard();
  const list = await dbGet('college');
  list.sort((a,b) => a.start.localeCompare(b.start));
  const rgList = list.filter(c => c.student === 'Rikhu Giri');
  const kgList = list.filter(c => c.student === 'Kusum Giri');

  function buildCards(items, color) {
    if (!items.length) return `<div class="empty-state"><i class="fa-solid fa-graduation-cap"></i>No semesters added yet.</div>`;
    return items.map(c => {
      let duration = '';
      if (c.start && c.end) {
        const days = Math.round((new Date(c.end) - new Date(c.start)) / 86400000);
        duration = `~${Math.round(days/7)} weeks`;
      }
      return `
      <div class="card">
        <div class="card-color-bar" style="background:${color}"></div>
        <div class="card-title">${c.term}</div>
        <div class="card-meta">
          <span><i class="fa-solid fa-play"></i>Start: ${formatDate(c.start)}</span>
          ${c.end ? `<span><i class="fa-solid fa-stop"></i>End: ${formatDate(c.end)}</span>` : ''}
          ${duration ? `<span><i class="fa-regular fa-clock"></i>${duration}</span>` : ''}
          ${c.campus ? `<span><i class="fa-solid fa-building-columns"></i>${c.campus}</span>` : ''}
        </div>
        ${countdownBadge(c.start)}
        ${c.notes ? `<div class="card-notes">${c.notes}</div>` : ''}
        <div class="card-actions">
          <button class="btn-delete" onclick="deleteCollege(${c.id})"><i class="fa-solid fa-trash"></i> Delete</button>
        </div>
      </div>`;
    }).join('');
  }

  document.getElementById('college-list-rg').innerHTML = buildCards(rgList, 'var(--accent)');
  document.getElementById('college-list-kg').innerHTML = buildCards(kgList, 'var(--green)');
}

// ===== SCHOOL =====
async function saveSchool() {
  const child  = document.getElementById('school-child').value;
  const type   = document.getElementById('school-type').value;
  const name   = document.getElementById('school-name').value.trim();
  const start  = document.getElementById('school-start').value;
  const end    = document.getElementById('school-end').value;
  const notes  = document.getElementById('school-notes').value.trim();
  if (!start) return alert('Please enter a start date.');
  const obj = { id: Date.now(), child, type, name, start, end, notes };
  closeModal('school-modal');
  ['school-name','school-start','school-end','school-notes'].forEach(id => document.getElementById(id).value = '');
  await dbSave('school', obj);
  renderSchool();
}

async function deleteSchool(id) {
  if (!confirm('Delete this school event?')) return;
  await dbDelete('school', id);
  renderSchool();
}

const schoolTypeIcon  = { start:'fa-play', end:'fa-stop', break:'fa-umbrella-beach', event:'fa-star', exam:'fa-pencil', other:'fa-circle-info' };
const schoolTypeLabel = { start:'School Year Start', end:'School Year End', break:'Break / Holiday', event:'School Event', exam:'Exam / Test', other:'Other' };

async function renderSchool() {
  document.getElementById('school-list-prisha').innerHTML = loadingCard();
  document.getElementById('school-list-cianna').innerHTML = loadingCard();
  const list = await dbGet('school');
  list.sort((a,b) => a.start.localeCompare(b.start));
  const prishaList = list.filter(s => s.child === 'Prisha');
  const ciannaList = list.filter(s => s.child === 'Cianna');

  function buildCards(items, color) {
    if (!items.length) return `<div class="empty-state"><i class="fa-solid fa-school"></i>No events added yet.</div>`;
    return items.map(s => `
      <div class="card">
        <div class="card-color-bar" style="background:${color}"></div>
        <div class="card-title"><i class="fa-solid ${schoolTypeIcon[s.type]||'fa-circle-info'}" style="color:${color};margin-right:.3rem"></i>${schoolTypeLabel[s.type]||s.type}</div>
        <div class="card-meta">
          ${s.name ? `<span><i class="fa-solid fa-school"></i>${s.name}</span>` : ''}
          <span><i class="fa-regular fa-calendar"></i>Start: ${formatDate(s.start)}</span>
          ${s.end ? `<span><i class="fa-regular fa-calendar-check"></i>End: ${formatDate(s.end)}</span>` : ''}
        </div>
        ${countdownBadge(s.start)}
        ${s.notes ? `<div class="card-notes">${s.notes}</div>` : ''}
        <div class="card-actions">
          <button class="btn-delete" onclick="deleteSchool(${s.id})"><i class="fa-solid fa-trash"></i> Delete</button>
        </div>
      </div>`).join('');
  }

  document.getElementById('school-list-prisha').innerHTML = buildCards(prishaList, 'var(--purple)');
  document.getElementById('school-list-cianna').innerHTML = buildCards(ciannaList, 'var(--pink)');
}

// ===== WEATHER =====
async function fetchWeather(cityOverride) {
  const cityInput = document.getElementById('city-input');
  const city = cityOverride || cityInput.value.trim();
  if (!city) return;
  const display = document.getElementById('weather-display');
  display.innerHTML = `<div class="weather-placeholder"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><p>Loading weather for ${city}...</p></div>`;
  try {
    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
    const geoData = await geoRes.json();
    if (!geoData.results || !geoData.results.length) throw new Error('City not found');
    const { latitude, longitude, name, country } = geoData.results[0];
    const wxRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,precipitation&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`);
    const wx = await wxRes.json();
    const c = wx.current;
    const desc = weatherDesc(c.weather_code);
    const icon = weatherIcon(c.weather_code);
    document.getElementById('weather-mini').textContent = `${name}: ${Math.round(c.temperature_2m)}°F ${desc}`;
    if (cityOverride && cityInput) cityInput.value = city;
    display.innerHTML = `
      <div class="weather-card">
        <div class="weather-city"><i class="fa-solid fa-location-dot" style="color:#ef4444;margin-right:.4rem"></i>${name}</div>
        <div class="weather-country">${country}</div>
        <div class="weather-temp"><i class="${icon}" style="font-size:2.5rem;margin-right:.5rem"></i>${Math.round(c.temperature_2m)}°F</div>
        <div class="weather-desc">${desc}</div>
        <div class="weather-grid">
          <div class="weather-item"><div class="wi-label">Feels Like</div><div class="wi-val">${Math.round(c.apparent_temperature)}°F</div></div>
          <div class="weather-item"><div class="wi-label">Humidity</div><div class="wi-val">${c.relative_humidity_2m}%</div></div>
          <div class="weather-item"><div class="wi-label">Wind Speed</div><div class="wi-val">${Math.round(c.wind_speed_10m)} mph</div></div>
          <div class="weather-item"><div class="wi-label">Precipitation</div><div class="wi-val">${c.precipitation} mm</div></div>
        </div>
        <div style="font-size:.75rem;color:var(--text3);margin-top:1rem"><i class="fa-regular fa-clock"></i> Updated: ${new Date().toLocaleTimeString()} • Source: Open-Meteo</div>
      </div>`;
  } catch(e) {
    display.innerHTML = `<div class="weather-placeholder"><i class="fa-solid fa-triangle-exclamation fa-2x" style="color:#ef4444"></i><p>Could not find weather for "${city}". Try a different city name.</p></div>`;
  }
}

function autoLoadWeather() {
  const display = document.getElementById('weather-display');
  display.innerHTML = `<div class="weather-placeholder"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><p>Detecting your location...</p></div>`;
  if (!navigator.geolocation) {
    display.innerHTML = `<div class="weather-placeholder"><i class="fa-solid fa-triangle-exclamation fa-2x" style="color:#f97316"></i><p>Location not supported. Please enter a city manually.</p></div>`;
    return;
  }
  navigator.geolocation.getCurrentPosition(async (pos) => {
    try {
      const { latitude, longitude } = pos.coords;
      const wxRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,precipitation&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`);
      const wx = await wxRes.json();
      const c = wx.current;
      const desc = weatherDesc(c.weather_code);
      const icon = weatherIcon(c.weather_code);
      const revRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
      const revData = await revRes.json();
      const cityName = revData.address.city || revData.address.town || revData.address.village || revData.address.county || 'Your Location';
      const country  = revData.address.country || '';
      document.getElementById('weather-mini').textContent = `${cityName}: ${Math.round(c.temperature_2m)}°F ${desc}`;
      document.getElementById('city-input').value = cityName;
      display.innerHTML = `
        <div class="weather-card">
          <div class="weather-city"><i class="fa-solid fa-location-crosshairs" style="color:#00bcd4;margin-right:.4rem"></i>${cityName}</div>
          <div class="weather-country">${country} &nbsp;<span style="font-size:.75rem;color:var(--text3)">Auto-detected • Updates every 10 min</span></div>
          <div class="weather-temp"><i class="${icon}" style="font-size:2.5rem;margin-right:.5rem"></i>${Math.round(c.temperature_2m)}°F</div>
          <div class="weather-desc">${desc}</div>
          <div class="weather-grid">
            <div class="weather-item"><div class="wi-label">Feels Like</div><div class="wi-val">${Math.round(c.apparent_temperature)}°F</div></div>
            <div class="weather-item"><div class="wi-label">Humidity</div><div class="wi-val">${c.relative_humidity_2m}%</div></div>
            <div class="weather-item"><div class="wi-label">Wind Speed</div><div class="wi-val">${Math.round(c.wind_speed_10m)} mph</div></div>
            <div class="weather-item"><div class="wi-label">Precipitation</div><div class="wi-val">${c.precipitation} mm</div></div>
          </div>
          <div style="font-size:.75rem;color:var(--text3);margin-top:1rem"><i class="fa-regular fa-clock"></i> Last updated: ${new Date().toLocaleTimeString()} • Source: Open-Meteo</div>
        </div>`;
    } catch(e) {
      display.innerHTML = `<div class="weather-placeholder"><i class="fa-solid fa-triangle-exclamation fa-2x" style="color:#ef4444"></i><p>Could not load weather. Please enter a city manually.</p></div>`;
    }
  }, () => {
    display.innerHTML = `<div class="weather-placeholder"><i class="fa-solid fa-lock fa-2x" style="color:#f97316"></i>
      <p>Location access was denied.</p>
      <p style="font-size:.85rem;margin-top:.5rem">Please allow location access or type your city above.</p></div>`;
    document.getElementById('weather-mini').textContent = 'Enter city in Weather tab';
  }, { timeout: 10000 });
}

setInterval(() => autoLoadWeather(), 10 * 60 * 1000);

function weatherDesc(code) {
  const map = {0:'Clear Sky',1:'Mainly Clear',2:'Partly Cloudy',3:'Overcast',45:'Foggy',48:'Icy Fog',51:'Light Drizzle',53:'Drizzle',55:'Heavy Drizzle',61:'Slight Rain',63:'Rain',65:'Heavy Rain',71:'Slight Snow',73:'Snow',75:'Heavy Snow',80:'Rain Showers',81:'Rain Showers',82:'Violent Rain',95:'Thunderstorm',96:'Thunderstorm w/ Hail',99:'Thunderstorm w/ Heavy Hail'};
  return map[code] || 'Unknown';
}

function weatherIcon(code) {
  if (code === 0 || code === 1) return 'fa-solid fa-sun';
  if (code === 2) return 'fa-solid fa-cloud-sun';
  if (code === 3) return 'fa-solid fa-cloud';
  if (code <= 48) return 'fa-solid fa-smog';
  if (code <= 55) return 'fa-solid fa-cloud-drizzle';
  if (code <= 65) return 'fa-solid fa-cloud-rain';
  if (code <= 75) return 'fa-solid fa-snowflake';
  if (code <= 82) return 'fa-solid fa-cloud-showers-heavy';
  return 'fa-solid fa-cloud-bolt';
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  renderAppointments();
  renderReminders();
  renderTravel();
  renderPayments();
  renderWorkCalendar();
  renderCollege();
  renderSchool();
  autoLoadWeather();
});
