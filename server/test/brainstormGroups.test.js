// server/test/brainstormGroups.test.js
// Group membership model: items may belong to a group in the same trip,
// cross-trip group ids are rejected, and deleting a group orphans (not
// deletes) its members.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startServer, registerUser, createTrip } = require('./helpers');

let server, owner, tripId, otherTripId, groupId, otherTripGroupId;

before(async () => {
  server = await startServer();
  owner = await registerUser(server.baseUrl, { name: 'Storm', email: 'storm@test.local' });
  tripId = await createTrip(owner.api, { name: 'Board Trip' });
  otherTripId = await createTrip(owner.api, { name: 'Other Trip' });

  groupId = (await owner.api.post(`/brainstorm/trip/${tripId}/groups`, {
    title: 'Tokyo', position_x: 0, position_y: 0, width: 400, height: 300,
  })).data.group.id;
  otherTripGroupId = (await owner.api.post(`/brainstorm/trip/${otherTripId}/groups`, {
    title: 'Elsewhere', position_x: 0, position_y: 0, width: 400, height: 300,
  })).data.group.id;
});

after(async () => { await server.stop(); });

test('items can be created inside a group and moved out of it', async () => {
  const created = await owner.api.post(`/brainstorm/trip/${tripId}`, {
    type: 'idea', title: 'Ramen tour', position_x: 50, position_y: 50, group_id: groupId,
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.item.group_id, groupId);
  const itemId = created.data.item.id;

  // Ungroup with explicit null
  const ungrouped = await owner.api.put(`/brainstorm/${itemId}`, { group_id: null, trip_id: tripId });
  assert.equal(ungrouped.status, 200);
  assert.equal(ungrouped.data.item.group_id, null);

  // Re-join
  const regrouped = await owner.api.put(`/brainstorm/${itemId}`, { group_id: groupId, trip_id: tripId });
  assert.equal(regrouped.data.item.group_id, groupId);

  // Updates that don't mention group_id keep the membership
  const renamed = await owner.api.put(`/brainstorm/${itemId}`, { title: 'Ramen marathon', trip_id: tripId });
  assert.equal(renamed.data.item.group_id, groupId);
});

test('a group from another trip is rejected on create and update', async () => {
  const created = await owner.api.post(`/brainstorm/trip/${tripId}`, {
    type: 'note', title: 'Sneaky', position_x: 0, position_y: 0, group_id: otherTripGroupId,
  });
  assert.equal(created.status, 400);

  const ok = await owner.api.post(`/brainstorm/trip/${tripId}`, {
    type: 'note', title: 'Legit', position_x: 0, position_y: 0,
  });
  const moved = await owner.api.put(`/brainstorm/${ok.data.item.id}`, {
    group_id: otherTripGroupId, trip_id: tripId,
  });
  assert.equal(moved.status, 400);
});

test('deleting a group orphans its members instead of deleting them', async () => {
  const doomedGroupId = (await owner.api.post(`/brainstorm/trip/${tripId}/groups`, {
    title: 'Doomed', position_x: 0, position_y: 0, width: 200, height: 200,
  })).data.group.id;
  const item = (await owner.api.post(`/brainstorm/trip/${tripId}`, {
    type: 'idea', title: 'Survivor', position_x: 10, position_y: 10, group_id: doomedGroupId,
  })).data.item;

  const del = await owner.api.delete(`/brainstorm/groups/${doomedGroupId}?tripId=${tripId}`);
  assert.equal(del.status, 200);

  const items = (await owner.api.get(`/brainstorm/trip/${tripId}`)).data.items;
  const survivor = items.find(i => i.id === item.id);
  assert.ok(survivor, 'item must survive its group');
  assert.equal(survivor.group_id, null);
});
