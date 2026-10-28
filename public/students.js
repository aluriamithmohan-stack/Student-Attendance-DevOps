// students.js - Student Management logic

let allStudents = [];

document.addEventListener('DOMContentLoaded', () => {
  loadStudents();

  // Form submit for adding student
  const addForm = document.getElementById('form-add-student');
  if (addForm) {
    addForm.addEventListener('submit', handleAddStudent);
  }

  // Edit modal actions
  const editForm = document.getElementById('form-edit-student');
  if (editForm) {
    editForm.addEventListener('submit', handleSaveEditStudent);
  }

  const closeEditBtn = document.getElementById('btn-close-edit-modal');
  const cancelEditBtn = document.getElementById('btn-cancel-edit');
  if (closeEditBtn) closeEditBtn.addEventListener('click', closeEditModal);
  if (cancelEditBtn) cancelEditBtn.addEventListener('click', closeEditModal);

  // Search & Filter listeners
  const searchInput = document.getElementById('input-search-student');
  const filterDept = document.getElementById('filter-department');
  const resetBtn = document.getElementById('btn-reset-filters');

  if (searchInput) searchInput.addEventListener('input', applyFilters);
  if (filterDept) filterDept.addEventListener('change', applyFilters);
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      searchInput.value = '';
      filterDept.value = '';
      applyFilters();
    });
  }
});

// Load all students from backend
async function loadStudents() {
  try {
    const res = await fetch('/api/students');
    if (!res.ok) throw new Error('Failed to load students');
    allStudents = await res.json();
    updateStudentCountBadge(allStudents.length);
    renderStudentsTable(allStudents);
  } catch (error) {
    console.error('Error fetching students:', error);
    showToast('Could not load students: ' + error.message, 'error');
  }
}

// Render student table rows
function renderStudentsTable(students) {
  const tbody = document.getElementById('tbody-students');
  if (!tbody) return;

  if (students.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">
          No students found. Add a new student above or reset filters.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = students.map((student, index) => `
    <tr class="student-row" data-id="${student.id}" id="student-row-${student.id}">
      <td>${index + 1}</td>
      <td><strong>${escapeHtml(student.roll_no)}</strong></td>
      <td>${escapeHtml(student.name)}</td>
      <td>
        <span class="badge badge-info">${escapeHtml(student.department)}</span>
      </td>
      <td style="text-align: center;">
        <button 
          class="btn btn-secondary btn-sm btn-edit-student" 
          onclick="openEditModal(${student.id})"
          data-id="${student.id}"
          title="Edit Student">
          ✏️ Edit
        </button>
        <button 
          class="btn btn-danger btn-sm btn-delete-student" 
          onclick="handleDeleteStudent(${student.id}, '${escapeHtml(student.name)}', '${escapeHtml(student.roll_no)}')"
          data-id="${student.id}"
          title="Delete Student">
          🗑️ Delete
        </button>
      </td>
    </tr>
  `).join('');
}

// Add new student
async function handleAddStudent(e) {
  e.preventDefault();

  const rollInput = document.getElementById('input-roll-no');
  const nameInput = document.getElementById('input-student-name');
  const deptSelect = document.getElementById('select-department');
  const alertBox = document.getElementById('student-form-alert');

  const roll_no = rollInput.value.trim();
  const name = nameInput.value.trim();
  const department = deptSelect.value.trim();

  alertBox.style.display = 'none';
  alertBox.textContent = '';

  // Client Validation
  if (!roll_no || !name || !department) {
    alertBox.textContent = 'Please fill out all required fields (Roll Number, Name, Department).';
    alertBox.style.display = 'block';
    return;
  }

  try {
    const res = await fetch('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roll_no, name, department })
    });

    const data = await res.json();

    if (!res.ok) {
      alertBox.textContent = data.error || 'Failed to add student.';
      alertBox.style.display = 'block';
      return;
    }

    // Success
    showToast(`Student ${data.name} (${data.roll_no}) added successfully!`, 'success');
    rollInput.value = '';
    nameInput.value = '';
    deptSelect.value = '';

    await loadStudents();
  } catch (error) {
    alertBox.textContent = 'Network or server error: ' + error.message;
    alertBox.style.display = 'block';
  }
}

// Open Edit Modal
function openEditModal(studentId) {
  const student = allStudents.find(s => s.id === studentId);
  if (!student) return;

  const modal = document.getElementById('modal-edit-student');
  const alertBox = document.getElementById('modal-form-alert');
  alertBox.style.display = 'none';

  document.getElementById('edit-student-id').value = student.id;
  document.getElementById('edit-roll-no').value = student.roll_no;
  document.getElementById('edit-name').value = student.name;
  document.getElementById('edit-department').value = student.department;

  modal.classList.add('active');
}

function closeEditModal() {
  const modal = document.getElementById('modal-edit-student');
  modal.classList.remove('active');
}

// Save edited student
async function handleSaveEditStudent(e) {
  e.preventDefault();

  const id = document.getElementById('edit-student-id').value;
  const roll_no = document.getElementById('edit-roll-no').value.trim();
  const name = document.getElementById('edit-name').value.trim();
  const department = document.getElementById('edit-department').value.trim();
  const alertBox = document.getElementById('modal-form-alert');

  alertBox.style.display = 'none';

  if (!roll_no || !name || !department) {
    alertBox.textContent = 'All fields are required.';
    alertBox.style.display = 'block';
    return;
  }

  try {
    const res = await fetch(`/api/students/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roll_no, name, department })
    });

    const data = await res.json();

    if (!res.ok) {
      alertBox.textContent = data.error || 'Failed to update student.';
      alertBox.style.display = 'block';
      return;
    }

    showToast(`Student ${data.name} updated successfully!`, 'success');
    closeEditModal();
    await loadStudents();
  } catch (error) {
    alertBox.textContent = 'Network or server error: ' + error.message;
    alertBox.style.display = 'block';
  }
}

// Delete student
async function handleDeleteStudent(id, name, roll_no) {
  const confirmed = confirm(`Are you sure you want to delete student "${name}" (Roll No: ${roll_no})?\nAll attendance records for this student will also be permanently deleted.`);
  if (!confirmed) return;

  try {
    const res = await fetch(`/api/students/${id}`, {
      method: 'DELETE'
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to delete student');
    }

    showToast(data.message || 'Student deleted successfully.', 'success');
    await loadStudents();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// Filter students by search term and department
function applyFilters() {
  const search = (document.getElementById('input-search-student').value || '').toLowerCase().trim();
  const dept = (document.getElementById('filter-department').value || '').trim();

  const filtered = allStudents.filter(s => {
    const matchesSearch = !search || s.roll_no.toLowerCase().includes(search) || s.name.toLowerCase().includes(search);
    const matchesDept = !dept || s.department === dept;
    return matchesSearch && matchesDept;
  });

  renderStudentsTable(filtered);
}

function updateStudentCountBadge(count) {
  const badge = document.getElementById('badge-student-count');
  if (badge) {
    badge.textContent = `${count} Registered Student${count === 1 ? '' : 's'}`;
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
