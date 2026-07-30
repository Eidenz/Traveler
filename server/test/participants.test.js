// server/test/participants.test.js
// Item participants: transports/lodging/activities can target a subset of the
// trip. No rows = everyone (backward compatible), any editor may change the
// list, non-members are rejected, and rows die with the item.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startServer, registerUser, createTrip } = require('./helpers');

let server, alice, bob, cara, outsider, tripId;

before(async () => {
  server = await startServer();
  alice = await registerUser(server.baseUrl, { name: 'Alice', email: 'al@part.local' });
  bob = await registerUser(server.baseUrl, { name: 'Bob', email: 'bo@part.local' });
  cara = await registerUser(server.baseUrl, { name: 'Cara', email: 'ca@part.local' });
  outsider = await registerUser(server.baseUrl, { name: 'Out', email: 'out@part.local' });
  tripId = await createTrip(alice.api, { name: 'Split Trip' });
  await alice.api.post(`/trips/${tripId}/share`, { email: 'bo@part.local', role: 'editor' });
  await alice.api.post(`/trips/${tripId}/share`, { email: 'ca@part.local', role: 'editor' });
});

after(async () => { await server.stop(); });

test('items default to everyone and accept a participant subset', async () => {
  // No participant_ids field at all → everyone
  const plain = await alice.api.post(`/activities/trip/${tripId}`, {
    name: 'Group dinner', date: '2026-08-02',
  });
  assert.equal(plain.status, 201);
  assert.deepEqual(plain.data.activity.participant_ids, []);

  // Subset on create
  const subset = await alice.api.post(`/activities/trip/${tripId}`, {
    name: 'Late-stay museum', date: '2026-08-03',
    participant_ids: JSON.stringify([bob.user.id, cara.user.id]),
  });
  assert.equal(subset.status, 201);
  assert.deepEqual(subset.data.activity.participant_ids.sort(), [bob.user.id, cara.user.id].sort());

  // The trip payload carries the lists too
  const trip = await alice.api.get(`/trips/${tripId}`);
  const fetched = trip.data.activities.find(a => a.id === subset.data.activity.id);
  assert.deepEqual(fetched.participant_ids.sort(), [bob.user.id, cara.user.id].sort());
});

test('any editor can change participants; update replaces the list', async () => {
  const created = await alice.api.post(`/transportation/trip/${tripId}`, {
    type: 'Flight', from_location: 'CDG', to_location: 'HND',
    departure_date: '2026-08-01',
    participant_ids: [bob.user.id],
  });
  assert.equal(created.status, 201);
  const id = created.data.transportation.id;

  // Bob (editor, not creator) rewrites the list to Cara only
  const updated = await bob.api.put(`/transportation/${id}?tripId=${tripId}`, {
    type: 'Flight', from_location: 'CDG', to_location: 'HND',
    departure_date: '2026-08-01', trip_id: tripId,
    participant_ids: [cara.user.id],
  });
  assert.equal(updated.status, 200);
  assert.deepEqual(updated.data.transportation.participant_ids, [cara.user.id]);

  // Update without the field leaves the list untouched
  const untouched = await bob.api.put(`/transportation/${id}?tripId=${tripId}`, {
    type: 'Flight', from_location: 'CDG', to_location: 'NRT',
    departure_date: '2026-08-01', trip_id: tripId,
  });
  assert.deepEqual(untouched.data.transportation.participant_ids, [cara.user.id]);

  // Empty array resets to everyone
  const everyone = await bob.api.put(`/transportation/${id}?tripId=${tripId}`, {
    type: 'Flight', from_location: 'CDG', to_location: 'NRT',
    departure_date: '2026-08-01', trip_id: tripId,
    participant_ids: [],
  });
  assert.deepEqual(everyone.data.transportation.participant_ids, []);
});

test('non-members and malformed lists are rejected', async () => {
  const nonMember = await alice.api.post(`/lodging/trip/${tripId}`, {
    name: 'Hotel', check_in: '2026-08-01', check_out: '2026-08-05',
    participant_ids: [outsider.user.id],
  });
  assert.equal(nonMember.status, 400);

  const malformed = await alice.api.post(`/lodging/trip/${tripId}`, {
    name: 'Hotel', check_in: '2026-08-01', check_out: '2026-08-05',
    participant_ids: 'not-json',
  });
  assert.equal(malformed.status, 400);
});

test('participant rows are removed with the item', async () => {
  const created = await alice.api.post(`/lodging/trip/${tripId}`, {
    name: 'Ryokan', check_in: '2026-08-02', check_out: '2026-08-04',
    participant_ids: [alice.user.id, bob.user.id],
  });
  assert.equal(created.status, 201);
  const id = created.data.lodging.id;

  const del = await alice.api.delete(`/lodging/${id}?tripId=${tripId}`, { trip_id: tripId });
  assert.equal(del.status, 200);

  // Recreate an unrelated lodging: it must not inherit stale rows even if
  // sqlite reuses the rowid
  const fresh = await alice.api.post(`/lodging/trip/${tripId}`, {
    name: 'Capsule', check_in: '2026-08-05', check_out: '2026-08-06',
  });
  assert.deepEqual(fresh.data.lodging.participant_ids, []);
});

test('removing a member from the trip drops them from participant lists', async () => {
  const created = await alice.api.post(`/activities/trip/${tripId}`, {
    name: 'Farewell drinks', date: '2026-08-09',
    participant_ids: [bob.user.id, cara.user.id],
  });
  assert.equal(created.status, 201);
  const id = created.data.activity.id;

  const removed = await alice.api.delete(`/trips/${tripId}/members/${cara.user.id}`);
  assert.equal(removed.status, 200);

  const trip = await alice.api.get(`/trips/${tripId}`);
  const item = trip.data.activities.find(a => a.id === id);
  assert.deepEqual(item.participant_ids, [bob.user.id]);
});
