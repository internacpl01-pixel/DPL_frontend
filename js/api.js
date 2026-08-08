// ===== API Client =====

const API_BASE = 'https://dpl-project.onrender.com';
const API_TIMEOUT = 60000; // 60 seconds — Render free tier cold start

function withTimeout(ms) {
    return new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out. Please try again.')), ms)
    );
}

async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('access_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const config = { ...options, headers };

  try {
    const response = await Promise.race([
      fetch(`${API_BASE}${endpoint}`, config),
      withTimeout(API_TIMEOUT),
    ]);

    const contentType = response.headers.get('content-type');

    if (response.status === 204) return null;

    const data = contentType && contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      if (response.status === 401) handleUnauthorized();
      const msg = typeof data === 'string' ? data : (data.detail || data.message || `HTTP ${response.status}`);
      const err = new Error(msg);
      err.status = response.status;
      throw err;
    }

    return data;
  } catch (err) {
    if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
      throw new Error('Cannot connect to server. Please check your internet connection.');
    }
    throw err;
  }
}

function handleUnauthorized() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('user');
  App.toast('Session expired. Please login again.', 'error');
  setTimeout(() => { location.reload(); }, 1500);
}

const Api = {
  get: (path) => apiRequest(path),
  post: (path, body) => apiRequest(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => apiRequest(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: (path, body) => apiRequest(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path, body) => apiRequest(path, { method: 'DELETE', body: JSON.stringify(body) }),

  login: async (username, password) => {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    const response = await fetch(`${API_BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({ detail: 'Login failed' }));
      throw new Error(data.detail || data.message || 'Login failed');
    }
    return await response.json();
  },

  register: (username, password, accessLevel) =>
    apiRequest('/api/register', { method: 'POST', body: JSON.stringify({ username, password, access_level: parseInt(accessLevel) }) }),

  logout: () => apiRequest('/api/logout', { method: 'POST' }).catch(() => {}),

  getMe: () => apiRequest('/api/me'),

  getFieldMappings: () => apiRequest('/api/field-mappings'),
  updateFieldMapping: (fieldname, displayname, mapfields) =>
    apiRequest(`/api/field-mappings/${encodeURIComponent(fieldname)}`, {
      method: 'PUT', body: JSON.stringify({ displayname, mapfields }),
    }),
  deleteMapfield: (fieldname, value) =>
    apiRequest(`/api/field-mappings/${encodeURIComponent(fieldname)}/mapfield`, {
      method: 'DELETE', body: JSON.stringify({ value }),
    }),

  getTableStructure: (column) =>
    apiRequest(column ? `/api/table-structure?column=${encodeURIComponent(column)}` : '/api/table-structure'),

  getChangeLog: () => apiRequest('/api/change-log'),

  createCustomField: (field_type) =>
    apiRequest('/api/custom-fields', { method: 'POST', body: JSON.stringify({ type: field_type }) }),

  // PDF Upload
  uploadPdf: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const token = localStorage.getItem('access_token');
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetch(`${API_BASE}/api/import/pdf`, {
      method: 'POST',
      headers,
      body: formData,
    }).then(res => {
      if (!res.ok) return res.json().then(err => { const e = new Error(err.error || 'Upload failed'); e.status = res.status; throw e; });
      return res.json();
    });
  },

  // Master Data
  getData: (page, limit) => apiRequest(`/api/data?page=${page || 1}&limit=${limit || 50}`),
  addData: (rows) =>
    apiRequest('/api/data', { method: 'POST', body: JSON.stringify({ rows }) }),
  deleteData: (id) =>
    apiRequest(`/api/data/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  getUsers: () => apiRequest('/api/users'),
  createUser: (username, password, level) =>
    apiRequest('/api/users', { method: 'POST', body: JSON.stringify({ username, password, level }) }),
  updateUserLevel: (userId, level) =>
    apiRequest(`/api/users/${encodeURIComponent(userId)}/level`, { method: 'PUT', body: JSON.stringify({ level }) }),
  patchUser: (userId, body) =>
    apiRequest(`/api/users/${encodeURIComponent(userId)}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteUser: (userId) =>
    apiRequest(`/api/users/${encodeURIComponent(userId)}`, { method: 'DELETE' }),
};

window.Api = Api;
