// auth.js - Client-side session verification and logout handling

function getAuthHeaders(extra = {}) {
  const headers = { ...extra };
  const token = localStorage.getItem('faculty_token');
  if (token) {
    headers['Authorization'] = 'Bearer ' + token;
  }
  return headers;
}
window.getAuthHeaders = getAuthHeaders;

document.addEventListener('DOMContentLoaded', async () => {
  // Check current authentication status
  try {
    const res = await fetch('/api/auth/me', {
      headers: getAuthHeaders()
    });

    if (!res.ok) {
      // If on login page, do nothing; else redirect to login.html
      if (!window.location.pathname.endsWith('login.html')) {
        window.location.href = 'login.html';
      }
      return;
    }

    const data = await res.json();
    if (data.authenticated && data.faculty) {
      renderFacultyNav(data.faculty);
      // If already logged in and on login.html, redirect to dashboard
      if (window.location.pathname.endsWith('login.html')) {
        window.location.href = 'index.html';
      }
    } else {
      if (!window.location.pathname.endsWith('login.html')) {
        window.location.href = 'login.html';
      }
    }
  } catch (err) {
    console.error('Session check failed:', err);
  }
});

function renderFacultyNav(faculty) {
  const navContainer = document.querySelector('.nav-container');
  if (!navContainer) return;

  let authContainer = document.getElementById('nav-auth-section');
  if (!authContainer) {
    authContainer = document.createElement('div');
    authContainer.id = 'nav-auth-section';
    authContainer.style.display = 'flex';
    authContainer.style.alignItems = 'center';
    authContainer.style.gap = '10px';
    navContainer.appendChild(authContainer);
  }

  authContainer.innerHTML = `
    <span class="badge badge-info" id="faculty-name-badge" data-testid="faculty-name" style="font-size: 0.85rem;">
      👤 ${escapeHtml(faculty.name || faculty.username)}
    </span>
    <button type="button" class="btn btn-secondary btn-sm" id="btn-logout" data-testid="logout-button" onclick="handleLogout()">
      Logout
    </button>
  `;
}

async function handleLogout() {
  try {
    const token = localStorage.getItem('faculty_token');
    localStorage.removeItem('faculty_token');
    await fetch('/api/auth/logout', { 
      method: 'POST',
      headers: token ? { 'Authorization': 'Bearer ' + token } : {}
    });
  } catch (err) {
    console.error('Logout error:', err);
  } finally {
    window.location.href = 'login.html';
  }
}
window.handleLogout = handleLogout;

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/&lt;/g, '&lt;')
    .replace(/&gt;/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
