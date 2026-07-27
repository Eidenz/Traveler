// server/utils/tripAuth.js
// Authorization helpers that derive the trip from the RESOURCE being touched.
//
// checkTripAccess/requireEditAccess resolve the trip from req.params/query/body,
// so on routes keyed by a resource id (e.g. /activities/:activityId) they only
// prove the caller has rights on *some* trip they named — not on the trip that
// owns the resource. Controllers for those routes must call these helpers with
// the trip id read from the resource row itself.

const { db } = require('../db/database');

const EDIT_ROLES = ['owner', 'editor'];
const VIEW_ROLES = ['owner', 'editor', 'viewer'];

/**
 * Get a user's role on a trip.
 * @returns {string|null} 'owner' | 'editor' | 'viewer', or null if not a member
 */
const getTripRole = (tripId, userId) => {
  if (!tripId || !userId) return null;
  const member = db.prepare(
    'SELECT role FROM trip_members WHERE trip_id = ? AND user_id = ?'
  ).get(tripId, userId);
  return member ? member.role : null;
};

/** Whether the user may read the trip's contents. */
const canViewTrip = (tripId, userId) => VIEW_ROLES.includes(getTripRole(tripId, userId));

/** Whether the user may modify the trip's contents. */
const canEditTrip = (tripId, userId) => EDIT_ROLES.includes(getTripRole(tripId, userId));

/**
 * Guard for controllers: responds 403 and returns false when the user lacks
 * the required role on the resource's own trip.
 *
 * @example
 *   if (!authorizeTrip(res, activity.trip_id, req.user.id, 'edit')) return;
 */
const authorizeTrip = (res, tripId, userId, level = 'view') => {
  const allowed = level === 'edit' ? canEditTrip(tripId, userId) : canViewTrip(tripId, userId);
  if (!allowed) {
    res.status(403).json({ message: 'Access denied' });
    return false;
  }
  return true;
};

/** Resolve the trip that owns a budget, or null. */
const getTripIdForBudget = (budgetId) => {
  const row = db.prepare('SELECT trip_id FROM budgets WHERE id = ?').get(budgetId);
  return row ? row.trip_id : null;
};

/** Resolve the trip that owns an expense (via its budget), or null. */
const getTripIdForExpense = (expenseId) => {
  const row = db.prepare(`
    SELECT b.trip_id AS trip_id
    FROM expenses e
    JOIN budgets b ON e.budget_id = b.id
    WHERE e.id = ?
  `).get(expenseId);
  return row ? row.trip_id : null;
};

module.exports = {
  getTripRole,
  canViewTrip,
  canEditTrip,
  authorizeTrip,
  getTripIdForBudget,
  getTripIdForExpense,
};
