// Shared frontend helpers. Served as a static file (real browser, so
// localStorage is available here — unlike a sandboxed artifact).

function saveSession(token, user) {
  localStorage.setItem('ih_token', token);
  localStorage.setItem('ih_user', JSON.stringify(user));
}

function getSession() {
  const token = localStorage.getItem('ih_token');
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem('ih_user') || 'null');
  } catch (_) {
    user = null;
  }
  return { token, user };
}

function clearSession() {
  localStorage.removeItem('ih_token');
  localStorage.removeItem('ih_user');
}

// Calls the REST API and unwraps the { success, data } envelope.
async function api(path, method = 'GET', body) {
  const { token } = getSession();
  const res = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const m = json && json.message
      ? Array.isArray(json.message) ? json.message.join(', ') : json.message
      : 'Request failed (' + res.status + ')';
    throw new Error(m);
  }
  return json.data !== undefined ? json.data : json;
}
