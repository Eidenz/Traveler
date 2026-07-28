// server/test/settlement.test.js
// Expense settlement: payer + equal splits, member validation, who-owes-whom.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startServer, registerUser, createTrip } = require('./helpers');

let server, alice, bob, cara, tripId, budgetId;

before(async () => {
  server = await startServer();
  alice = await registerUser(server.baseUrl, { name: 'Alice', email: 'al@settle.local' });
  bob = await registerUser(server.baseUrl, { name: 'Bob', email: 'bo@settle.local' });
  cara = await registerUser(server.baseUrl, { name: 'Cara', email: 'ca@settle.local' });
  tripId = await createTrip(alice.api, { name: 'Settle Trip' });
  await alice.api.post(`/trips/${tripId}/share`, { email: 'bo@settle.local', role: 'editor' });
  await alice.api.post(`/trips/${tripId}/share`, { email: 'ca@settle.local', role: 'editor' });

  budgetId = (await alice.api.post(`/budgets/trip/${tripId}`, {
    total_amount: 3000, currency: '€', currency_code: 'EUR', home_currency_code: 'EUR',
  })).data.budget.id;
});

after(async () => { await server.stop(); });

test('settlement nets shared expenses into minimal transfers', async () => {
  // Alice pays 90 split between all three; Bob pays 30 split between Bob+Cara
  const e1 = await alice.api.post(`/budgets/${budgetId}/expenses`, {
    name: 'Dinner', amount: 90, category: 'food', date: '2026-08-02', trip_id: tripId,
    paid_by: alice.user.id, split_user_ids: [alice.user.id, bob.user.id, cara.user.id],
  });
  assert.equal(e1.status, 201);
  assert.equal(e1.data.expense.paid_by, alice.user.id);
  assert.deepEqual([...e1.data.expense.split_user_ids].sort(), [alice.user.id, bob.user.id, cara.user.id].sort());

  const e2 = await bob.api.post(`/budgets/${budgetId}/expenses`, {
    name: 'Taxi', amount: 30, category: 'transport', date: '2026-08-02', trip_id: tripId,
    paid_by: bob.user.id, split_user_ids: [bob.user.id, cara.user.id],
  });
  assert.equal(e2.status, 201);

  // Nets: Alice +60, Bob -30+15 = -15, Cara -30-15 = -45
  const st = (await cara.api.get(`/budgets/trip/${tripId}/settlement`)).data;
  const net = Object.fromEntries(st.balances.map(b => [b.name, b.net]));
  assert.equal(net.Alice, 60);
  assert.equal(net.Bob, -15);
  assert.equal(net.Cara, -45);

  // Two transfers settle it, both toward Alice
  assert.equal(st.transfers.length, 2);
  assert.ok(st.transfers.every(t => t.to_name === 'Alice'));
  const paid = Object.fromEntries(st.transfers.map(t => [t.from_name, t.amount]));
  assert.equal(paid.Cara, 45);
  assert.equal(paid.Bob, 15);
});

test('expenses without a payer stay out of settlement', async () => {
  await alice.api.post(`/budgets/${budgetId}/expenses`, {
    name: 'Info only', amount: 500, category: 'other', date: '2026-08-03', trip_id: tripId,
  });
  const st = (await alice.api.get(`/budgets/trip/${tripId}/settlement`)).data;
  const net = Object.fromEntries(st.balances.map(b => [b.name, b.net]));
  assert.equal(net.Alice, 60, 'informational expense must not move balances');
});

test('non-member payers and participants are rejected', async () => {
  const outsider = await registerUser(server.baseUrl, { name: 'Out', email: 'out@settle.local' });
  const bad1 = await alice.api.post(`/budgets/${budgetId}/expenses`, {
    name: 'Bad', amount: 10, category: 'other', date: '2026-08-03', trip_id: tripId, paid_by: outsider.user.id,
  });
  assert.equal(bad1.status, 400);
  const bad2 = await alice.api.post(`/budgets/${budgetId}/expenses`, {
    name: 'Bad', amount: 10, category: 'other', date: '2026-08-03', trip_id: tripId,
    paid_by: alice.user.id, split_user_ids: [outsider.user.id],
  });
  assert.equal(bad2.status, 400);
});

test('clearing the payer removes an expense from settlement', async () => {
  const e = await alice.api.post(`/budgets/${budgetId}/expenses`, {
    name: 'Temp', amount: 20, category: 'other', date: '2026-08-04', trip_id: tripId,
    paid_by: bob.user.id, split_user_ids: [alice.user.id, bob.user.id],
  });
  const cleared = await alice.api.put(`/budgets/expenses/${e.data.expense.id}`, {
    name: 'Temp', amount: 20, category: 'other', date: '2026-08-04', paid_by: '',
    trip_id: tripId,
  });
  assert.equal(cleared.status, 200);
  assert.equal(cleared.data.expense.paid_by, null);
  assert.deepEqual(cleared.data.expense.split_user_ids, []);
});

test('budget carries ISO currency codes and validates them', async () => {
  const bad = await alice.api.put(`/budgets/${budgetId}`, {
    total_amount: 3000, currency_code: 'YENS', trip_id: tripId,
  });
  assert.equal(bad.status, 400);

  const ok = await alice.api.put(`/budgets/${budgetId}`, {
    total_amount: 3000, currency_code: 'JPY', home_currency_code: 'EUR', trip_id: tripId,
  });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.budget.currency_code, 'JPY');
  assert.equal(ok.data.budget.home_currency_code, 'EUR');
});
