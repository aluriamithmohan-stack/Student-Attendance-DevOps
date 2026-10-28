// script.js - Dashboard logic

document.addEventListener('DOMContentLoaded', () => {
  loadDashboardData();
});

async function loadDashboardData() {
  try {
    const response = await fetch('/api/dashboard');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();

    // 1. Update Date Badge
    const dateBadge = document.getElementById('current-date-badge');
    if (dateBadge) {
      dateBadge.textContent = `Today: ${data.today_date}`;
    }

    // 2. Update KPI Stats
    document.getElementById('stat-total-students').textContent = data.total_students || 0;
    document.getElementById('stat-today-present').textContent = data.today_present || 0;
    document.getElementById('stat-today-absent').textContent = data.today_absent || 0;
    document.getElementById('stat-low-attendance').textContent = data.below_75_count || 0;

    // 3. Update Attendance Status Banner
    const banner = document.getElementById('attendance-status-banner');
    const bannerText = document.getElementById('attendance-status-text');
    if (data.is_today_marked) {
      banner.className = 'alert alert-success';
      bannerText.textContent = `✅ Today's attendance has been marked (${data.today_total_marks} period records recorded).`;
    } else {
      banner.className = 'alert alert-warning';
      bannerText.textContent = `⚠️ Attendance has NOT yet been saved for today (${data.today_date}).`;
    }

    // 4. Update Defaulters Table
    const tbody = document.getElementById('tbody-defaulters');
    const defaulterBadge = document.getElementById('badge-defaulter-count');
    const defaulters = data.below_75_students || [];

    defaulterBadge.textContent = `${defaulters.length} Student(s)`;

    if (defaulters.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--success); padding: 1.5rem; font-weight: 500;">
            🎉 Great job! All students are maintaining attendance at or above 75%.
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = defaulters.map(student => `
        <tr class="defaulter-row">
          <td><strong>${escapeHtml(student.roll_no)}</strong></td>
          <td>${escapeHtml(student.name)}</td>
          <td>${escapeHtml(student.department)}</td>
          <td>${student.present} / ${student.total} periods</td>
          <td>
            <span class="badge badge-danger">
              ${student.percentage}%
            </span>
          </td>
          <td>
            <a href="report.html?student_id=${student.id}" class="btn btn-secondary btn-sm">
              View History
            </a>
          </td>
        </tr>
      `).join('');
    }
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    showToast('Failed to load dashboard data. Check backend server.', 'error');
  }
}

// Utility to escape HTML to prevent XSS
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Toast notification function
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
