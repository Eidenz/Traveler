// server/test/checklists.test.js
// Covers the shared/personal checklist model: personal lists belong to their
// creator only, any member (including viewers) may keep their own, and shared
// lists still require edit rights.

const test = require('node:test');
const assert = require('node:assert');
const { startServer, registerUser, createTrip } = require('./helpers');

let server, owner, viewer, tripId, sharedId, ownerPersonalId;

test.before(async () => {
  server = await startServer();
  owner = await registerUser(server.baseUrl, { name: 'Owner', email: 'clowner@test.local' });
  viewer = await registerUser(server.baseUrl, { name: 'Viewer', email: 'clviewer@test.local' });
  tripId = await createTrip(owner.api, { name: 'Checklist Trip' });
  await owner.api.post(`/trips/${tripId}/share`, { email: 'clviewer@test.local', role: 'viewer' });

  sharedId = (await owner.api.post(`/checklists/trip/${tripId}`, { name: 'Group packing' })).data.checklist.id;
  ownerPersonalId = (await owner.api.post(`/checklists/trip/${tripId}`, {
    name: 'My own list', is_personal: true,
  })).data.checklist.id;
});

test.after(async () => { await server.stop(); });

test('personal checklists are hidden from other members', async () => {
  const list = await viewer.api.get(`/checklists/trip/${tripId}`);
  const ids = list.data.checklists.map(c => c.id);
  assert.ok(ids.includes(sharedId), 'shared checklist should be visible');
  assert.ok(!ids.includes(ownerPersonalId), "another member's personal list must be hidden");

  // Direct fetch by id is refused too
  assert.equal((await viewer.api.get(`/checklists/${ownerPersonalId}`)).status, 403);
});

test('the creator sees their own personal checklist', async () => {
  const list = await owner.api.get(`/checklists/trip/${tripId}`);
  assert.ok(list.data.checklists.some(c => c.id === ownerPersonalId));
});

test('a viewer may create and manage their own personal checklist', async () => {
  const created = await viewer.api.post(`/checklists/trip/${tripId}`, {
    name: 'Viewer private', is_personal: true,
  });
  assert.equal(created.status, 201);
  const id = created.data.checklist.id;

  const item = await viewer.api.post(`/checklists/${id}/items`, {
    description: 'Camera', trip_id: tripId,
  });
  assert.equal(item.status, 201);

  assert.equal((await viewer.api.delete(`/checklists/${id}?tripId=${tripId}`)).status, 200);
});

test('a viewer cannot create a shared checklist', async () => {
  const res = await viewer.api.post(`/checklists/trip/${tripId}`, { name: 'Nope' });
  assert.equal(res.status, 403);
});

test('a viewer cannot edit or delete a shared checklist', async () => {
  assert.equal((await viewer.api.put(`/checklists/${sharedId}`, { name: 'Renamed', tripId })).status, 403);
  assert.equal((await viewer.api.delete(`/checklists/${sharedId}?tripId=${tripId}`)).status, 403);
});

test('another member cannot touch items in a personal checklist', async () => {
  const item = await owner.api.post(`/checklists/${ownerPersonalId}/items`, {
    description: 'Passport', trip_id: tripId,
  });
  const itemId = item.data.item.id;

  assert.equal((await viewer.api.patch(`/checklists/items/${itemId}/user-status`, {
    status: 'checked', trip_id: tripId,
  })).status, 403);
  assert.equal((await viewer.api.delete(`/checklists/items/${itemId}?tripId=${tripId}`)).status, 403);
});

test('personal checklist completion is measured against the creator alone', async () => {
  const item = await owner.api.post(`/checklists/${ownerPersonalId}/items`, {
    description: 'Adapter', trip_id: tripId,
  });
  const res = await owner.api.patch(`/checklists/items/${item.data.item.id}/user-status`, {
    status: 'checked', trip_id: tripId,
  });
  assert.equal(res.data.item.completion.total_members, 1);
  assert.equal(res.data.item.completion.is_complete, true);
});

test('shared checklist completion counts every trip member', async () => {
  const item = await owner.api.post(`/checklists/${sharedId}/items`, {
    description: 'Tent', trip_id: tripId,
  });
  const res = await viewer.api.patch(`/checklists/items/${item.data.item.id}/user-status`, {
    status: 'checked', trip_id: tripId,
  });
  assert.equal(res.data.item.completion.total_members, 2);
  assert.equal(res.data.item.completion.is_complete, false, '1 of 2 members is not complete');
});

test('the trip listing carries own and group progress without fetching items', async () => {
  // Fresh shared list: two items, owner checks one. Audience = 2 members.
  const listId = (await owner.api.post(`/checklists/trip/${tripId}`, { name: 'Progress list' })).data.checklist.id;
  const itemA = (await owner.api.post(`/checklists/${listId}/items`, {
    description: 'Passports', trip_id: tripId,
  })).data.item;
  await owner.api.post(`/checklists/${listId}/items`, {
    description: 'Chargers', trip_id: tripId,
  });
  await owner.api.patch(`/checklists/items/${itemA.id}/user-status`, {
    status: 'checked', trip_id: tripId,
  });

  const forOwner = (await owner.api.get(`/checklists/trip/${tripId}`)).data.checklists
    .find(c => c.id === listId);
  assert.equal(forOwner.total_items, 2);
  assert.equal(forOwner.user_completed_items, 1, 'owner checked one item');
  // 1 actioned status over 2 items x 2 members = 25%
  assert.equal(forOwner.group_percentage, 25);

  const forViewer = (await viewer.api.get(`/checklists/trip/${tripId}`)).data.checklists
    .find(c => c.id === listId);
  assert.equal(forViewer.user_completed_items, 0, 'viewer has checked nothing');
  assert.equal(forViewer.group_percentage, 25, 'group progress is the same for every member');
});

test('personal checklist progress is measured against the creator alone', async () => {
  const listId = (await owner.api.post(`/checklists/trip/${tripId}`, {
    name: 'Personal progress', is_personal: true,
  })).data.checklist.id;
  const item = (await owner.api.post(`/checklists/${listId}/items`, {
    description: 'Book', trip_id: tripId,
  })).data.item;
  await owner.api.patch(`/checklists/items/${item.id}/user-status`, {
    status: 'checked', trip_id: tripId,
  });

  const summary = (await owner.api.get(`/checklists/trip/${tripId}`)).data.checklists
    .find(c => c.id === listId);
  // Audience is just the creator: 1 checked / (1 item x 1 person) = 100%
  assert.equal(summary.group_percentage, 100);
  assert.equal(summary.user_completed_items, 1);
});
