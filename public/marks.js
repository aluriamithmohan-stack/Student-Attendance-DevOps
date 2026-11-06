// marks.js - Internal Marks Management logic

let allStudents = [];
let allMarks = [];

document.addEventListener('DOMContentLoaded', async () => {
  await loadStudents();
  await loadMarks();

  const form = document.getElementById('form-marks');
  if (form) {
    form.addEventListener('submit', handleSaveMarks);
  }

  const cancelBtn = document.getElementById('btn-cancel-edit-marks');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', cancelEdit);
  }

  const searchInput = document.getElementById('filter-marks-search');
  const studentFilter = document.getElementById('filter-student-dropdown');
  const resetBtn = document.getElementById('btn-reset-marks-filter');

  if (searchInput) searchInput.addEventListener('input', applyMarksFilter);
  if (studentFilter) studentFilter.addEventListener('change', applyMarksFilter);
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      searchInput.value = '';
      studentFilter.value = '';
      applyMarksFilter();
    });
  }
});

// Load active students for dropdowns
async function loadStudents() {
  try {
    const res = await fetch('/api/students', {
      headers: typeof getAuthHeaders === 'function' ? getAuthHeaders() : {}
    });
    if (!res.ok) throw new Error('Failed to load students');
    allStudents = await res.json();

    const selectStudent = document.getElementById('select-student');
    const filterStudent = document.getElementById('filter-student-dropdown');

    const options = allStudents.map(s => 
      `<option value="${s.id}">${escapeHtml(s.roll_no)} - ${escapeHtml(s.name)} (${escapeHtml(s.department)})</option>`
    ).join('');

    if (selectStudent) {
      selectStudent.innerHTML = `<option value="">-- Choose Student --</option>` + options;
    }
    if (filterStudent) {
      filterStudent.innerHTML = `<option value="">All Students</option>` + options;
    }
  } catch (err) {
    console.error('Error loading students:', err);
    showToast('Failed to load students list: ' + err.message, 'error');
  }
}

// Load internal marks
async function loadMarks() {
  try {
    const res = await fetch('/api/marks', {
      headers: typeof getAuthHeaders === 'function' ? getAuthHeaders() : {}
    });
    if (!res.ok) throw new Error('Failed to load marks');
    allMarks = await res.json();

    const badge = document.getElementById('badge-marks-count');
    if (badge) {
      badge.textContent = `${allMarks.length} Assessment${allMarks.length === 1 ? '' : 's'} Recorded`;
    }

    renderMarksTable(allMarks);
  } catch (err) {
    console.error('Error loading marks:', err);
    showToast('Failed to load marks: ' + err.message, 'error');
  }
}

