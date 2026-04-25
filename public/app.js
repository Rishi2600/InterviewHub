// Token helpers 
// The JWT is stored in localStorage under this key
// Every page reads it on load and redirects to index.html if missing

const TOKEN_KEY = 'ih_token';
const USER_KEY  = 'ih_user';

function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function getUser() {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// Redirect to login if no token found — call this at the top of protected pages
function requireAuth() {
  if (!getToken()) {
    window.location.href = '/index.html';
    return false;
  }
  return true;
}

// Fetch wrapper 
// Wraps fetch with:
//   - base URL set to /api/v1
//   - Authorization header injected automatically
//   - JSON body serialization
//   - Throws on non-2xx responses with the server's error message

const BASE = '/api/v1';

async function api(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, options);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data.message || `Error ${res.status}`;
    throw new Error(Array.isArray(msg) ? msg.join(', ') : msg);
  }

  return data;
}

// Socket.io client factory 
// Creates a socket connection with the JWT in the handshake auth
// so WsJwtGuard can verify it on the server

function createSocket() {
  const token = getToken();
  // io() is available because socket.io's client CDN is loaded in each HTML page
  return io({
    auth: { token: `Bearer ${token}` },
  });
}

// UI helpers 

function showError(elId, msg) {
  const el = document.getElementById(elId);
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function hideError(elId) {
  const el = document.getElementById(elId);
  if (el) el.style.display = 'none';
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}