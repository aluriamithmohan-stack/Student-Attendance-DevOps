// report.js - Monthly Attendance Report, Combined Academic Performance & CSV Export

let currentReportData = null;

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

document.addEventListener('DOMContentLoaded', () => {
  const monthSelect = document.getElementById('report-month');
  const yearInput = document.getElementById('report-year');
  const thresholdInput = document.getElementById('report-threshold');
  const btnGenerate = document.getElementById('btn-generate-report');
  const btnExport = document.getElementById('btn-export-csv');

  // Set default month & year (Default: October 2026 for sample data)
  monthSelect.value = "10";
  yearInput.value = "2026";
  thresholdInput.value = "75";

  // Event Listeners
  btnGenerate.addEventListener('click', loadMonthlyReport);
  btnExport.addEventListener('click', triggerCSVExport);

  // Modal close handlers
  const modalClose = document.getElementById('btn-close-student-modal');
  const modalCloseBottom = document.getElementById('btn-modal-close-bottom');
  if (modalClose) modalClose.addEventListener('click', closeStudentModal);
  if (modalCloseBottom) modalCloseBottom.addEventListener('click', closeStudentModal);

  // Modal tabs
  const tabAttendance = document.getElementById('tab-btn-attendance');
  const tabAcademics = document.getElementById('tab-btn-academics');
  const contentAttendance = document.getElementById('tab-content-attendance');
  const contentAcademics = document.getElementById('tab-content-academics');

  if (tabAttendance && tabAcademics) {
    tabAttendance.addEventListener('click', () => {
      tabAttendance.className = 'btn btn-primary btn-sm';
      tabAcademics.className = 'btn btn-secondary btn-sm';
      contentAttendance.style.display = 'block';
      contentAcademics.style.display = 'none';
    });

    tabAcademics.addEventListener('click', () => {
      tabAcademics.className = 'btn btn-primary btn-sm';
      tabAttendance.className = 'btn btn-secondary btn-sm';
      contentAttendance.style.display = 'none';
      contentAcademics.style.display = 'block';
    });
  }

  // Check URL query params (e.g. if arriving from dashboard)
  const urlParams = new URLSearchParams(window.location.search);
  const targetStudentId = urlParams.get('student_id');

  loadMonthlyReport().then(() => {
    if (targetStudentId) {
      viewStudentReport(targetStudentId);
    }
  });
});

// Load monthly attendance report
async function loadMonthlyReport() {
  const month = document.getElementById('report-month').value;
  const year = document.getElementById('report-year').value;
  const threshold = document.getElementById('report-threshold').value || 75;

  const btnGenerate = document.getElementById('btn-generate-report');
  btnGenerate.disabled = true;
  btnGenerate.textContent = '⏳ Loading...';

  try {
    const res = await fetch(`/api/report/monthly?month=${month}&year=${year}&threshold=${threshold}`, {
      headers: typeof getAuthHeaders === 'function' ? getAuthHeaders() : {}
    });
    if (!res.ok) throw new Error('Failed to fetch monthly report');
    currentReportData = await res.json();

    updateReportSummary(currentReportData);
    renderReportTable(currentReportData);
  } catch (error) {
    console.error('Error fetching report:', error);
    showToast('Failed to generate report: ' + error.message, 'error');
  } finally {
    btnGenerate.disabled = false;
    btnGenerate.textContent = '🔄 Generate Report';
  }
}

// Update Top KPI Cards
function updateReportSummary(data) {
  const workingPeriodsEl = document.getElementById('summary-working-periods');
  const classAvgEl = document.getElementById('summary-class-avg');
  const defaultersCountEl = document.getElementById('summary-defaulters-count');
  const thresholdValEl = document.getElementById('summary-threshold-val');
  const dateBadge = document.getElementById('report-date-badge');

  thresholdValEl.textContent = data.threshold;
  dateBadge.textContent = `${monthNames[data.month - 1]} ${data.year}`;

  const students = data.students || [];
  workingPeriodsEl.textContent = data.total_working_periods || 0;

  if (students.length > 0) {
    const totalPresent = students.reduce((sum, s) => sum + s.present, 0);
    const totalWorking = students.reduce((sum, s) => sum + s.working_periods, 0);
    const avg = totalWorking > 0 ? ((totalPresent / totalWorking) * 100).toFixed(2) : '0.00';
    classAvgEl.textContent = `${avg}%`;
  } else {
    classAvgEl.textContent = '0.00%';
  }

  defaultersCountEl.textContent = data.below_threshold_count || 0;
}

