// server/test/documents.test.js
// Covers document permissions, link documents, and the reference_id
// normalization regression (numeric JSON ids were stored as '3.0' and then
// never matched by the item detail queries).

const test = require('node:test');
const assert = require('node:assert');
const { startServer, registerUser, createTrip } = require('./helpers');

let server, owner, editor, outsider, tripA, tripB, activityId;

test.before(async () => {
  server = await startServer();
  owner = await registerUser(server.baseUrl, { name: 'Owner', email: 'docowner@test.local' });
  editor = await registerUser(server.baseUrl, { name: 'Editor', email: 'doceditor@test.local' });
  outsider = await registerUser(server.baseUrl, { name: 'Outsider', email: 'docoutsider@test.local' });

  tripA = await createTrip(owner.api, { name: 'Doc Trip' });
  tripB = await createTrip(outsider.api, { name: 'Outsider Trip' });
  await owner.api.post(`/trips/${tripA}/share`, { email: 'doceditor@test.local', role: 'editor' });

  const form = new FormData();
  form.append('name', 'Museum');
  form.append('date', '2026-08-02');
  const res = await owner.api.post(`/activities/trip/${tripA}`, form);
  activityId = res.data.activity.id;
});

test.after(async () => { await server.stop(); });

const makeLink = (api, refType, refId, extra = {}) =>
  api.post('/documents/link', {
    url: 'https://tickets.example.com/qr/abc',
    title: 'QR ticket',
    reference_type: refType,
    reference_id: refId,
    ...extra,
  });

// --- link documents ------------------------------------------------------

test('a link document is created and returned with its url', async () => {
  const res = await makeLink(owner.api, 'trip', tripA);
  assert.equal(res.status, 201);
  assert.equal(res.data.document.file_type, 'link');
  assert.equal(res.data.document.url, 'https://tickets.example.com/qr/abc');
});

test('link title falls back to the hostname', async () => {
  const res = await owner.api.post('/documents/link', {
    url: 'https://airline.example.com/boarding',
    reference_type: 'trip',
    reference_id: tripA,
  });
  assert.equal(res.data.document.file_name, 'airline.example.com');
});

test('non-http(s) and malformed urls are rejected', async () => {
  for (const url of ['javascript:alert(1)', 'file:///etc/passwd', 'not a url']) {
    const res = await owner.api.post('/documents/link', {
      url, reference_type: 'trip', reference_id: tripA,
    });
    assert.equal(res.status, 400, `${url} must be rejected`);
  }
});

test('REGRESSION: a numeric reference_id is stored so the item query still matches', async () => {
  // JSON sends ids as numbers; SQLite's TEXT column used to stringify the bound
  // double as '3.0', which no longer matched reference_id = '3'.
  const created = await makeLink(owner.api, 'activity', activityId);
  assert.equal(created.status, 201);
  assert.equal(created.data.document.reference_id, String(activityId));

  const detail = await owner.api.get(`/activities/${activityId}?tripId=${tripA}`);
  const found = detail.data.documents.find(d => d.id === created.data.document.id);
  assert.ok(found, 'link document must be visible on the activity it is attached to');
  assert.equal(found.url, 'https://tickets.example.com/qr/abc');
});

test('link documents have no file to download or view', async () => {
  const created = await makeLink(owner.api, 'trip', tripA);
  const id = created.data.document.id;
  assert.equal((await owner.api.get(`/documents/${id}/download`)).status, 400);
  assert.equal((await owner.api.get(`/documents/${id}/view`)).status, 400);
});

// --- permissions ---------------------------------------------------------

test('an outsider cannot attach a document to another trip', async () => {
  const res = await makeLink(outsider.api, 'trip', tripA);
  assert.equal(res.status, 403);
});

test('an outsider cannot delete a document from another trip', async () => {
  const created = await makeLink(owner.api, 'trip', tripA);
  const id = created.data.document.id;

  // Names their own trip to satisfy the route middleware
  const res = await outsider.api.delete(`/documents/${id}?tripId=${tripB}`);
  assert.equal(res.status, 403);

  assert.equal((await owner.api.get(`/documents/${id}`)).status, 200, 'document must survive');
});

test('personal documents are hidden from other trip members', async () => {
  const personal = await owner.api.post('/documents/link', {
    url: 'https://private.example.com/mine',
    title: 'My private booking',
    reference_type: 'activity',
    reference_id: activityId,
    is_personal: true,
  });
  assert.equal(personal.status, 201);
  const id = personal.data.document.id;

  // Editor is a legitimate member but must not see or fetch someone else's personal doc
  const detail = await editor.api.get(`/activities/${activityId}?tripId=${tripA}`);
  assert.ok(!detail.data.documents.some(d => d.id === id), 'personal doc must not be listed');
  assert.equal((await editor.api.get(`/documents/${id}`)).status, 403);

  // The owner still sees their own
  const ownDetail = await owner.api.get(`/activities/${activityId}?tripId=${tripA}`);
  assert.ok(ownDetail.data.documents.some(d => d.id === id));
});

test('uploaded documents are not readable from the static /uploads path', async () => {
  const res = await fetch(`${server.baseUrl}/uploads/documents/anything.pdf`);
  assert.equal(res.status, 403, 'document files must only be served through the API');
});
