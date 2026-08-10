// ===== API Client =====

// Use config.js API_BASE_URL if defined, fallback to same-origin with local dev port.
const API_BASE = (typeof API_BASE_URL !== 'undefined' && API_BASE_URL) || window.location.origin;
const API_TIMEOUT = 60000; // 60 seconds
const PDF_UPLOAD_TIMEOUT = 180000; // 180 seconds — PDF parsing can be slow

function withTimeout(ms, signal) {
  return new Promise((_, reject) => {
    const id = setTimeout(() => reject(new Error('Request timed out. Please try again.')), ms);
    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(id);
        reject(new Error('Request was cancelled.'));
      }, { once: true });
    }
  });
}

async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('access_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  // Don't set Content-Type for FormData — browser sets multipart boundary
  const body = options.body;
  if (body instanceof FormData) {
    delete headers['Content-Type'];
  }

  const timeout = options.timeout || API_TIMEOUT;
  const config = { ...options, headers, body };

  try {
    const response = await Promise.race([
      fetch(`${API_BASE}${endpoint}`, config),
      withTimeout(timeout),
    ]);

    const contentType = response.headers.get('content-type');

    if (response.status === 204) return null;

    const data = contentType && contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      if (response.status === 401) handleUnauthorized();
      let msg = `HTTP ${response.status}`;
      try {
        const parsed = contentType && contentType.includes('application/json')
          ? await response.json()
          : await response.text();
        if (typeof parsed === 'string') msg = parsed;
        else msg = parsed.detail || parsed.message || parsed.error || `HTTP ${response.status}`;
      } catch (e) {
        // Non-JSON error body — keep generic message
      }
      const err = new Error(msg);
      err.status = response.status;
      throw err;
    }

    return data;
  } catch (err) {
    if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
      throw new Error('Cannot connect to server. Please check your internet connection.');
    }
    if (err.status === 500) {
      throw new Error(`Server error (500). The server may be starting up — try again in a moment.`);
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
    apiRequest('/api/register', { method: 'POST', body: JSON.stringify({ username, password, level: parseInt(accessLevel) }) }),

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
  uploadPdf: (file, password) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('save', 'true');
    if (password) {
      formData.append('password', password);
    }
    return apiRequest('/api/import/pdf', { method: 'POST', body: formData, timeout: PDF_UPLOAD_TIMEOUT });
  },

  // Master Data
  getData: (page, limit) => apiRequest(`/api/data?page=${page || 1}&limit=${limit || 50}`),
  addData: (rows) =>
    apiRequest('/api/data', { method: 'POST', body: JSON.stringify({ rows }) }),
  deleteData: (id) =>
    apiRequest(`/api/data/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  truncateData: () =>
    apiRequest('/api/data', { method: 'DELETE' }),

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
