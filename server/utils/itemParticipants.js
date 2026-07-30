// server/utils/itemParticipants.js
// Shared participant handling for transportation / lodging / activities.
// Convention: rows in item_participants exist only for a subset selection;
// an item with no rows applies to the whole group. API responses always carry
// a participant_ids array ([] = everyone) so clients never guess.
const { db } = require('../db/database');

/**
 * Parse the participant_ids field from a (multipart) request body.
 * The client sends a JSON array string: '[]' means everyone, '[1,2]' a subset.
 *
 * @returns {null|number[]|false} null when the field is absent (leave
 *   unchanged on update, everyone on create), an id array when valid,
 *   false when malformed.
 */
const parseParticipantIds = (raw) => {
  if (raw === undefined || raw === null) return null;
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return false;
    }
  }
  if (!Array.isArray(parsed)) return false;
  const ids = [...new Set(parsed.map(Number))];
  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) return false;
  return ids;
};

/** Every id must belong to the item's trip. */
const areTripMembers = (tripId, ids) => {
  if (ids.length === 0) return true;
  const placeholders = ids.map(() => '?').join(',');
  const count = db.prepare(`
    SELECT COUNT(*) as c FROM trip_members
    WHERE trip_id = ? AND user_id IN (${placeholders})
  `).get(tripId, ...ids).c;
  return count === ids.length;
};

/** Replace an item's participant rows. Empty array = everyone (no rows). */
const setParticipants = (itemType, itemId, ids) => {
  db.prepare('DELETE FROM item_participants WHERE item_type = ? AND item_id = ?')
    .run(itemType, itemId);
  const insert = db.prepare(
    'INSERT INTO item_participants (item_type, item_id, user_id) VALUES (?, ?, ?)'
  );
  for (const userId of ids) insert.run(itemType, itemId, userId);
};

const getParticipantIds = (itemType, itemId) =>
  db.prepare('SELECT user_id FROM item_participants WHERE item_type = ? AND item_id = ?')
    .all(itemType, itemId).map((r) => r.user_id);

const deleteParticipants = (itemType, itemId) => {
  db.prepare('DELETE FROM item_participants WHERE item_type = ? AND item_id = ?')
    .run(itemType, itemId);
};

/** Attach participant_ids to each row of a list query result (in place). */
const attachParticipants = (itemType, rows) => {
  if (!rows.length) return rows;
  const stmt = db.prepare(
    'SELECT user_id FROM item_participants WHERE item_type = ? AND item_id = ?'
  );
  for (const row of rows) {
    row.participant_ids = stmt.all(itemType, row.id).map((r) => r.user_id);
  }
  return rows;
};

/**
 * One-stop handler for create/update: parse, validate against the trip, and
 * persist. Sends the 400 itself on bad input and returns false; returns true
 * when done (including the field-absent no-op case).
 */
const applyParticipantsFromRequest = (res, itemType, itemId, tripId, rawField) => {
  const ids = parseParticipantIds(rawField);
  if (ids === null) return true;
  if (ids === false) {
    res.status(400).json({ message: 'participant_ids must be a JSON array of user ids' });
    return false;
  }
  if (!areTripMembers(tripId, ids)) {
    res.status(400).json({ message: 'All participants must be members of the trip' });
    return false;
  }
  setParticipants(itemType, itemId, ids);
  return true;
};

module.exports = {
  parseParticipantIds,
  areTripMembers,
  setParticipants,
  getParticipantIds,
  deleteParticipants,
  attachParticipants,
  applyParticipantsFromRequest,
};
