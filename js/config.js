// Use same-origin by default (works when served by the local backend).
// Override with the production URL only when opened from file://.
window.API_BASE_URL =
  window.location.protocol === 'file:'
    ? 'https://dpl-project.onrender.com'
    : window.location.origin;
