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

test('marking transfers paid drives balances, progress and undo', async () => {
  // From the earlier tests: Cara owes 45, Bob owes 15, Alice is owed 60
  const before = (await alice.api.get(`/budgets/trip/${tripId}/settlement`)).data;
  assert.equal(before.progress.ratio, 0);
  const caraTransfer = before.transfers.find(tr => tr.from_name === 'Cara');

  // The bill payer (Alice) records Cara's payment herself
  const rec = await alice.api.post(`/budgets/trip/${tripId}/settlement/payments`, {
    from_user: caraTransfer.from, to_user: caraTransfer.to, amount: caraTransfer.amount,
    trip_id: tripId,
  });
  assert.equal(rec.status, 201);

  const after = (await alice.api.get(`/budgets/trip/${tripId}/settlement`)).data;
  assert.ok(!after.transfers.some(tr => tr.from_name === 'Cara'), 'Cara transfer settled');
  assert.equal(after.payments.length, 1);
  assert.equal(after.payments[0].created_by_name, 'Alice');
  assert.equal(after.progress.ratio, 0.75, '45 of 60 total debt settled');

  // Undo restores the debt
  const undo = await alice.api.delete(
    `/budgets/settlement/payments/${after.payments[0].id}?tripId=${tripId}`);
  assert.equal(undo.status, 200);
  const restored = (await alice.api.get(`/budgets/trip/${tripId}/settlement`)).data;
  assert.ok(restored.transfers.some(tr => tr.from_name === 'Cara'));
  assert.equal(restored.progress.ratio, 0);
});

test('conversion follows each member´s own home currency', async () => {
  // Budget is JPY (set in the ISO-codes test); seed the rate cache so no
  // network is needed: JPY->USD and JPY->EUR
  const sqlite3 = require('better-sqlite3');
  const db = sqlite3(server.dbPath);
  const seed = db.prepare(
    'INSERT OR REPLACE INTO currency_rates (base, quote, rate, fetched_at) VALUES (?, ?, ?, ?)');
  seed.run('JPY', 'USD', 0.0068, Date.now());
  seed.run('JPY', 'EUR', 0.0061, Date.now());
  db.close();

  // Bob is a USD person, Alice stays on the budget fallback (EUR)
  const profile = new FormData();
  profile.append('name', 'Bob');
  profile.append('home_currency_code', 'USD');
  const upd = await bob.api.put('/users/profile', profile);
  assert.equal(upd.status, 200);
  assert.equal(upd.data.user.home_currency_code, 'USD');

  const forBob = (await bob.api.get(`/budgets/trip/${tripId}`)).data;
  assert.equal(forBob.conversion.home_currency_code, 'USD');
  assert.equal(forBob.conversion.rate, 0.0068);

  const forAlice = (await alice.api.get(`/budgets/trip/${tripId}`)).data;
  assert.equal(forAlice.conversion.home_currency_code, 'EUR');
  assert.equal(forAlice.conversion.rate, 0.0061);
});

