// server/test/member-end-date.test.js
// Per-member end date: any member sets their OWN last day (self-service
// route, no :userId), it must fall inside the trip dates, the trip's own end
// date (or null/empty) clears it, and it comes back in the members payload.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startServer, client, registerUser, createTrip } = require('./helpers');

let server, alice, bob, outsider, tripId;

before(async () => {
  server = await startServer();
  alice = await registerUser(server.baseUrl, { name: 'Alice', email: 'al@end.local' });
  bob = await registerUser(server.baseUrl, { name: 'Bob', email: 'bo@end.local' });
  outsider = await registerUser(server.baseUrl, { name: 'Out', email: 'out@end.local' });
  tripId = await createTrip(alice.api, { name: 'Early Leave', start: '2026-08-01', end: '2026-08-10' });
  await alice.api.post(`/trips/${tripId}/share`, { email: 'bo@end.local', role: 'viewer' });
});

after(async () => { await server.stop(); });

test('a member can set and clear their own end date', async () => {
  const set = await bob.api.put(`/trips/${tripId}/members/me/end-date`, { end_date: '2026-08-06' });
  assert.equal(set.status, 200);
  assert.equal(set.data.end_date, '2026-08-06');

  // Visible in the members payload, and only on Bob's row
  let trip = await alice.api.get(`/trips/${tripId}`);
  let memberBob = trip.data.members.find((m) => m.id === bob.user.id);
  let memberAlice = trip.data.members.find((m) => m.id === alice.user.id);
  assert.equal(memberBob.end_date, '2026-08-06');
  assert.equal(memberAlice.end_date, null);

  // Null clears it
  const cleared = await bob.api.put(`/trips/${tripId}/members/me/end-date`, { end_date: null });
  assert.equal(cleared.status, 200);
  assert.equal(cleared.data.end_date, null);

  trip = await bob.api.get(`/trips/${tripId}`);
  memberBob = trip.data.members.find((m) => m.id === bob.user.id);
  assert.equal(memberBob.end_date, null);
});

test('the trip end date itself is stored as "no custom date"', async () => {
  const res = await bob.api.put(`/trips/${tripId}/members/me/end-date`, { end_date: '2026-08-10' });
  assert.equal(res.status, 200);
  assert.equal(res.data.end_date, null);
});

test('dates outside the trip range and malformed values are rejected', async () => {
  for (const bad of ['2026-07-31', '2026-08-11', 'not-a-date', '08/05/2026']) {
    const res = await bob.api.put(`/trips/${tripId}/members/me/end-date`, { end_date: bad });
    assert.equal(res.status, 400, `expected 400 for ${bad}`);
  }

  // The first trip day is a valid last day (leave the day it starts)
  const firstDay = await bob.api.put(`/trips/${tripId}/members/me/end-date`, { end_date: '2026-08-01' });
  assert.equal(firstDay.status, 200);
  assert.equal(firstDay.data.end_date, '2026-08-01');
});

test('each member only ever touches their own row', async () => {
  // Bob's date from the previous test must not leak onto Alice when she
  // sets hers through the same route
  const res = await alice.api.put(`/trips/${tripId}/members/me/end-date`, { end_date: '2026-08-08' });
  assert.equal(res.status, 200);

  const trip = await alice.api.get(`/trips/${tripId}`);
  const memberAlice = trip.data.members.find((m) => m.id === alice.user.id);
  const memberBob = trip.data.members.find((m) => m.id === bob.user.id);
  assert.equal(memberAlice.end_date, '2026-08-08');
  assert.equal(memberBob.end_date, '2026-08-01');
});

test('non-members and anonymous requests are rejected', async () => {
  const denied = await outsider.api.put(`/trips/${tripId}/members/me/end-date`, { end_date: '2026-08-05' });
  assert.equal(denied.status, 403);

  const anon = await client(server.baseUrl).put(`/trips/${tripId}/members/me/end-date`, { end_date: '2026-08-05' });
  assert.equal(anon.status, 401);
});
