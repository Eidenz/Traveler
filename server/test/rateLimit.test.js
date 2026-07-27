// server/test/rateLimit.test.js
//
// Rate limiting is disabled when NODE_ENV=test (see middleware/rateLimit.js) so
// the other suites can register and log in freely. This file starts servers
// WITHOUT that flag so the limiters are live.
//
// Each test gets its own server: limiter state is per-process and keyed by IP,
// so a test that deliberately exhausts the login budget would otherwise block
// every later test from the same address.

const test = require('node:test');
const assert = require('node:assert');
const { startServer, client } = require('./helpers');

/** Run `fn` against a freshly started rate-limited server. */
async function withServer(fn) {
  const server = await startServer({ rateLimitEnabled: true });
  try {
    await fn(client(server.baseUrl));
  } finally {
    await server.stop();
  }
}

test('repeated failed logins are eventually rate limited', async () => {
  await withServer(async (api) => {
    await api.post('/auth/register', {
      name: 'Victim', email: 'victim@test.local', password: 'secret123',
    });

    let limitedAt = null;
    for (let attempt = 1; attempt <= 15; attempt++) {
      const res = await api.post('/auth/login', {
        email: 'victim@test.local', password: 'wrong-password',
      });
      if (res.status === 429) { limitedAt = attempt; break; }
      // The login controller answers bad credentials with 400
      assert.equal(res.status, 400, `attempt ${attempt} should fail auth, got ${res.status}`);
    }

    assert.ok(limitedAt, 'brute forcing the login must be blocked before 15 attempts');
    assert.ok(limitedAt <= 12, `expected the limit around 10 attempts, tripped at ${limitedAt}`);
  });
});

test('a successful login is not counted against the failed-attempt limit', async () => {
  await withServer(async (api) => {
    await api.post('/auth/register', {
      name: 'Regular', email: 'regular@test.local', password: 'secret123',
    });

    // Well past the 10 failed-attempt limit, but these all succeed so a normal
    // user signing in repeatedly is never locked out of their own account.
    for (let i = 0; i < 12; i++) {
      const res = await api.post('/auth/login', {
        email: 'regular@test.local', password: 'secret123',
      });
      assert.equal(res.status, 200, `legitimate login #${i + 1} must not be blocked`);
    }
  });
});

test('brute forcing one account does not lock out other users', async () => {
  await withServer(async (api) => {
    await api.post('/auth/register', {
      name: 'Target', email: 'target@test.local', password: 'secret123',
    });
    await api.post('/auth/register', {
      name: 'Bystander', email: 'bystander@test.local', password: 'secret123',
    });

    // Exhaust the limit against one account (same IP, since it's all localhost)
    for (let i = 0; i < 12; i++) {
      await api.post('/auth/login', { email: 'target@test.local', password: 'wrong' });
    }
    const blocked = await api.post('/auth/login', {
      email: 'target@test.local', password: 'secret123',
    });
    assert.equal(blocked.status, 429, 'the attacked account should be throttled');

    // A different user from the same address must still be able to sign in
    const bystander = await api.post('/auth/login', {
      email: 'bystander@test.local', password: 'secret123',
    });
    assert.equal(bystander.status, 200, 'an unrelated account must not be locked out');
  });
});

test('password reset requests are rate limited', async () => {
  await withServer(async (api) => {
    await api.post('/auth/register', {
      name: 'Victim', email: 'victim@test.local', password: 'secret123',
    });

    let limited = false;
    for (let i = 0; i < 8; i++) {
      const res = await api.post('/auth/forgot-password', { email: 'victim@test.local' });
      if (res.status === 429) { limited = true; break; }
    }
    assert.ok(limited, 'forgot-password must be limited to stop inbox/SMTP abuse');
  });
});

test('registration is rate limited', async () => {
  await withServer(async (api) => {
    let limited = false;
    for (let i = 0; i < 15; i++) {
      const res = await api.post('/auth/register', {
        name: `Bulk ${i}`, email: `bulk${i}@test.local`, password: 'secret123',
      });
      if (res.status === 429) { limited = true; break; }
    }
    assert.ok(limited, 'bulk account creation must be limited');
  });
});