// Render marks rows
function renderMarksTable(marksList) {
  const tbody = document.getElementById('tbody-marks');
  if (!tbody) return;

  if (marksList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-muted);">
          No internal marks recorded. Fill out the form above to record assessment scores.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = marksList.map(m => {
    const pct = parseFloat(m.marks_percentage) || 0;
    const isHigh = pct >= 75;
    const pctColor = isHigh ? 'var(--success)' : 'var(--danger)';

    return `
      <tr class="marks-row" id="marks-row-${m.id}">
        <td><strong>${escapeHtml(m.roll_no)}</strong></td>
        <td>${escapeHtml(m.student_name)}</td>
        <td><span class="badge badge-info">${escapeHtml(m.subject)}</span></td>
        <td>${escapeHtml(m.assessment_name)}</td>
        <td style="text-align: right; font-weight: 600;">${m.marks_obtained}</td>
        <td style="text-align: right; color: var(--text-muted);">${m.max_marks}</td>
        <td style="text-align: right; font-weight: 700; color: ${pctColor};">
          ${pct.toFixed(2)}%
        </td>
        <td style="text-align: center;">
          <button 
            type="button" 
            class="btn btn-secondary btn-sm" 
            onclick="startEditMark(${m.id})"
            title="Edit Assessment Score">
            ✏️ Edit
          </button>
          <button 
            type="button" 
            class="btn btn-danger btn-sm" 
            onclick="handleDeleteMark(${m.id}, '${escapeHtml(m.student_name)}', '${escapeHtml(m.subject)}')"
            title="Delete Score">
            🗑️ Delete
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Save marks (Create or Update)
async function handleSaveMarks(e) {
  e.preventDefault();

  const alertBox = document.getElementById('marks-form-alert');
  alertBox.style.display = 'none';
  alertBox.textContent = '';

  const editId = document.getElementById('edit-mark-id').value;
  const student_id = document.getElementById('select-student').value;
  const subject = document.getElementById('input-subject').value.trim();
  const assessment_name = document.getElementById('input-assessment').value.trim();
  const marks_obtained_raw = document.getElementById('input-marks-obtained').value;
  const max_marks_raw = document.getElementById('input-max-marks').value;

  // Validation
  if (!editId && !student_id) {
    alertBox.textContent = 'Please select a student.';
    alertBox.style.display = 'block';
    return;
  }
  if (!subject) {
    alertBox.textContent = 'Subject name cannot be empty.';
    alertBox.style.display = 'block';
    return;
  }
  if (!assessment_name) {
    alertBox.textContent = 'Assessment name cannot be empty.';
    alertBox.style.display = 'block';
    return;
  }

  const marks_obtained = parseFloat(marks_obtained_raw);
  const max_marks = parseFloat(max_marks_raw);

  if (isNaN(marks_obtained) || marks_obtained < 0) {
    alertBox.textContent = 'Marks obtained must be a valid non-negative number.';
    alertBox.style.display = 'block';
    return;
  }
  if (isNaN(max_marks) || max_marks <= 0) {
    alertBox.textContent = 'Maximum marks must be greater than zero.';
    alertBox.style.display = 'block';
    return;
  }
  if (marks_obtained > max_marks) {
    alertBox.textContent = `Marks obtained (${marks_obtained}) cannot exceed maximum marks (${max_marks}).`;
    alertBox.style.display = 'block';
    return;
  }

  const payload = {
    subject,
    assessment_name,
    marks_obtained,
    max_marks
  };
  if (!editId) {
    payload.student_id = parseInt(student_id, 10);
  }

  const url = editId ? `/api/marks/${editId}` : '/api/marks';
  const method = editId ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: typeof getAuthHeaders === 'function' 
        ? getAuthHeaders({ 'Content-Type': 'application/json' }) 
        : { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      alertBox.textContent = data.error || 'Failed to save marks.';
      alertBox.style.display = 'block';
      return;
    }

    showToast(data.message || 'Marks saved successfully!', 'success');
    cancelEdit();
    await loadMarks();
  } catch (err) {
    alertBox.textContent = 'Server error: ' + err.message;
    alertBox.style.display = 'block';
  }
}

// Start Edit mode
function startEditMark(markId) {
  const mark = allMarks.find(m => m.id === markId);
  if (!mark) return;

  document.getElementById('edit-mark-id').value = mark.id;
  document.getElementById('select-student').value = mark.student_id;
  document.getElementById('select-student').disabled = true;
  document.getElementById('input-subject').value = mark.subject;
  document.getElementById('input-assessment').value = mark.assessment_name;
  document.getElementById('input-marks-obtained').value = mark.marks_obtained;
  document.getElementById('input-max-marks').value = mark.max_marks;

  document.getElementById('form-card-title').textContent = 'Update Internal Marks';
  document.getElementById('btn-save-marks').textContent = '💾 Update Marks';
  document.getElementById('btn-cancel-edit-marks').style.display = 'inline-block';

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Cancel Edit
function cancelEdit() {
  document.getElementById('edit-mark-id').value = '';
  document.getElementById('select-student').disabled = false;
  document.getElementById('form-marks').reset();
  document.getElementById('form-card-title').textContent = 'Enter Internal Marks';
  document.getElementById('btn-save-marks').textContent = '💾 Save Marks';
  document.getElementById('btn-cancel-edit-marks').style.display = 'none';
  document.getElementById('marks-form-alert').style.display = 'none';
}

// Delete Mark
async function handleDeleteMark(markId, studentName, subject) {
  if (!confirm(`Are you sure you want to delete marks for ${studentName} (${subject})?`)) return;

  try {
    const res = await fetch(`/api/marks/${markId}`, { 
      method: 'DELETE',
      headers: typeof getAuthHeaders === 'function' ? getAuthHeaders() : {}
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete marks');

    showToast('Marks record deleted successfully.', 'success');
    await loadMarks();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Filter and Search Marks
function applyMarksFilter() {
  const search = (document.getElementById('filter-marks-search').value || '').toLowerCase().trim();
  const studentId = document.getElementById('filter-student-dropdown').value;

  const filtered = allMarks.filter(m => {
    const matchesSearch = !search ||
      m.roll_no.toLowerCase().includes(search) ||
      m.student_name.toLowerCase().includes(search) ||
      m.subject.toLowerCase().includes(search) ||
      m.assessment_name.toLowerCase().includes(search);
    const matchesStudent = !studentId || String(m.student_id) === String(studentId);

    return matchesSearch && matchesStudent;
  });

  renderMarksTable(filtered);
}

// Toast
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

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
