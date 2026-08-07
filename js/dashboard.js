import { requireAuth, getCurrentUser, getUserLevel, canAccess, requireLevel } from './auth.js';

const PAGES = {
  dashboard: { label: 'Dashboard', icon: '&#x1F4CA;', minLevel: 0, file: 'dashboard.js' },
  'field-mappings': { label: 'Field Mappings', icon: '&#x1F4DD;', minLevel: 0, file: 'mapping.js' },
  'table-structure': { label: 'Table Structure', icon: '&#x1F4C2;', minLevel: 0, file: 'table.js' },
  'change-log': { label: 'Change Log', icon: '&#x1F4D6;', minLevel: 1, file: 'logs.js' },
  'custom-fields': { label: 'Custom Fields', icon: '&#x2795;', minLevel: 1, file: 'customfields.js' },
  users: { label: 'Users', icon: '&#x1F465;', minLevel: 1, file: 'users.js' },
};

function getMenuItems() {
  const items = [];
  for (const [key, page] of Object.entries(PAGES)) {
    if (canAccess(page.minLevel)) {
      items.push({ key, ...page });
    }
  }
  return items;
}

function renderSidebar(activePage) {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  const user = getCurrentUser();
  const levelNames = ['Staff', 'Manager', 'Admin'];
  const userLevel = user ? (user.access_level ?? user.level ?? 0) : 0;

  sidebar.innerHTML = `
    <div class="sidebar-brand">
      <div class="sidebar-logo">DPL</div>
      <span class="sidebar-title">DPL Project</span>
    </div>
    <div class="sidebar-user">
      <div class="sidebar-avatar">${user ? user.username.charAt(0).toUpperCase() : '?'}</div>
      <div class="sidebar-user-info">
        <span class="sidebar-user-name">${user ? user.username : 'User'}</span>
        <span class="sidebar-user-role">${levelNames[userLevel] || 'Unknown'}</span>
      </div>
    </div>
    <nav class="sidebar-nav">
      ${getMenuItems().map(item => `
        <a href="#${item.key}" class="sidebar-link ${activePage === item.key ? 'active' : ''}" data-page="${item.key}">
          <span class="sidebar-link-icon">${item.icon}</span>
          <span class="sidebar-link-text">${item.label}</span>
        </a>
      `).join('')}
    </nav>
    <div class="sidebar-footer">
      <button id="logout-btn" class="sidebar-logout">
        <span>&#x2192;</span> Logout
      </button>
    </div>
  `;

  document.getElementById('logout-btn')?.addEventListener('click', () => {
    import('./auth.js').then(m => m.logout());
  });

  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.dataset.page;
      window.location.hash = page;
    });
  });
}

function showPage(title) {
  const mainContent = document.getElementById('main-content');
  const pageTitle = document.getElementById('page-title');
  if (pageTitle) pageTitle.textContent = title;
  if (mainContent) {
    mainContent.innerHTML = `
      <div class="loading-container">
        <div class="spinner"></div>
        <p>Loading ${title}...</p>
      </div>`;
  }
}

async function loadPage(pageName) {
  if (!requireAuth()) return;

  const page = PAGES[pageName];
  if (!page) {
    document.getElementById('main-content').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">&#x1F4ED;</div>
        <h2>Page Not Found</h2>
        <p>The page you're looking for doesn't exist.</p>
      </div>`;
    return;
  }

  if (!requireLevel(page.minLevel)) return;

  showPage(page.label);
  renderSidebar(pageName);

  try {
    const module = await import(`./${page.file}`);
    if (module.init) await module.init();
  } catch (err) {
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      mainContent.innerHTML = `
        <div class="error-state">
          <h2>Error Loading Page</h2>
          <p>${err.message}</p>
          <button class="btn btn-primary" onclick="location.reload()">Retry</button>
        </div>`;
    }
    showToast(`Failed to load ${page.label}: ${err.message}`, 'error');
  }
}

export function initRouter() {
  function handleRoute() {
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    const pageName = hash.split('/')[0];
    loadPage(pageName);
  }

  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

export function navigate(page) {
  window.location.hash = page;
}