// Render Table matching sample specification
function renderReportTable(data) {
  const tbody = document.getElementById('tbody-monthly-report');
  const students = data.students || [];

  if (students.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-muted);">
          No student records found. Add students in Student Management.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = students.map(student => {
    const isBelow = student.below_threshold;
    const pctClass = isBelow ? 'color: var(--danger); font-weight: 700;' : 'color: var(--dark); font-weight: 600;';
    const alertBadge = isBelow 
      ? `<br><span class="badge badge-danger" style="margin-top: 3px; font-size: 0.7rem;">Below ${data.threshold}%</span>` 
      : '';

    const pctDisplay = student.attendance_percentage !== null 
      ? `${student.attendance_percentage.toFixed(2)}%` 
      : 'N/A';

    return `
      <tr class="report-row ${isBelow ? 'defaulter-row-warning' : ''}" id="report-row-${student.id}" data-testid="report-row-${student.roll_no}">
        <td><strong>${escapeHtml(student.roll_no)}</strong></td>
        <td>${escapeHtml(student.name)}</td>
        <td><span class="badge badge-info">${escapeHtml(student.department)}</span></td>
        <td style="text-align: right;">${student.working_periods}</td>
        <td style="text-align: right; color: var(--success); font-weight: 600;">${student.present}</td>
        <td style="text-align: right; color: var(--danger); font-weight: 600;">${student.absent}</td>
        <td style="text-align: right; ${pctClass}">
          <span class="attendance-pct" data-testid="attendance-percentage">${pctDisplay}</span>
          ${alertBadge}
        </td>
        <td style="text-align: center;">
          <button 
            type="button" 
            class="btn btn-secondary btn-sm" 
            onclick="viewStudentReport(${student.id})"
            id="btn-view-student-${student.id}"
            data-testid="view-student-${student.roll_no}">
            🔍 View
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// View individual student detailed combined report modal
async function viewStudentReport(studentId) {
  const month = document.getElementById('report-month').value;
  const year = document.getElementById('report-year').value;

  try {
    const res = await fetch(`/api/report/student/${studentId}?month=${month}&year=${year}`, {
      headers: typeof getAuthHeaders === 'function' ? getAuthHeaders() : {}
    });
    if (!res.ok) throw new Error('Failed to load student details');
    const data = await res.json();

    const modal = document.getElementById('modal-student-report');
    const nameEl = document.getElementById('modal-student-name');
    const infoEl = document.getElementById('modal-student-info');
    const tbodyBreakdown = document.getElementById('tbody-student-breakdown');
    const tbodyAcademics = document.getElementById('tbody-student-academics');

    nameEl.textContent = `${data.student.name} (${data.student.roll_no})`;

    const isBelow = data.attendance_percentage !== null && data.attendance_percentage < 75;
    const statusBadge = data.attendance_percentage === null
      ? `<span class="badge badge-secondary">No Records</span>`
      : isBelow 
        ? `<span class="badge badge-danger">Below 75% Threshold</span>`
        : `<span class="badge badge-success">Satisfactory Attendance</span>`;

    const pctDisplay = data.attendance_percentage !== null 
      ? `${data.attendance_percentage.toFixed(2)}%` 
      : 'N/A';

    infoEl.innerHTML = `
      <div style="background-color: var(--bg-page); padding: 1rem; border-radius: var(--radius); border: 1px solid var(--border); display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.75rem;">
        <div>
          <small style="color: var(--text-muted); display: block;">Department</small>
          <strong>${escapeHtml(data.student.department)}</strong>
        </div>
        <div>
          <small style="color: var(--text-muted); display: block;">Working Periods</small>
          <strong>${data.total_working_periods}</strong>
        </div>
        <div>
          <small style="color: var(--text-muted); display: block;">Attended</small>
          <strong style="color: var(--success);">${data.present_periods}</strong>
        </div>
        <div>
          <small style="color: var(--text-muted); display: block;">Absent</small>
          <strong style="color: var(--danger);">${data.absent_periods}</strong>
        </div>
        <div>
          <small style="color: var(--text-muted); display: block;">Attendance %</small>
          <strong style="color: ${isBelow ? 'var(--danger)' : 'var(--success)'}; font-size: 1.1rem;">
            ${pctDisplay}
          </strong>
        </div>
        <div style="display: flex; align-items: center;">
          ${statusBadge}
        </div>
      </div>
    `;

    // 1. Daily Attendance History
    const history = data.history || [];
    if (history.length === 0) {
      tbodyBreakdown.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 1.5rem; color: var(--text-muted);">
            No attendance records found for this student in ${monthNames[data.month - 1]} ${data.year}.
          </td>
        </tr>
      `;
    } else {
      tbodyBreakdown.innerHTML = history.map(row => {
        let periodCells = '';
        for (let p = 1; p <= 7; p++) {
          const st = row.periods[p] || '-';
          const isP = st === 'Present';
          const isA = st === 'Absent';
          const pillClass = isP ? 'legend-pill legend-present' : (isA ? 'legend-pill legend-absent' : '');
          const pillText = isP ? 'P' : (isA ? 'A' : '-');
          periodCells += `<td class="period-cell"><span class="${pillClass}" style="margin: 0; padding: 2px 8px; font-size: 0.8rem;">${pillText}</span></td>`;
        }

        return `
          <tr>
            <td><strong>${row.date}</strong></td>
            ${periodCells}
            <td style="text-align: right; font-weight: 600;">${row.present_count} / 7</td>
          </tr>
        `;
      }).join('');
    }

    // 2. Internal Marks / Academic Performance
    const marks = data.internal_marks || [];
    if (marks.length === 0) {
      tbodyAcademics.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 1.5rem; color: var(--text-muted);">
            No internal assessment marks recorded for this student. <a href="marks.html">Enter marks in Internal Marks</a>.
          </td>
        </tr>
      `;
    } else {
      tbodyAcademics.innerHTML = marks.map(m => `
        <tr>
          <td><strong>${escapeHtml(m.subject)}</strong></td>
          <td>${escapeHtml(m.assessment_name)}</td>
          <td style="text-align: right; font-weight: 600;">${m.marks_obtained}</td>
          <td style="text-align: right; color: var(--text-muted);">${m.max_marks}</td>
          <td style="text-align: right; font-weight: 700; color: ${m.marks_percentage >= 75 ? 'var(--success)' : 'var(--danger)'};">
            ${m.marks_percentage}%
          </td>
        </tr>
      `).join('');
    }

    modal.classList.add('active');
  } catch (error) {
    showToast('Failed to view student report: ' + error.message, 'error');
  }
}

function closeStudentModal() {
  const modal = document.getElementById('modal-student-report');
  modal.classList.remove('active');
}

// CSV Export via Backend API
function triggerCSVExport() {
  const month = document.getElementById('report-month').value;
  const year = document.getElementById('report-year').value;
  const threshold = document.getElementById('report-threshold').value || 75;

  const exportUrl = `/api/report/monthly/export?month=${month}&year=${year}&threshold=${threshold}`;
  
  // Download using invisible anchor
  const link = document.createElement('a');
  link.href = exportUrl;
  link.setAttribute('download', `attendance_report_${year}-${String(month).padStart(2, '0')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast(`Downloading monthly CSV export for ${monthNames[month - 1]} ${year}...`, 'success');
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
