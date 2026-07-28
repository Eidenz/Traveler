// server/test/recap.test.js
// Trip archive endpoint + the aggregate recap (stats, distance, per-viewer money).

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startServer, registerUser, createTrip } = require('./helpers');

let server, ana, ben, tripId;

before(async () => {
  server = await startServer();
  ana = await registerUser(server.baseUrl, { name: 'Ana', email: 'ana@recap.local' });
  ben = await registerUser(server.baseUrl, { name: 'Ben', email: 'ben@recap.local' });
  tripId = await createTrip(ana.api, { name: 'Recap Trip', start: '2026-05-01', end: '2026-05-10' });
  await ana.api.post(`/trips/${tripId}/share`, { email: 'ben@recap.local', role: 'editor' });

  // Tokyo -> Kyoto leg (~370 km straight line)
  await ana.api.post(`/transportation/trip/${tripId}`, {
    type: 'Train', from_location: 'Tokyo', to_location: 'Kyoto',
    departure_date: '2026-05-02', from_latitude: 35.6812, from_longitude: 139.7671,
    to_latitude: 35.0116, to_longitude: 135.7681, trip_id: tripId,
  });
  await ana.api.post(`/activities/trip/${tripId}`, {
    name: 'Fushimi Inari', date: '2026-05-03', location: 'Kyoto',
    latitude: 34.9671, longitude: 135.7727, trip_id: tripId,
  });
  await ana.api.post(`/activities/trip/${tripId}`, {
    name: 'TeamLab', date: '2026-05-05', location: 'Tokyo',
    latitude: 35.649, longitude: 139.79, trip_id: tripId,
  });

  const budgetId = (await ana.api.post(`/budgets/trip/${tripId}`, {
    total_amount: 0, currency_code: 'JPY', trip_id: tripId,
  })).data.budget.id;
  await ana.api.post(`/budgets/${budgetId}/expenses`, {
    name: 'Dinner', amount: 8000, category: 'food', date: '2026-05-03', trip_id: tripId,
    paid_by: ana.user.id, split_user_ids: [ana.user.id, ben.user.id],
  });

  const pbId = (await ana.api.post(`/personal-budgets/trip/${tripId}`, {
    total_amount: 50000, currency_code: 'JPY', trip_id: tripId,
  })).data.budget.id;
  await ana.api.post(`/personal-budgets/${pbId}/expenses`, {
    name: 'Souvenirs', amount: 3000, category: 'other', date: '2026-05-04', trip_id: tripId,
  });
});

after(async () => { await server.stop(); });

test('archive is owner-only and round-trips', async () => {
  const denied = await ben.api.patch(`/trips/${tripId}/archive`, { archived: true, trip_id: tripId });
  assert.equal(denied.status, 403);

  const archived = await ana.api.patch(`/trips/${tripId}/archive`, { archived: true, trip_id: tripId });
  assert.equal(archived.status, 200);
  assert.ok(archived.data.trip.archived_at);

  const list = (await ana.api.get('/trips')).data.trips.find(t => t.id === tripId);
  assert.ok(list.archived_at, 'archived_at visible in trip lists');

  const restored = await ana.api.patch(`/trips/${tripId}/archive`, { archived: false, trip_id: tripId });
  assert.equal(restored.data.trip.archived_at, null);
});

test('recap aggregates stats, distance and per-viewer money', async () => {
  const recap = (await ana.api.get(`/trips/${tripId}/recap`)).data;

  assert.equal(recap.days, 10);
  assert.equal(recap.counts.activities, 2);
  assert.equal(recap.counts.transports, 1);
  assert.equal(recap.transport_types.Train, 1);
  assert.ok(recap.distance_km > 350 && recap.distance_km < 400,
    `Tokyo-Kyoto ≈ 370km, got ${recap.distance_km}`);
  assert.equal(recap.places.length, 2);

  assert.equal(recap.shared.total_spent, 8000);
  assert.equal(recap.shared.category_totals.food, 8000);
  assert.equal(recap.shared.settlement.settled, false);
  assert.equal(recap.shared.settlement.remaining, 4000);

  // Ana: 3000 personal + 4000 share of the dinner
  assert.equal(recap.personal.personal_spent, 3000);
  assert.equal(recap.personal.shares_total, 4000);
  assert.equal(recap.personal.total, 7000);

  // Ben sees his own money section: no personal budget, only his share
  const benRecap = (await ben.api.get(`/trips/${tripId}/recap`)).data;
  assert.equal(benRecap.personal.personal_spent, 0);
  assert.equal(benRecap.personal.shares_total, 4000);
});

test('recap requires membership', async () => {
  const outsider = await registerUser(server.baseUrl, { name: 'Out', email: 'out@recap.local' });
  const res = await outsider.api.get(`/trips/${tripId}/recap`);
  assert.equal(res.status, 403);
});
