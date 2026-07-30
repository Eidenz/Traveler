// server/test/expenseItemLink.test.js
// Shared expenses can point at the trip item they pay for: create-with-link,
// link an existing expense, unlink, cross-trip rejection, and item deletion
// turning the expense back into a plain budget entry.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startServer, registerUser, createTrip } = require('./helpers');

let server, alice, bob, tripId, otherTripId, budgetId, activityId;

before(async () => {
  server = await startServer();
  alice = await registerUser(server.baseUrl, { name: 'Alice', email: 'al@link.local' });
  bob = await registerUser(server.baseUrl, { name: 'Bob', email: 'bo@link.local' });
  tripId = await createTrip(alice.api, { name: 'Link Trip' });
  otherTripId = await createTrip(alice.api, { name: 'Other Trip' });
  await alice.api.post(`/trips/${tripId}/share`, { email: 'bo@link.local', role: 'editor' });

  budgetId = (await alice.api.post(`/budgets/trip/${tripId}`, {
    total_amount: 0, currency: '€', currency_code: 'EUR',
  })).data.budget.id;

  activityId = (await alice.api.post(`/activities/trip/${tripId}`, {
    name: 'TeamLab tickets', date: '2026-08-03',
  })).data.activity.id;
});

after(async () => { await server.stop(); });

test('an expense can be created linked to an item, splits included', async () => {
  const res = await alice.api.post(`/budgets/${budgetId}/expenses?tripId=${tripId}`, {
    name: 'TeamLab tickets', amount: 80, category: 'activities', date: '2026-08-03',
    trip_id: tripId, paid_by: alice.user.id, split_user_ids: [alice.user.id, bob.user.id],
    reference_type: 'activity', reference_id: activityId,
  });
  assert.equal(res.status, 201);
  assert.equal(res.data.expense.reference_type, 'activity');
  assert.equal(res.data.expense.reference_id, activityId);
  assert.deepEqual(res.data.expense.split_user_ids.sort(), [alice.user.id, bob.user.id].sort());

  // Visible in the budget payload for the wizard to find
  const budget = await alice.api.get(`/budgets/trip/${tripId}`);
  const linked = budget.data.expenses.find(e => e.reference_id === activityId);
  assert.ok(linked, 'linked expense should be in the budget payload');
});

test('an existing expense can be linked and unlinked via update', async () => {
  const created = await alice.api.post(`/budgets/${budgetId}/expenses?tripId=${tripId}`, {
    name: 'Old hotel booking', amount: 400, category: 'lodging', date: '2026-08-01',
    trip_id: tripId,
  });
  const expenseId = created.data.expense.id;
  assert.equal(created.data.expense.reference_type, null);

  const lodgingId = (await alice.api.post(`/lodging/trip/${tripId}`, {
    name: 'Old hotel', check_in: '2026-08-01', check_out: '2026-08-04',
  })).data.lodging.id;

  // Link (an update that touches nothing else)
  const linked = await bob.api.put(`/budgets/expenses/${expenseId}?tripId=${tripId}`, {
    reference_type: 'lodging', reference_id: lodgingId, trip_id: tripId,
  });
  assert.equal(linked.status, 200);
  assert.equal(linked.data.expense.reference_id, lodgingId);
  assert.equal(linked.data.expense.amount, 400, 'amount must survive a link-only update');

  // Unlink with the '' sentinel
  const unlinked = await bob.api.put(`/budgets/expenses/${expenseId}?tripId=${tripId}`, {
    reference_type: '', reference_id: '', trip_id: tripId,
  });
  assert.equal(unlinked.status, 200);
  assert.equal(unlinked.data.expense.reference_type, null);
  assert.equal(unlinked.data.expense.reference_id, null);
});

test('linking an item from another trip is rejected', async () => {
  const foreignActivityId = (await alice.api.post(`/activities/trip/${otherTripId}`, {
    name: 'Foreign', date: '2026-08-03',
  })).data.activity.id;

  const res = await alice.api.post(`/budgets/${budgetId}/expenses?tripId=${tripId}`, {
    name: 'Sneaky', amount: 10, category: 'other', date: '2026-08-02', trip_id: tripId,
    reference_type: 'activity', reference_id: foreignActivityId,
  });
  assert.equal(res.status, 400);

  const badType = await alice.api.post(`/budgets/${budgetId}/expenses?tripId=${tripId}`, {
    name: 'Sneaky 2', amount: 10, category: 'other', date: '2026-08-02', trip_id: tripId,
    reference_type: 'trip', reference_id: 1,
  });
  assert.equal(badType.status, 400);
});

test('deleting the item keeps the expense but clears the link', async () => {
  const doomedId = (await alice.api.post(`/activities/trip/${tripId}`, {
    name: 'Doomed tour', date: '2026-08-04',
  })).data.activity.id;
  const expenseId = (await alice.api.post(`/budgets/${budgetId}/expenses?tripId=${tripId}`, {
    name: 'Doomed tour', amount: 55, category: 'activities', date: '2026-08-04',
    trip_id: tripId, reference_type: 'activity', reference_id: doomedId,
  })).data.expense.id;

  const del = await alice.api.delete(`/activities/${doomedId}?tripId=${tripId}`, { trip_id: tripId });
  assert.equal(del.status, 200);

  const budget = await alice.api.get(`/budgets/trip/${tripId}`);
  const expense = budget.data.expenses.find(e => e.id === expenseId);
  assert.ok(expense, 'expense must survive the item deletion');
  assert.equal(expense.reference_type, null);
  assert.equal(expense.reference_id, null);
});
