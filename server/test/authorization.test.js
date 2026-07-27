// server/test/authorization.test.js
//
// These tests pin down the authorization model. The recurring bug class in this
// codebase is a route resolving the trip from a client-supplied id (query/body)
// instead of from the resource being touched, which lets a user with rights on
// *their own* trip act on someone else's records by id.

const test = require('node:test');
const assert = require('node:assert');
const { startServer, registerUser, createTrip, client } = require('./helpers');

let server;
let owner;      // owns trip A
let outsider;   // owns their own trip B, no access to trip A
let viewer;     // viewer role on trip A
let tripA;
let tripB;

test.before(async () => {
  server = await startServer();

  owner = await registerUser(server.baseUrl, { name: 'Owner', email: 'owner@test.local' });
  outsider = await registerUser(server.baseUrl, { name: 'Outsider', email: 'outsider@test.local' });
  viewer = await registerUser(server.baseUrl, { name: 'Viewer', email: 'viewer@test.local' });

  tripA = await createTrip(owner.api, { name: 'Trip A' });
  tripB = await createTrip(outsider.api, { name: 'Trip B' });

  await owner.api.post(`/trips/${tripA}/share`, { email: 'viewer@test.local', role: 'viewer' });
});

test.after(async () => {
  await server.stop();
});

// --- helpers -------------------------------------------------------------

async function createActivity(api, tripId, name = 'Museum') {
  const form = new FormData();
  form.append('name', name);
  form.append('date', '2026-08-02');
  const res = await api.post(`/activities/trip/${tripId}`, form);
  assert.equal(res.status, 201, `activity create failed: ${JSON.stringify(res.data)}`);
  return res.data.activity.id;
}

// --- authentication ------------------------------------------------------

test('unauthenticated requests are rejected', async () => {
  const anon = client(server.baseUrl);
  assert.equal((await anon.get(`/trips/${tripA}`)).status, 401);
  assert.equal((await anon.get('/activities/1')).status, 401);
});

test('a token signed with the wrong secret is rejected', async () => {
  const jwt = require('jsonwebtoken');
  const forged = jwt.sign({ userId: owner.user.id }, 'not-the-real-secret');
  const res = await client(server.baseUrl, forged).get(`/trips/${tripA}`);
  assert.equal(res.status, 401);
});

// --- trip-level access ---------------------------------------------------

test('a non-member cannot read a trip', async () => {
  const res = await outsider.api.get(`/trips/${tripA}`);
  assert.equal(res.status, 403);
});

test('a member can read a trip', async () => {
  assert.equal((await viewer.api.get(`/trips/${tripA}`)).status, 200);
});

// --- cross-trip IDOR (the core regression) -------------------------------

test('an outsider cannot read an activity belonging to another trip', async () => {
  const activityId = await createActivity(owner.api, tripA);
  const res = await outsider.api.get(`/activities/${activityId}?tripId=${tripB}`);
  assert.equal(res.status, 403, 'activity of another trip must not be readable');
});

test('an outsider cannot update an activity by naming their own trip', async () => {
  const activityId = await createActivity(owner.api, tripA, 'Original');

  // The attacker has edit rights on tripB and passes that id to satisfy the
  // route middleware, while targeting a record that belongs to tripA.
  const form = new FormData();
  form.append('name', 'Hacked');
  form.append('date', '2026-08-02');
  const res = await outsider.api.put(`/activities/${activityId}?tripId=${tripB}`, form);
  assert.equal(res.status, 403);

  const check = await owner.api.get(`/activities/${activityId}?tripId=${tripA}`);
  assert.equal(check.data.activity.name, 'Original', 'record must be unchanged');
});

test('an outsider cannot delete an activity belonging to another trip', async () => {
  const activityId = await createActivity(owner.api, tripA, 'Keep me');

  const res = await outsider.api.delete(`/activities/${activityId}?tripId=${tripB}`);
  assert.equal(res.status, 403);

  const check = await owner.api.get(`/activities/${activityId}?tripId=${tripA}`);
  assert.equal(check.status, 200, 'record must still exist');
});

test('a viewer cannot modify trip content', async () => {
  const activityId = await createActivity(owner.api, tripA);
  const form = new FormData();
  form.append('name', 'Viewer edit');
  form.append('date', '2026-08-02');
  assert.equal((await viewer.api.put(`/activities/${activityId}?tripId=${tripA}`, form)).status, 403);
  assert.equal((await viewer.api.delete(`/activities/${activityId}?tripId=${tripA}`)).status, 403);
});
