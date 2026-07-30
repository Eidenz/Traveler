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

test('item status: personal scope is private, group scope is shared', async () => {
  const item = (await owner.api.post(`/brainstorm/trip/${tripId}`, {
    type: 'place', title: 'Status Shrine', position_x: 0, position_y: 0,
    latitude: 35.0, longitude: 135.0,
  })).data.item;

  // Personal done
  const me = await owner.api.patch(`/brainstorm/${item.id}/status`, {
    status: 'done', scope: 'me', trip_id: tripId,
  });
  assert.equal(me.status, 200);
  assert.equal(me.data.item.my_status, 'done');
  assert.equal(me.data.item.done_at, null, 'personal status must not touch group fields');

  // Group dismiss
  const grp = await owner.api.patch(`/brainstorm/${item.id}/status`, {
    status: 'dismissed', scope: 'group', trip_id: tripId,
  });
  assert.ok(grp.data.item.dismissed_at);
  assert.equal(grp.data.item.dismissed_by, owner.user.id);

  // Group done replaces group dismiss
  const done = await owner.api.patch(`/brainstorm/${item.id}/status`, {
    status: 'done', scope: 'group', trip_id: tripId,
  });
  assert.ok(done.data.item.done_at);
  assert.equal(done.data.item.dismissed_at, null);

  // Clear both scopes
  await owner.api.patch(`/brainstorm/${item.id}/status`, { status: null, scope: 'me', trip_id: tripId });
  const cleared = await owner.api.patch(`/brainstorm/${item.id}/status`, { status: null, scope: 'group', trip_id: tripId });
  assert.equal(cleared.data.item.my_status, null);
  assert.equal(cleared.data.item.done_at, null);

  // List carries my_status per requester
  await owner.api.patch(`/brainstorm/${item.id}/status`, { status: 'dismissed', scope: 'me', trip_id: tripId });
  const list = (await owner.api.get(`/brainstorm/trip/${tripId}`)).data.items;
  assert.equal(list.find(i => i.id === item.id).my_status, 'dismissed');
});
