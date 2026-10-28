// attendance.js - Daily Attendance Management

let studentsList = [];
let attendanceMap = {}; // Key: `${student_id}_${period}` -> 'Present' | 'Absent'

document.addEventListener('DOMContentLoaded', async () => {
  const dateInput = document.getElementById('attendance-date');
  const deptFilter = document.getElementById('attendance-dept-filter');
  const btnMarkAllPresent = document.getElementById('btn-mark-all-present');
  const btnMarkAllAbsent = document.getElementById('btn-mark-all-absent');
  const btnSaveAttendance = document.getElementById('btn-save-attendance');

  // Check URL query param for date or default to today
  const urlParams = new URLSearchParams(window.location.search);
  const queryDate = urlParams.get('date');

  const todayStr = getTodayDateString();
  dateInput.value = queryDate || todayStr;

  // Event Listeners
  dateInput.addEventListener('change', () => loadDailyAttendance(dateInput.value));
  deptFilter.addEventListener('change', renderAttendanceTable);
  btnMarkAllPresent.addEventListener('click', () => setAllAttendance('Present'));
  btnMarkAllAbsent.addEventListener('click', () => setAllAttendance('Absent'));
  btnSaveAttendance.addEventListener('click', saveAttendance);

  // Initial load
  await loadStudents();
  await loadDailyAttendance(dateInput.value);
});

// Helper to get local date string YYYY-MM-DD
function getTodayDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Fetch all registered students
async function loadStudents() {
  try {
    const res = await fetch('/api/students');
    if (!res.ok) throw new Error('Failed to load students');
    studentsList = await res.json();
  } catch (error) {
    console.error('Error fetching students:', error);
    showToast('Failed to load students: ' + error.message, 'error');
  }
}

// Fetch attendance records for a specific date
async function loadDailyAttendance(date) {
  if (!date) return;

  const statusMsg = document.getElementById('attendance-status-message');
  attendanceMap = {};

  try {
    const res = await fetch(`/api/attendance/${date}`);
    if (!res.ok) throw new Error('Failed to fetch attendance');
    const data = await res.json();

    const records = data.records || [];
    if (records.length > 0) {
      records.forEach(r => {
        attendanceMap[`${r.student_id}_${r.period}`] = r.status;
      });
      statusMsg.className = 'alert alert-success';
      statusMsg.textContent = `📋 Loaded previously saved attendance for ${date} (${records.length} records found).`;
      statusMsg.style.display = 'block';
    } else {
      // No saved records for this date: initialize all to 'Present' by default
      studentsList.forEach(s => {
        for (let p = 1; p <= 7; p++) {
          attendanceMap[`${s.id}_${p}`] = 'Present';
        }
      });
      statusMsg.className = 'alert alert-info';
      statusMsg.textContent = `ℹ️ No saved attendance found for ${date}. Showing default "Present" for all periods. Click "Save Attendance" to record.`;
      statusMsg.style.display = 'block';
    }

    renderAttendanceTable();
  } catch (error) {
    console.error('Error loading attendance for date:', error);
    showToast('Error loading date attendance: ' + error.message, 'error');
  }
}

// Render Attendance Table
function renderAttendanceTable() {
  const tbody = document.getElementById('tbody-attendance');
  const deptFilter = document.getElementById('attendance-dept-filter').value;

  const filteredStudents = studentsList.filter(s => {
    return !deptFilter || s.department === deptFilter;
  });

  if (filteredStudents.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 2rem; color: var(--text-muted);">
          No registered students found for this department. 
          <a href="students.html">Add students in Student Management</a>.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filteredStudents.map(student => {
    let periodCols = '';
    for (let period = 1; period <= 7; period++) {
      const currentStatus = attendanceMap[`${student.id}_${period}`] || 'Present';
      const isPresent = currentStatus === 'Present';
      const btnClass = isPresent ? 'period-btn present' : 'period-btn absent';
      const btnText = isPresent ? 'P' : 'A';

      periodCols += `
        <td class="period-cell">
          <button 
            type="button" 
            class="${btnClass}" 
            data-student-id="${student.id}" 
            data-period="${period}"
            id="period-btn-${student.id}-${period}"
            onclick="togglePeriod(${student.id}, ${period})">
            ${btnText}
          </button>
        </td>
      `;
    }

    return `
      <tr class="attendance-row" id="attendance-row-${student.id}">
        <td><strong>${escapeHtml(student.roll_no)}</strong></td>
        <td>
          <div>${escapeHtml(student.name)}</div>
          <small style="color: var(--text-muted); font-size: 0.75rem;">${escapeHtml(student.department)}</small>
        </td>
        ${periodCols}
      </tr>
    `;
  }).join('');
}

// Toggle status of a single period for a student
function togglePeriod(studentId, period) {
  const key = `${studentId}_${period}`;
  const current = attendanceMap[key] || 'Present';
  const newStatus = current === 'Present' ? 'Absent' : 'Present';
  attendanceMap[key] = newStatus;

  // Update button in DOM
  const btn = document.getElementById(`period-btn-${studentId}-${period}`);
  if (btn) {
    if (newStatus === 'Present') {
      btn.className = 'period-btn present';
      btn.textContent = 'P';
    } else {
      btn.className = 'period-btn absent';
      btn.textContent = 'A';
    }
  }
}

// Set all visible periods to Present or Absent
function setAllAttendance(status) {
  const deptFilter = document.getElementById('attendance-dept-filter').value;
  const filteredStudents = studentsList.filter(s => !deptFilter || s.department === deptFilter);

  filteredStudents.forEach(student => {
    for (let p = 1; p <= 7; p++) {
      attendanceMap[`${student.id}_${p}`] = status;
    }
  });

  renderAttendanceTable();
  showToast(`Marked all ${status.toLowerCase()} for ${filteredStudents.length} students.`, 'info');
}

// Save attendance to backend
async function saveAttendance() {
  const dateInput = document.getElementById('attendance-date');
  const date = dateInput.value;
  const btnSave = document.getElementById('btn-save-attendance');
  const statusMsg = document.getElementById('attendance-status-message');

  if (!date) {
    showToast('Please select a valid date.', 'error');
    return;
  }

  // Build records payload
  const records = [];
  studentsList.forEach(student => {
    for (let period = 1; period <= 7; period++) {
      const status = attendanceMap[`${student.id}_${period}`] || 'Present';
      records.push({
        student_id: student.id,
        period,
        status
      });
    }
  });

  if (records.length === 0) {
    showToast('No students registered to mark attendance.', 'error');
    return;
  }

  btnSave.disabled = true;
  btnSave.textContent = '⏳ Saving...';

  try {
    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, records })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Failed to save attendance');
    }

    statusMsg.className = 'alert alert-success';
    statusMsg.textContent = `✅ Attendance successfully saved for ${date}! (${records.length} period records saved).`;
    statusMsg.style.display = 'block';

    showToast(`Attendance saved successfully for ${date}!`, 'success');
  } catch (error) {
    console.error('Error saving attendance:', error);
    statusMsg.className = 'alert alert-danger';
    statusMsg.textContent = `❌ Error saving attendance: ${error.message}`;
    statusMsg.style.display = 'block';
    showToast('Failed to save attendance: ' + error.message, 'error');
  } finally {
    btnSave.disabled = false;
    btnSave.textContent = '💾 Save Attendance';
  }
}

// Utility functions
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = type;
  toast.style.display = 'block';

  setTimeout(() => {
    toast.style.display = 'none';
  }, 3500);
}
