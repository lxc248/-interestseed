let sessionToken = '';

async function ensureSessionToken() {
  if (sessionToken) return sessionToken;
  const response = await fetch('/api/session', { cache: 'no-store' });
  if (!response.ok) throw new Error('无法建立本地会话。');
  const body = await response.json();
  if (typeof body.token !== 'string' || !body.token) throw new Error('本地会话无效。');
  sessionToken = body.token;
  return sessionToken;
}

export async function api(path, options = {}) {
  const token = await ensureSessionToken();
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json', 'X-InterestSeed-Token': token },
    ...options,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || body.message || `HTTP ${response.status}`);
  return body;
}