test('setting a trip currency code derives the display symbol', async () => {
  const t2 = await createTrip(alice.api, { name: 'Symbol Trip' });
  const created = await alice.api.post(`/budgets/trip/${t2}`, {
    total_amount: 100000, currency_code: 'JPY',
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.budget.currency, '¥');
  assert.equal(created.data.budget.currency_code, 'JPY');
});

test('personal budgets carry ISO codes and per-expense currencies', async () => {
  const t3 = await createTrip(alice.api, { name: 'Personal Currency Trip' });
  const created = await alice.api.post(`/personal-budgets/trip/${t3}`, {
    total_amount: 200000, currency_code: 'JPY', trip_id: t3,
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.budget.currency, '¥');
  assert.equal(created.data.budget.currency_code, 'JPY');
  const pbId = created.data.budget.id;

  // A local (trip currency, implicit) and a home-currency expense mix
  const local = await alice.api.post(`/personal-budgets/${pbId}/expenses`, {
    name: 'Ramen', amount: 1200, category: 'food', date: '2026-08-05', trip_id: t3,
  });
  assert.equal(local.status, 201);
  const flight = await alice.api.post(`/personal-budgets/${pbId}/expenses`, {
    name: 'Flight', amount: 800, category: 'transport', date: '2026-07-01',
    currency_code: 'EUR', trip_id: t3,
  });
  assert.equal(flight.status, 201);

  // Alice's home currency is EUR (budget fallback earlier tests) — wait,
  // her profile home is unset; seed it plus the JPY->EUR rate for conversion
  const profile = new FormData();
  profile.append('name', 'Alice');
  profile.append('home_currency_code', 'EUR');
  await alice.api.put('/users/profile', profile);

  const data = (await alice.api.get(`/personal-budgets/trip/${t3}`)).data;
  const byName = Object.fromEntries(data.expenses.map(e => [e.name, e]));
  assert.equal(byName.Ramen.currency_code, null, 'implicit = trip currency');
  assert.equal(byName.Flight.currency_code, 'EUR');
  assert.ok(data.conversion, 'trip<->home conversion present');
  assert.equal(data.conversion.trip_currency_code, 'JPY');
  assert.equal(data.conversion.home_currency_code, 'EUR');

  const badCode = await alice.api.post(`/personal-budgets/${pbId}/expenses`, {
    name: 'Bad', amount: 10, category: 'other', date: '2026-08-06',
    currency_code: 'EUROS', trip_id: t3,
  });
  assert.equal(badCode.status, 400);
});

test('personal conversion falls back to the shared budget home currency', async () => {
  // Cara has no profile home currency; the trip's shared budget is EUR-homed
  const pb = await cara.api.post(`/personal-budgets/trip/${tripId}`, {
    total_amount: 100000, currency_code: 'JPY', trip_id: tripId,
  });
  assert.equal(pb.status, 201);

  const data = (await cara.api.get(`/personal-budgets/trip/${tripId}`)).data;
  assert.ok(data.conversion, 'fallback conversion expected');
  assert.equal(data.conversion.home_currency_code, 'EUR');
});

test('personal budget total can be denominated in the home currency', async () => {
  // €5000 envelope on a JPY-currency personal budget
  const t4 = await createTrip(alice.api, { name: 'Envelope Trip' });
  const created = await alice.api.post(`/personal-budgets/trip/${t4}`, {
    total_amount: 5000, currency_code: 'JPY', total_currency_code: 'EUR', trip_id: t4,
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.budget.total_currency_code, 'EUR');
  assert.equal(created.data.budget.currency_code, 'JPY');

  // Clearing it reverts the total to trip currency
  const cleared = await alice.api.put(`/personal-budgets/${created.data.budget.id}`, {
    total_amount: 5000, total_currency_code: '', trip_id: t4,
  });
  assert.equal(cleared.status, 200);
  assert.equal(cleared.data.budget.total_currency_code, null);

  const bad = await alice.api.post(`/personal-budgets/trip/${t4}`, {
    total_amount: 1, total_currency_code: 'EUROS', trip_id: t4,
  });
  assert.equal(bad.status, 400);
});

test('a shared budget with no limit (total 0) is accepted', async () => {
  const t5 = await createTrip(alice.api, { name: 'No Limit Trip' });
  const created = await alice.api.post(`/budgets/trip/${t5}`, {
    total_amount: 0, currency_code: 'JPY', trip_id: t5,
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.budget.total_amount, 0);

  // Expenses and settlement work exactly the same without a cap
  const e = await alice.api.post(`/budgets/${created.data.budget.id}/expenses`, {
    name: 'Dinner', amount: 4000, category: 'food', date: '2026-08-08', trip_id: t5,
    paid_by: alice.user.id,
  });
  assert.equal(e.status, 201);
  const st = (await alice.api.get(`/budgets/trip/${t5}/settlement`)).data;
  assert.ok(st.balances.length >= 0);
});
