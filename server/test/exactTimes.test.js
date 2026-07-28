// server/test/exactTimes.test.js
// The dual time model: legacy free-text time columns stay unvalidated, the
// *_time_exact columns must be canonical 24h 'HH:MM' (or empty) on both
// create and update.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startServer, registerUser, createTrip } = require('./helpers');

let server, owner, tripId;

before(async () => {
  server = await startServer();
  owner = await registerUser(server.baseUrl, { name: 'Timer', email: 'timer@test.local' });
  tripId = await createTrip(owner.api, { name: 'Time Trip', start: '2026-08-01', end: '2026-08-10' });
});

after(async () => { await server.stop(); });

test('activities accept an exact time and keep free text untouched', async () => {
  const clocked = await owner.api.post(`/activities/trip/${tripId}`, {
    name: 'Museum', date: '2026-08-02', time: '', time_exact: '14:30',
  });
  assert.equal(clocked.status, 201);
  assert.equal(clocked.data.activity.time_exact, '14:30');
  assert.equal(clocked.data.activity.time, '');

  const freeText = await owner.api.post(`/activities/trip/${tripId}`, {
    name: 'Lunch', date: '2026-08-02', time: 'after the museum', time_exact: '',
  });
  assert.equal(freeText.status, 201);
  assert.equal(freeText.data.activity.time_exact, null);
  assert.equal(freeText.data.activity.time, 'after the museum');
});

test('malformed exact times are rejected on create and update', async () => {
  for (const bad of ['2:30 PM', '25:00', '14:60', '14h30']) {
    const res = await owner.api.post(`/activities/trip/${tripId}`, {
      name: 'Bad', date: '2026-08-03', time_exact: bad,
    });
    assert.equal(res.status, 400, `'${bad}' should be rejected`);
  }

  const ok = await owner.api.post(`/activities/trip/${tripId}`, {
    name: 'Editable', date: '2026-08-03', time_exact: '09:00',
  });
  const id = ok.data.activity.id;
  const badUpdate = await owner.api.put(`/activities/${id}`, {
    name: 'Editable', date: '2026-08-03', time_exact: '9am', trip_id: tripId,
  });
  assert.equal(badUpdate.status, 400);
});

test('transportation carries both exact time columns end to end', async () => {
  const created = await owner.api.post(`/transportation/trip/${tripId}`, {
    type: 'Train', from_location: 'Tokyo', to_location: 'Kyoto',
    departure_date: '2026-08-04', departure_time: '', departure_time_exact: '08:12',
    arrival_date: '2026-08-04', arrival_time: 'around lunch', arrival_time_exact: '',
  });
  assert.equal(created.status, 201);
  const t = created.data.transportation;
  assert.equal(t.departure_time_exact, '08:12');
  assert.equal(t.arrival_time_exact, null);
  assert.equal(t.arrival_time, 'around lunch');

  // Update: switching arrival to a clock time clears the text (client sends both)
  const updated = await owner.api.put(`/transportation/${t.id}`, {
    type: 'Train', from_location: 'Tokyo', to_location: 'Kyoto',
    departure_date: '2026-08-04', departure_time: '', departure_time_exact: '08:12',
    arrival_date: '2026-08-04', arrival_time: '', arrival_time_exact: '10:45',
    trip_id: tripId,
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.data.transportation.arrival_time_exact, '10:45');
  assert.equal(updated.data.transportation.arrival_time, '');
});

test('the public share payload includes the exact time fields', async () => {
  const share = await owner.api.post(`/trips/${tripId}/public-share`);
  const { client } = require('./helpers');
  const pub = await client(server.baseUrl).get(`/trips/public/${share.data.token}`);
  assert.equal(pub.status, 200);
  assert.ok(pub.data.activities.some(a => a.time_exact === '14:30'));
  assert.ok(pub.data.transportation.some(t => t.departure_time_exact === '08:12'));
});
