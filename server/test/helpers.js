// server/test/helpers.js
// Boots a real server instance against a throwaway database so tests exercise
// the full middleware + controller stack over HTTP.

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const SERVER_ENTRY = path.join(__dirname, '..', 'index.js');

let portCounter = 0;

/**
 * Start a server backed by a fresh temporary database.
 * @returns {Promise<{baseUrl: string, stop: () => Promise<void>}>}
 */
async function startServer() {
  const port = 5100 + (portCounter++) + Math.floor(process.pid % 100) * 10;
  const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'traveler-test-'));
  const dbPath = path.join(dbDir, 'test.db');

  const child = spawn(process.execPath, [SERVER_ENTRY], {
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      DB_PATH: dbPath,
      JWT_SECRET: 'test-secret-not-for-production-0123456789abcdef',
      // No SMTP config: outbound mail is skipped/failed harmlessly in tests
      EMAIL_HOST: '',
      EMAIL_USER: '',
      EMAIL_PASSWORD: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const logs = [];
  child.stdout.on('data', (d) => logs.push(d.toString()));
  child.stderr.on('data', (d) => logs.push(d.toString()));

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Server did not start in time. Logs:\n${logs.join('')}`));
    }, 20000);

    const onData = (d) => {
      if (d.toString().includes('Server running on port')) {
        clearTimeout(timer);
        child.stdout.off('data', onData);
        resolve();
      }
    };
    child.stdout.on('data', onData);
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Server exited early (code ${code}). Logs:\n${logs.join('')}`));
    });
  });

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    logs,
    async stop() {
      child.kill('SIGKILL');
      await new Promise((resolve) => child.on('exit', resolve));
      fs.rmSync(dbDir, { recursive: true, force: true });
    },
  };
}

/**
 * Minimal API client bound to a base URL, with optional bearer token.
 */
function client(baseUrl, token = null) {
  const request = async (method, urlPath, body, opts = {}) => {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    let payload;
    if (body instanceof FormData) {
      payload = body;
    } else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }

    const res = await fetch(`${baseUrl}/api${urlPath}`, {
      method,
      headers: { ...headers, ...(opts.headers || {}) },
      body: payload,
      redirect: 'manual',
    });

    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text; // non-JSON (file downloads, html)
    }
    return { status: res.status, data, headers: res.headers };
  };

  return {
    get: (p, o) => request('GET', p, undefined, o),
    post: (p, b, o) => request('POST', p, b, o),
    put: (p, b, o) => request('PUT', p, b, o),
    patch: (p, b, o) => request('PATCH', p, b, o),
    delete: (p, b, o) => request('DELETE', p, b, o),
    withToken: (t) => client(baseUrl, t),
  };
}

/** Register a user and return { token, user, api } */
async function registerUser(baseUrl, { name, email, password = 'secret123' }) {
  const api = client(baseUrl);
  const res = await api.post('/auth/register', { name, email, password });
  if (res.status !== 201 && res.status !== 200) {
    throw new Error(`register failed (${res.status}): ${JSON.stringify(res.data)}`);
  }
  return { token: res.data.token, user: res.data.user, api: api.withToken(res.data.token) };
}

/** Create a trip owned by the given client. Returns the trip id. */
async function createTrip(api, { name = 'Test Trip', start = '2026-08-01', end = '2026-08-10' } = {}) {
  const form = new FormData();
  form.append('name', name);
  form.append('start_date', start);
  form.append('end_date', end);
  const res = await api.post('/trips', form);
  if (res.status !== 201) throw new Error(`createTrip failed: ${JSON.stringify(res.data)}`);
  return res.data.trip.id;
}

module.exports = { startServer, client, registerUser, createTrip };
