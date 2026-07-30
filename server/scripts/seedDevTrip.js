// server/scripts/seedDevTrip.js
// Seeds the dev database with a richly filled ACTIVE trip ("Kansai Circuit",
// currently on day 5 of 10) to exercise the today/nearby views, recap (by
// URL), settlement, currencies, brainstorm, etc.
//
//   cd server && npm run seed:dev          (or DB_PATH=... node scripts/seedDevTrip.js)
//
// Idempotent-ish: running twice creates a second trip, not corruption.
// Refuses to run in production.

if (process.env.NODE_ENV === 'production') {
  console.error('seedDevTrip is a development tool. Refusing to run in production.');
  process.exit(1);
}

const bcrypt = require('bcrypt');
const { db, initializeDatabase } = require('../db/database');
const { generateTripId } = require('../utils/idGenerator');

const daysFromNow = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const findOrCreateUser = (name, email, password) => {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return existing.id;
  const hash = bcrypt.hashSync(password, 10);
  return db.prepare(
    'INSERT INTO users (name, email, password, home_currency_code) VALUES (?, ?, ?, ?)'
  ).run(name, email, hash, name === 'Bob' ? 'USD' : 'EUR').lastInsertRowid;
};

const main = async () => {
  await initializeDatabase();

  const PASSWORD = 'traveler123';
  const alice = findOrCreateUser('Alice', 'alice@dev.local', PASSWORD);
  const bob = findOrCreateUser('Bob', 'bob@dev.local', PASSWORD);
  const cara = findOrCreateUser('Cara', 'cara@dev.local', PASSWORD);

  // ---- trip (ACTIVE: day 5 of 10 as of today) -----------------------------
  // Mid-trip so the Today view has live entries and the Nearby view is in
  // its natural during-trip state; the recap is still reachable by URL.
  const start = daysFromNow(-4);
  const end = daysFromNow(5);
  const tripId = generateTripId();
  db.prepare(`
    INSERT INTO trips (id, name, description, location, start_date, end_date, owner_id, photo_album_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    tripId, 'Kansai Circuit',
    'Tokyo, Kyoto, Osaka and Nara with the crew — food, shrines and too many arcades.',
    'Japan', start, end, alice, 'https://photos.app.goo.gl/dev-seed-album'
  );
  const addMember = db.prepare('INSERT INTO trip_members (trip_id, user_id, role) VALUES (?, ?, ?)');
  addMember.run(tripId, alice, 'owner');
  addMember.run(tripId, bob, 'editor');
  addMember.run(tripId, cara, 'editor');

  const d = (offset) => {
    const dt = new Date(start);
    dt.setDate(dt.getDate() + offset);
    return dt.toISOString().slice(0, 10);
  };

  // ---- transportation (coords -> recap distance) --------------------------
  const addTransport = db.prepare(`
    INSERT INTO transportation (
      trip_id, type, company, from_location, to_location,
      departure_date, departure_time, departure_time_exact,
      arrival_date, arrival_time, arrival_time_exact, confirmation_code,
      from_latitude, from_longitude, to_latitude, to_longitude
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  addTransport.run(tripId, 'Flight', 'ANA', 'Paris CDG', 'Tokyo Haneda',
    d(0), '', '13:30', d(1), '', '08:55', 'NH216-XYZ',
    49.0097, 2.5479, 35.5494, 139.7798);
  addTransport.run(tripId, 'Train', 'JR Shinkansen', 'Tokyo', 'Kyoto',
    d(4), '', '09:12', d(4), '', '11:27', 'JR-8842',
    35.6812, 139.7671, 35.0116, 135.7681);
  addTransport.run(tripId, 'Train', 'JR', 'Kyoto', 'Osaka',
    d(7), 'after breakfast', null, d(7), '', null, null,
    35.0116, 135.7681, 34.6937, 135.5023);
  addTransport.run(tripId, 'Flight', 'ANA', 'Osaka KIX', 'Paris CDG',
    d(9), '', '10:45', d(9), '', '17:20', 'NH215-XYZ',
    34.4342, 135.2440, 49.0097, 2.5479);

  // ---- lodging ------------------------------------------------------------
  const addLodging = db.prepare(`
    INSERT INTO lodging (trip_id, name, address, check_in, check_out, confirmation_code)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  addLodging.run(tripId, 'Shibuya Stream Hotel', '3-21-3 Shibuya, Tokyo', d(1), d(4), 'BK-77120');
  addLodging.run(tripId, 'Gion Ryokan Karaku', 'Higashiyama, Kyoto', d(4), d(7), 'RYK-3321');
  addLodging.run(tripId, 'Namba Riverside Inn', 'Chuo Ward, Osaka', d(7), d(9), 'OSK-9110');

  // ---- activities (mixed exact/free-text times) ---------------------------
  const addActivity = db.prepare(`
    INSERT INTO activities (trip_id, name, date, time, time_exact, location, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  addActivity.run(tripId, 'TeamLab Planets', d(2), '', '10:00', 'Tokyo', 'Book barefoot slots!');
  addActivity.run(tripId, 'Shibuya Crossing + Hachiko', d(2), 'after lunch', null, 'Tokyo', null);
  addActivity.run(tripId, 'Meiji Shrine walk', d(3), '', '09:30', 'Tokyo', null);
  addActivity.run(tripId, 'Akihabara arcades', d(3), 'evening', null, 'Tokyo', 'Bob wants the taiko drums');
  addActivity.run(tripId, 'Fushimi Inari at dawn', d(5), '', '06:30', 'Kyoto', 'Beat the crowds');
  addActivity.run(tripId, 'Kinkaku-ji + tea ceremony', d(5), '', '14:00', 'Kyoto', null);
  addActivity.run(tripId, 'Nara deer park day trip', d(6), '', '10:15', 'Nara', 'Buy crackers, guard the map');
  addActivity.run(tripId, 'Dotonbori food crawl', d(8), '', '18:30', 'Osaka', 'Takoyaki > okonomiyaki, fight me');

  // ---- shared budget: JPY, EUR home, capped, expenses + settlement --------
  const budgetId = db.prepare(`
    INSERT INTO budgets (trip_id, total_amount, currency, currency_code, home_currency_code)
    VALUES (?, 400000, '¥', 'JPY', 'EUR')
  `).run(tripId).lastInsertRowid;

  const addExpense = db.prepare(`
    INSERT INTO expenses (budget_id, name, amount, category, date, paid_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const addSplit = db.prepare('INSERT INTO expense_splits (expense_id, user_id) VALUES (?, ?)');
  const splitAll = (expenseId) => [alice, bob, cara].forEach((u) => addSplit.run(expenseId, u));

  let e;
  e = addExpense.run(budgetId, 'Ryokan (2 nights)', 96000, 'lodging', d(4), alice).lastInsertRowid; splitAll(e);
  e = addExpense.run(budgetId, 'Shinkansen tickets', 42000, 'transport', d(4), bob).lastInsertRowid; splitAll(e);
  e = addExpense.run(budgetId, 'Izakaya night', 18600, 'food', d(5), cara).lastInsertRowid; splitAll(e);
  e = addExpense.run(budgetId, 'TeamLab tickets', 11400, 'activities', d(2), alice).lastInsertRowid; splitAll(e);
  e = addExpense.run(budgetId, 'Dotonbori crawl', 15300, 'food', d(8), bob).lastInsertRowid;
  addSplit.run(e, bob); addSplit.run(e, cara);

  // One payment already recorded (Cara partially settled with Alice)
  db.prepare(`
    INSERT INTO settlement_payments (trip_id, from_user, to_user, amount, created_by)
    VALUES (?, ?, ?, 20000, ?)
  `).run(tripId, cara, alice, alice);

  // ---- Alice's personal budget: EUR envelope, mixed-currency expenses -----
  const pbId = db.prepare(`
    INSERT INTO personal_budgets (trip_id, user_id, total_amount, currency, currency_code, total_currency_code)
    VALUES (?, ?, 1500, '¥', 'JPY', 'EUR')
  `).run(tripId, alice).lastInsertRowid;
  const addPExpense = db.prepare(`
    INSERT INTO personal_expenses (personal_budget_id, name, amount, category, date, currency_code)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  addPExpense.run(pbId, 'Flight (booked from home)', 780, 'transport', d(0), 'EUR');
  addPExpense.run(pbId, 'Pasmo top-ups', 6000, 'transport', d(2), null);
  addPExpense.run(pbId, 'Vintage kimono', 22000, 'other', d(6), null);
  addPExpense.run(pbId, 'Konbini runs', 8400, 'food', d(8), null);

  // Cached JPY->EUR / JPY->USD rates so conversions work without network
  const seedRate = db.prepare(`
    INSERT OR REPLACE INTO currency_rates (base, quote, rate, fetched_at) VALUES (?, ?, ?, ?)
  `);
  seedRate.run('JPY', 'EUR', 0.0061, Date.now());
  seedRate.run('JPY', 'USD', 0.0068, Date.now());

  // ---- brainstorm board ---------------------------------------------------
  const addGroup = db.prepare(`
    INSERT INTO brainstorm_groups (trip_id, title, color, position_x, position_y, width, height, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const gTokyo = addGroup.run(tripId, 'Tokyo', '#0ea5e9', 40, 40, 560, 420, alice).lastInsertRowid;
  const gKansai = addGroup.run(tripId, 'Kansai', '#f59e0b', 680, 40, 560, 420, bob).lastInsertRowid;

  const addItem = db.prepare(`
    INSERT INTO brainstorm_items (
      trip_id, type, title, content, url, latitude, longitude, location_name,
      position_x, position_y, color, priority, group_id, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  addItem.run(tripId, 'place', 'TeamLab Planets', 'Barefoot digital art museum', null,
    35.649, 139.79, 'Toyosu, Tokyo', 70, 110, '#8b5cf6', 2, gTokyo, alice);
  addItem.run(tripId, 'idea', 'Taiko arcade night', 'Akihabara, loser buys ramen', null,
    null, null, null, 320, 110, '#ec4899', 1, gTokyo, bob);
  addItem.run(tripId, 'note', 'JR Pass math', '7-day pass pays off if we do Kyoto AND Osaka', null,
    null, null, null, 70, 300, null, 0, gTokyo, cara);
  addItem.run(tripId, 'place', 'Fushimi Inari', 'Go at dawn or drown in tourists', null,
    34.9671, 135.7727, 'Kyoto', 710, 110, '#ef4444', 3, gKansai, alice);
  addItem.run(tripId, 'place', 'Nara deer park', 'They bow. They also bite.', null,
    34.6851, 135.8048, 'Nara', 960, 110, '#10b981', 1, gKansai, cara);
  addItem.run(tripId, 'link', 'Dotonbori food guide', null, 'https://example.com/dotonbori-guide',
    null, null, null, 710, 300, null, 0, gKansai, bob);
  addItem.run(tripId, 'idea', 'Ghibli museum?', 'Sold out :( next time', null,
    null, null, null, 400, 520, '#64748b', 0, null, alice);

  // Shibuya cluster — five spots within walking distance of each other, so
  // the Nearby view has meaningful sorting when you spoof your location to
  // Shibuya Crossing (DevTools > Sensors > 35.6595, 139.7005)
  const shibuyaSpots = [
    ['Shibuya Crossing selfie', "The classic. Go up Mag's Park for the view", 35.6595, 139.7005, 'Shibuya Crossing', '#0ea5e9'],
    ['Hachiko statue', "Quick photo, it's right there", 35.6590, 139.7006, 'Hachiko Square', null],
    ['Nonbei Yokocho bar alley', 'Tiny bars, go after dark', 35.6598, 139.7027, 'Nonbei Yokocho', '#f59e0b'],
    ['Center Gai ramen hunt', 'The famous jiro-style place', 35.6600, 139.6975, 'Center Gai', '#ef4444'],
    ['Miyashita Park rooftop', 'Rooftop park over the mall', 35.6621, 139.7016, 'Miyashita Park', '#10b981'],
  ];
  const shibuyaIds = shibuyaSpots.map(([title, content, lat, lng, loc, color], i) =>
    addItem.run(tripId, 'place', title, content, null, lat, lng, loc,
      80 + (i % 3) * 260, 700 + Math.floor(i / 3) * 200, color, 0, null, bob).lastInsertRowid
  );

  // Field statuses so the Nearby sections + undo chips have content:
  // Hachiko is group-done (recorded by Alice), the bar alley is
  // personally passed by Alice (Bob and Cara still see it recommended)
  db.prepare(`
    UPDATE brainstorm_items SET done_at = CURRENT_TIMESTAMP, done_by = ? WHERE id = ?
  `).run(alice, shibuyaIds[1]);
  db.prepare(`
    INSERT INTO brainstorm_item_user_status (item_id, user_id, status) VALUES (?, ?, 'dismissed')
  `).run(shibuyaIds[2], alice);

  // ---- checklists ---------------------------------------------------------
  const listId = db.prepare(`
    INSERT INTO checklists (trip_id, name, created_by, is_personal) VALUES (?, 'Packing list', ?, 0)
  `).run(tripId, alice).lastInsertRowid;
  const addCk = db.prepare(`
    INSERT INTO checklist_items (checklist_id, description, collective_status) VALUES (?, ?, ?)
  `);
  const addStatus = db.prepare(`
    INSERT INTO checklist_item_user_status (item_id, user_id, status) VALUES (?, ?, 'checked')
  `);
  const ckDone = (desc) => {
    const id = addCk.run(listId, desc, 'complete').lastInsertRowid;
    [alice, bob, cara].forEach((u) => addStatus.run(id, u));
  };
  ckDone('Passport + visa check');
  ckDone('JR Pass vouchers');
  ckDone('Travel adapter');
  const partial = addCk.run(listId, 'Download offline maps', 'partial').lastInsertRowid;
  addStatus.run(partial, alice);
  addCk.run(listId, 'Print ryokan directions', 'pending');

  console.log('\nSeeded dev trip ✔');
  console.log(`  Trip:     Kansai Circuit (${tripId})  ${start} → ${end}`);
  console.log('  Users:    alice@dev.local / bob@dev.local / cara@dev.local');
  console.log(`  Password: ${PASSWORD}`);
  console.log('  Recap:    /trips/' + tripId + '/recap');
  console.log('  Nearby:   /trips/' + tripId + '/nearby');
  console.log('  Spoof:    DevTools > Sensors > Location: 35.6595, 139.7005 (Shibuya)');
};

main().then(() => process.exit(0)).catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
