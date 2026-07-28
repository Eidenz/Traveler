// server/test/authSecurity.test.js
// Session lifetime/revocation, upload quota, and public-socket isolation.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const path = require('node:path');
const { startServer, client, registerUser, createTrip } = require('./helpers');

// socket.io-client is a client-side dependency; reuse the client workspace's copy
const { io } = require(path.join(__dirname, '..', '..', 'client', 'node_modules', 'socket.io-client'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// password_changed_at has one-second granularity, so tokens issued in the same
// second as a change survive it. Waiting >1s makes revocation deterministic.
const passRevocationWindow = () => sleep(1100);

let server;
let anon;

before(async () => {
  server = await startServer({ env: { UPLOAD_QUOTA_MB: '1' } });
  anon = client(server.baseUrl);
});

after(async () => {
  await server.stop();
});

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------

test('a session token can be refreshed and the new token works', async () => {
  const { api, token } = await registerUser(server.baseUrl, {
    name: 'Refresh', email: 'refresh@example.com',
  });

  const res = await api.post('/auth/refresh');
  assert.strictEqual(res.status, 200);
  assert.ok(res.data.token, 'refresh should return a token');
  assert.notStrictEqual(res.data.token, undefined);

  const me = await anon.withToken(res.data.token).get('/auth/me');
  assert.strictEqual(me.status, 200);
  assert.strictEqual(me.data.user.email, 'refresh@example.com');
  assert.ok(token, 'original token existed');
});

test('an API key cannot mint a session token via refresh', async () => {
  const { api } = await registerUser(server.baseUrl, {
    name: 'Keyed', email: 'keyed@example.com',
  });
  const created = await api.post('/api-keys', { name: 'test key' });
  assert.strictEqual(created.status, 201);
  const rawKey = created.data.plaintext;
  assert.ok(rawKey.startsWith('trv_'));

  const res = await anon.withToken(rawKey).post('/auth/refresh');
  assert.strictEqual(res.status, 403);
});

// ---------------------------------------------------------------------------
// "Remember me" token lifetime
// ---------------------------------------------------------------------------

const tokenLifetimeDays = (token) => {
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  return (payload.exp - payload.iat) / 86400;
};

test('remember_me at login yields a long-lived token, plain login a short one', async () => {
  await registerUser(server.baseUrl, { name: 'Mem', email: 'mem@example.com', password: 'secret123' });

  const plain = await anon.post('/auth/login', {
    email: 'mem@example.com', password: 'secret123',
  });
  assert.strictEqual(plain.status, 200);
  assert.strictEqual(tokenLifetimeDays(plain.data.token), 3);

  const remembered = await anon.post('/auth/login', {
    email: 'mem@example.com', password: 'secret123', remember_me: true,
  });
  assert.strictEqual(remembered.status, 200);
  assert.strictEqual(tokenLifetimeDays(remembered.data.token), 30);
});

test('refresh preserves the remember-me lifetime instead of downgrading it', async () => {
  const login = await anon.post('/auth/login', {
    email: 'mem@example.com', password: 'secret123', remember_me: true,
  });
  const refreshed = await anon.withToken(login.data.token).post('/auth/refresh');
  assert.strictEqual(refreshed.status, 200);
  assert.strictEqual(tokenLifetimeDays(refreshed.data.token), 30);

  // ...and a short session stays short
  const shortLogin = await anon.post('/auth/login', {
    email: 'mem@example.com', password: 'secret123',
  });
  const shortRefreshed = await anon.withToken(shortLogin.data.token).post('/auth/refresh');
  assert.strictEqual(tokenLifetimeDays(shortRefreshed.data.token), 3);
});

test('changing the password preserves the remember-me lifetime', async () => {
  const login = await anon.post('/auth/login', {
    email: 'mem@example.com', password: 'secret123', remember_me: true,
  });
  const api = anon.withToken(login.data.token);
  const change = await api.put('/users/password', {
    current_password: 'secret123', new_password: 'secret456',
  });
  assert.strictEqual(change.status, 200);
  assert.strictEqual(tokenLifetimeDays(change.data.token), 30);

  // restore the password for any later tests using this account
  const restore = await anon.withToken(change.data.token).put('/users/password', {
    current_password: 'secret456', new_password: 'secret123',
  });
  assert.strictEqual(restore.status, 200);
});

// ---------------------------------------------------------------------------
// Revocation on password change / reset
// ---------------------------------------------------------------------------

test('changing the password revokes previously issued tokens', async () => {
  const { api, token: oldToken } = await registerUser(server.baseUrl, {
    name: 'Changer', email: 'changer@example.com', password: 'original1',
  });

  await passRevocationWindow();

  const change = await api.put('/users/password', {
    current_password: 'original1',
    new_password: 'changed123',
  });
  assert.strictEqual(change.status, 200);
  assert.ok(change.data.token, 'change-password should return a fresh token');

  // The old token is now rejected everywhere
  const withOld = await anon.withToken(oldToken).get('/auth/me');
  assert.strictEqual(withOld.status, 401);

  // The fresh token issued alongside the change still works
  const withNew = await anon.withToken(change.data.token).get('/auth/me');
  assert.strictEqual(withNew.status, 200);

  // And logging in with the new password works
  const login = await anon.post('/auth/login', {
    email: 'changer@example.com', password: 'changed123',
  });
  assert.strictEqual(login.status, 200);
});

test('resetting the password revokes previously issued tokens', async () => {
  const { user, token: oldToken } = await registerUser(server.baseUrl, {
    name: 'Resetter', email: 'resetter@example.com', password: 'original1',
  });

  await passRevocationWindow();

  // Plant a reset token directly in the database (the real flow emails it)
  const sqlite3 = require('better-sqlite3');
  const rawReset = crypto.randomBytes(32).toString('hex');
  const hashed = crypto.createHash('sha256').update(rawReset).digest('hex');
  const db = sqlite3(server.dbPath);
  db.prepare('UPDATE users SET resetPasswordToken = ?, resetPasswordExpires = ? WHERE id = ?')
    .run(hashed, Date.now() + 3600000, user.id);
  db.close();

  const reset = await anon.post(`/auth/reset-password/${rawReset}`, {
    password: 'resetted1', confirm_password: 'resetted1',
  });
  assert.strictEqual(reset.status, 200);
  assert.ok(reset.data.token, 'reset should return a fresh token');

  const withOld = await anon.withToken(oldToken).get('/auth/me');
  assert.strictEqual(withOld.status, 401);

  const withNew = await anon.withToken(reset.data.token).get('/auth/me');
  assert.strictEqual(withNew.status, 200);
});

// ---------------------------------------------------------------------------
// Upload quota, per user per trip (server started with UPLOAD_QUOTA_MB=1)
// ---------------------------------------------------------------------------

test('uploads beyond the per-user-per-trip quota are rejected', async () => {
  const { api } = await registerUser(server.baseUrl, {
    name: 'Uploader', email: 'uploader@example.com',
  });
  const tripId = await createTrip(api);

  const makeDocForm = (forTripId, name, bytes) => {
    const form = new FormData();
    form.append('reference_type', 'trip');
    form.append('reference_id', forTripId);
    form.append('document', new Blob([Buffer.alloc(bytes, 65)], { type: 'text/plain' }), name);
    return form;
  };

  // ~0.7 MB fits inside the 1 MB quota
  const first = await api.post('/documents', makeDocForm(tripId, 'first.txt', 700 * 1024));
  assert.strictEqual(first.status, 201);

  // A second ~0.7 MB upload by the same user to the same trip exceeds it
  const second = await api.post('/documents', makeDocForm(tripId, 'second.txt', 700 * 1024));
  assert.strictEqual(second.status, 413);
  assert.match(second.data.message, /quota/i);

  // A small file still fits under this user's remaining allowance
  const small = await api.post('/documents', makeDocForm(tripId, 'small.txt', 10 * 1024));
  assert.strictEqual(small.status, 201);

  // Per trip: the same user gets a fresh allowance on a different trip
  const otherTripId = await createTrip(api, { name: 'Second Trip' });
  const other = await api.post('/documents', makeDocForm(otherTripId, 'other.txt', 700 * 1024));
  assert.strictEqual(other.status, 201);

  // Per user: another member of the full trip still has their own allowance
  const editor = await registerUser(server.baseUrl, {
    name: 'Editor', email: 'quotaeditor@example.com',
  });
  await api.post(`/trips/${tripId}/share`, { email: 'quotaeditor@example.com', role: 'editor' });
  const byEditor = await editor.api.post('/documents', makeDocForm(tripId, 'editor.txt', 700 * 1024));
  assert.strictEqual(byEditor.status, 201);
});

// ---------------------------------------------------------------------------
// Public share socket isolation
// ---------------------------------------------------------------------------

const connectSocket = (auth) =>
  new Promise((resolve, reject) => {
    const socket = io(server.baseUrl, { auth, transports: ['websocket'] });
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', (err) => reject(err));
    setTimeout(() => reject(new Error('socket connect timeout')), 5000);
  });

test('public share guests only receive brainstorm events, never trip data', async () => {
  const owner = await registerUser(server.baseUrl, {
    name: 'Owner', email: 'sockowner@example.com',
  });
  const tripId = await createTrip(owner.api);

  const share = await owner.api.post(`/trips/${tripId}/public-share`);
  assert.strictEqual(share.status, 200);
  const publicToken = share.data.share_token || share.data.token || share.data.public_share_token;
  assert.ok(publicToken, `no share token in ${JSON.stringify(share.data)}`);

  const visibility = await owner.api.put(`/trips/${tripId}/brainstorm-visibility`, { isPublic: true });
  assert.strictEqual(visibility.status, 200);

  const guestSocket = await connectSocket({ publicToken });
  const ownerSocket = await connectSocket({ token: owner.token });

  try {
    const guestReceived = [];
    ['transport:created', 'activity:created', 'brainstorm:created', 'user:joined'].forEach((event) => {
      guestSocket.on(event, (payload) => guestReceived.push({ event, payload }));
    });

    const guestMembers = new Promise((resolve) => guestSocket.on('room:members', resolve));
    guestSocket.emit('trip:join', tripId);
    assert.deepStrictEqual(await guestMembers, [], 'guests see no presence list');

    const ownerMembers = new Promise((resolve) => ownerSocket.on('room:members', resolve));
    ownerSocket.emit('trip:join', tripId);
    const presence = await ownerMembers;
    assert.ok(!presence.some((m) => m.userName === 'Guest'), 'guests are not listed as room members');

    // Owner relays a trip-data event (would contain confirmation_code) and a
    // brainstorm event; only the latter may reach the guest
    ownerSocket.emit('transport:create', {
      tripId,
      transport: { id: 1, confirmation_code: 'SECRET-123' },
    });
    ownerSocket.emit('brainstorm:create', {
      tripId,
      item: { id: 1, title: 'public idea' },
    });

    await sleep(500);

    const events = guestReceived.map((e) => e.event);
    assert.ok(events.includes('brainstorm:created'), `guest should get brainstorm events, got ${JSON.stringify(events)}`);
    assert.ok(!events.includes('transport:created'), 'guest must not get trip data events');
    assert.ok(!events.includes('user:joined'), 'guest must not get presence events');
    assert.ok(
      !JSON.stringify(guestReceived).includes('SECRET-123'),
      'no confirmation codes may reach a public guest'
    );
  } finally {
    guestSocket.close();
    ownerSocket.close();
  }
});

test('guests cannot join when brainstorming is not public', async () => {
  const owner = await registerUser(server.baseUrl, {
    name: 'Private', email: 'sockpriv@example.com',
  });
  const tripId = await createTrip(owner.api);
  const share = await owner.api.post(`/trips/${tripId}/public-share`);
  const publicToken = share.data.share_token || share.data.token || share.data.public_share_token;
  assert.ok(publicToken);

  const guestSocket = await connectSocket({ publicToken });
  try {
    const denied = new Promise((resolve) => guestSocket.on('error', resolve));
    guestSocket.emit('trip:join', tripId);
    const err = await denied;
    assert.match(err.message, /denied/i);
  } finally {
    guestSocket.close();
  }
});
