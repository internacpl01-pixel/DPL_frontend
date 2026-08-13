// ===== API Client =====

// Use config.js API_BASE_URL if defined, fallback to same-origin with local dev port.
const API_BASE = (typeof API_BASE_URL !== 'undefined' && API_BASE_URL) || window.location.origin;
const API_TIMEOUT = 60000; // 60 seconds
const PDF_UPLOAD_TIMEOUT = 180000; // 180 seconds — PDF parsing can be slow

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

  // Use AbortController for timeout instead of Promise.race
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  config.signal = controller.signal;

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, config);

    // Read the body once, before any branching
    const contentType = response.headers.get('content-type');
    let data;
    if (response.status === 204) {
      data = null;
    } else if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      if (response.status === 401) {
        clearTimeout(timer);
        handleUnauthorized();
      }
      let msg = `HTTP ${response.status}`;
      if (typeof data === 'string') {
        msg = data;
      } else if (data) {
        msg = data.detail || data.message || data.error || `HTTP ${response.status}`;
      }
      const err = new Error(msg);
      err.status = response.status;
      clearTimeout(timer);
      throw err;
    }

    clearTimeout(timer);
    return data;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }
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
  deleteCustomField: (fieldname) =>
    apiRequest(`/api/custom-fields/${encodeURIComponent(fieldname)}`, { method: 'DELETE' }),

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

  // Excel Upload
  uploadExcel: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('save', 'true');
    return apiRequest('/api/import/excel', { method: 'POST', body: formData, timeout: PDF_UPLOAD_TIMEOUT });
  },

  // Master Data
  getData: (page, limit, search = "") =>
    apiRequest(`/api/data?page=${page || 1}&limit=${limit || 50}&search=${encodeURIComponent(search)}`),
  addData: (rows) =>
    apiRequest('/api/data', { method: 'POST', body: JSON.stringify({ rows }) }),
  deleteData: (id) =>
    apiRequest(`/api/data/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  truncateData: () =>
    apiRequest('/api/data', { method: 'DELETE' }),

  exportData: (format, search = "") => {
    const token = localStorage.getItem('access_token');
    const url = `${API_BASE}/api/export?format=${encodeURIComponent(format)}&search=${encodeURIComponent(search)}`;
    return fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` },
    }).then(async (response) => {
      if (!response.ok) {
        const text = await response.text().catch(() => `HTTP ${response.status}`);
        throw new Error(text || `HTTP ${response.status}`);
      }
      const disposition = response.headers.get('Content-Disposition');
      let filename = `master_data.${format}`;
      if (disposition) {
        const match = disposition.match(/filename="(.+)"/);
        if (match) filename = match[1];
      }
      const blob = await response.blob();
      return { blob, filename };
    });
  },

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
