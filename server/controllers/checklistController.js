// server/controllers/checklistController.js
const { db } = require('../db/database');
const { validationResult } = require('express-validator');
const { queueNotificationsForTripMembers } = require('../utils/emailQueueService');
const { emitToTrip } = require('../utils/socketService');

/**
 * Get the user's role on a trip (null if not a member)
 */
const getMemberRole = (tripId, userId) => {
  const member = db.prepare('SELECT role FROM trip_members WHERE trip_id = ? AND user_id = ?').get(tripId, userId);
  return member ? member.role : null;
};

/**
 * Whether a user can modify a checklist (or its items).
 * Personal checklists belong to their creator only; shared checklists
 * require edit access on the trip.
 */
const canManageChecklist = (checklist, userId) => {
  const role = getMemberRole(checklist.trip_id, userId);
  if (!role) return false;
  if (checklist.is_personal) return checklist.created_by === userId;
  return role === 'owner' || role === 'editor';
};

/**
 * Whether a user can see a checklist at all (personal ones are creator-only)
 */
const canViewChecklist = (checklist, userId) => {
  if (!getMemberRole(checklist.trip_id, userId)) return false;
  if (checklist.is_personal) return checklist.created_by === userId;
  return true;
};

/**
 * The set of users a checklist's completion is measured against:
 * all trip members for shared checklists, just the creator for personal ones.
 */
const getChecklistAudience = (checklist) => {
  if (checklist.is_personal) return [checklist.created_by];
  return db.prepare('SELECT user_id FROM trip_members WHERE trip_id = ?')
    .all(checklist.trip_id).map(m => m.user_id);
};

/**
 * Get all checklists for a trip
 */
const getTripChecklists = (req, res) => {
  try {
    const { tripId } = req.params;

    // Get checklists (other members' personal checklists are hidden)
    const checklists = db.prepare(`
      SELECT c.*,
        u.name as creator_name,
        (SELECT COUNT(*) FROM checklist_items WHERE checklist_id = c.id) as total_items,
        (SELECT COUNT(*) FROM checklist_item_user_status cius JOIN checklist_items ci ON cius.item_id = ci.id WHERE ci.checklist_id = c.id AND cius.user_id = ? AND cius.status = 'checked') as user_completed_items,
        (SELECT COUNT(*) FROM checklist_items WHERE checklist_id = c.id AND collective_status = 'complete') as collective_completed_items
      FROM checklists c
      JOIN users u ON c.created_by = u.id
      WHERE c.trip_id = ?
        AND (c.is_personal = 0 OR c.is_personal IS NULL OR c.created_by = ?)
      ORDER BY c.created_at DESC
    `).all(req.user.id, tripId, req.user.id); // Added user id for user-specific completion

    return res.status(200).json({ checklists });
  } catch (error) {
    console.error('Get checklists error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Get a single checklist with its items and user statuses
 */
const getChecklist = (req, res) => {
  try {
    const { checklistId } = req.params;
    const userId = req.user.id;

    // Get checklist
    const checklist = db.prepare(`
      SELECT c.*, u.name as creator_name
      FROM checklists c
      JOIN users u ON c.created_by = u.id
      WHERE c.id = ?
    `).get(checklistId);

    if (!checklist) {
      return res.status(404).json({ message: 'Checklist not found' });
    }

    if (!canViewChecklist(checklist, userId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Users this checklist's completion is measured against
    // (all trip members for shared, only the creator for personal)
    const tripMembers = getChecklistAudience(checklist).map(id => ({ user_id: id }));

    // Get items
    const items = db.prepare(`
      SELECT ci.*,
        u.name as updated_by_name,
        u.profile_image as updated_by_image
      FROM checklist_items ci
      LEFT JOIN users u ON ci.updated_by = u.id
      WHERE ci.checklist_id = ?
      ORDER BY ci.id ASC
    `).all(checklistId);

    // For each item, get the user-specific statuses
    const itemsWithUserStatus = items.map(item => {
      // Get all user statuses for this item
      const userStatuses = db.prepare(`
        SELECT cus.*, u.name, u.profile_image
        FROM checklist_item_user_status cus
        JOIN users u ON cus.user_id = u.id
        WHERE cus.item_id = ?
      `).all(item.id);

      // Get current user's status
      const currentUserStatus = db.prepare(`
        SELECT status FROM checklist_item_user_status
        WHERE item_id = ? AND user_id = ?
      `).get(item.id, userId);

      // Calculate completion metrics
      const totalMembers = tripMembers.length;
      const totalChecked = userStatuses.filter(s => s.status === 'checked').length;
      const totalSkipped = userStatuses.filter(s => s.status === 'skipped').length;
      const totalActioned = totalChecked + totalSkipped;
      const completionPercentage = totalMembers > 0 ? Math.round((totalActioned / totalMembers) * 100) : 0;

      return {
        ...item,
        user_statuses: userStatuses,
        current_user_status: currentUserStatus ? currentUserStatus.status : 'pending',
        completion: {
          total_members: totalMembers,
          checked_count: totalChecked,
          skipped_count: totalSkipped,
          percentage: completionPercentage,
          is_complete: item.collective_status === 'complete' // Use collective status from item
        }
      };
    });

    return res.status(200).json({
      checklist,
      items: itemsWithUserStatus
    });
  } catch (error) {
    console.error('Get checklist error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Update a checklist item status for the current user
 */
const updateUserItemStatus = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { status } = req.body;
    const userId = req.user.id;

    // Check if item exists
    const item = db.prepare('SELECT * FROM checklist_items WHERE id = ?').get(itemId);
    if (!item) {
      return res.status(404).json({ message: 'Checklist item not found' });
    }

    // Validate status
    if (!['checked', 'skipped', 'pending'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Must be checked, skipped, or pending.' });
    }

    // Get checklist for socket emission and personal-checklist checks
    const checklist = db.prepare('SELECT * FROM checklists WHERE id = ?').get(item.checklist_id);
    if (!checklist) {
      return res.status(404).json({ message: 'Checklist not found' });
    }

    // Must be a member of the checklist's actual trip; personal checklists
    // can only be interacted with by their creator
    if (!canViewChecklist(checklist, userId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Begin transaction
    db.prepare('BEGIN TRANSACTION').run();

    try {
      // Check if there's already a status for this user and item
      const existingStatus = db.prepare(`
        SELECT * FROM checklist_item_user_status
        WHERE item_id = ? AND user_id = ?
      `).get(itemId, userId);

      if (existingStatus) {
        // Update existing status
        db.prepare(`
          UPDATE checklist_item_user_status
          SET status = ?, updated_at = CURRENT_TIMESTAMP
          WHERE item_id = ? AND user_id = ?
        `).run(status, itemId, userId);
      } else {
        // Insert new status
        db.prepare(`
          INSERT INTO checklist_item_user_status (item_id, user_id, status)
          VALUES (?, ?, ?)
        `).run(itemId, userId, status);
      }

      // Get all user statuses for this item to calculate collective status
      const userStatuses = db.prepare(`
        SELECT cus.user_id, cus.status FROM checklist_item_user_status cus
        WHERE cus.item_id = ?
      `).all(itemId);

      // Users this item's completion is measured against
      const tripMembers = getChecklistAudience(checklist);

      // Calculate collective status
      const totalMembers = tripMembers.length;
      let actionedCount = 0;
      let checkedCount = 0;
      let skippedCount = 0;

      for (const memberId of tripMembers) {
        const memberStatus = userStatuses.find(s => s.user_id === memberId);
        if (memberStatus && (memberStatus.status === 'checked' || memberStatus.status === 'skipped')) {
          actionedCount++;
          if (memberStatus.status === 'checked') checkedCount++;
          if (memberStatus.status === 'skipped') skippedCount++;
        }
      }

      let collectiveStatus = 'pending';
      if (actionedCount === totalMembers && totalMembers > 0) {
        collectiveStatus = 'complete';
      } else if (actionedCount > 0) {
        collectiveStatus = 'partial';
      }

      // Update the item's collective status
      db.prepare(`
        UPDATE checklist_items
        SET collective_status = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(collectiveStatus, userId, itemId);

      // Commit transaction
      db.prepare('COMMIT').run();

      // Get all user statuses with user info for the response
      const userStatusesWithInfo = db.prepare(`
        SELECT cus.*, u.name, u.profile_image
        FROM checklist_item_user_status cus
        JOIN users u ON cus.user_id = u.id
        WHERE cus.item_id = ?
      `).all(itemId);

      // Get updated item
      const updatedItem = db.prepare(`
        SELECT ci.*, u.name as updated_by_name, u.profile_image as updated_by_image
        FROM checklist_items ci
        LEFT JOIN users u ON ci.updated_by = u.id
        WHERE ci.id = ?
      `).get(itemId);

      // Calculate completion metrics for response
      const completionPercentage = totalMembers > 0 ? Math.round((actionedCount / totalMembers) * 100) : 0;

      // Emit socket event for real-time update (checked is true if status is 'checked')
      // Personal checklists are not broadcast to other members
      if (!checklist.is_personal) {
        emitToTrip(checklist.trip_id, 'checklistItem:toggled', {
          checklistId: item.checklist_id,
          itemId: itemId,
          checked: status === 'checked',
          status: status,
          item: {
            ...updatedItem,
            user_statuses: userStatusesWithInfo,
            current_user_status: status,
            completion: {
              total_members: totalMembers,
              checked_count: checkedCount,
              skipped_count: skippedCount,
              percentage: completionPercentage,
              is_complete: collectiveStatus === 'complete'
            }
          }
        }, userId); // Exclude the user who made the change
      }

      return res.status(200).json({
        message: 'Checklist item status updated successfully',
        item: {
          ...updatedItem,
          user_statuses: userStatusesWithInfo,
          current_user_status: status,
          completion: {
            total_members: totalMembers,
            checked_count: checkedCount, // Use calculated counts
            skipped_count: skippedCount, // Use calculated counts
            percentage: completionPercentage,
            is_complete: collectiveStatus === 'complete'
          }
        }
      });
    } catch (error) {
      // Rollback on error
      db.prepare('ROLLBACK').run();
      throw error;
    }
  } catch (error) {
    console.error('Update checklist item status error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Create a new checklist
 */
const createChecklist = (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { tripId } = req.params;
    const { name, is_personal } = req.body;
    const userId = req.user.id;
    const isPersonal = is_personal === true || is_personal === 'true' || is_personal === 1 ? 1 : 0;

    // Check if trip exists
    const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    // Shared checklists require edit access; any member can create personal ones
    if (!isPersonal && !['owner', 'editor'].includes(req.userRole)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Insert checklist
    const insert = db.prepare(`
      INSERT INTO checklists (trip_id, name, created_by, is_personal)
      VALUES (?, ?, ?, ?)
    `);

    const result = insert.run(tripId, name, userId, isPersonal);

    // Get the created checklist
    const checklist = db.prepare(`
      SELECT c.*, u.name as creator_name
      FROM checklists c
      JOIN users u ON c.created_by = u.id
      WHERE c.id = ?
    `).get(result.lastInsertRowid);

    // Personal checklists are private: no emails or broadcasts to other members
    if (!isPersonal) {
      // Queue notification emails for other trip members (batched)
      const updateData = {
        checklistName: name,
        checklistItemCount: 0 // Initially 0 items
      };

      queueNotificationsForTripMembers(tripId, userId, 'checklist', updateData, {
        name: trip.name,
        location: trip.location
      });

      // Emit socket event for real-time update (exclude sender)
      emitToTrip(tripId, 'checklist:created', checklist, userId);
    }

    return res.status(201).json({
      message: 'Checklist created successfully',
      checklist // Send back the created checklist with creator name
    });
  } catch (error) {
    console.error('Create checklist error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Update a checklist
 */
const updateChecklist = (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { checklistId } = req.params;
    const { name } = req.body;
    const userId = req.user.id;

    // Check if checklist exists
    const checklist = db.prepare('SELECT * FROM checklists WHERE id = ?').get(checklistId);
    if (!checklist) {
      return res.status(404).json({ message: 'Checklist not found' });
    }

    if (!canManageChecklist(checklist, userId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Update checklist
    const update = db.prepare(`
      UPDATE checklists
      SET name = ?
      WHERE id = ?
    `);

    update.run(name, checklistId);

    // Get updated checklist
    const updatedChecklist = db.prepare(`
      SELECT c.*, u.name as creator_name
      FROM checklists c
      JOIN users u ON c.created_by = u.id
      WHERE c.id = ?
    `).get(checklistId);

    // Emit socket event for real-time update (exclude sender)
    if (!checklist.is_personal) {
      emitToTrip(checklist.trip_id, 'checklist:updated', updatedChecklist, userId);
    }

    return res.status(200).json({
      message: 'Checklist updated successfully',
      checklist: updatedChecklist
    });
  } catch (error) {
    console.error('Update checklist error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Delete a checklist
 */
const deleteChecklist = (req, res) => {
  try {
    const { checklistId } = req.params;
    const userId = req.user.id;

    // Check if checklist exists
    const checklist = db.prepare('SELECT * FROM checklists WHERE id = ?').get(checklistId);
    if (!checklist) {
      return res.status(404).json({ message: 'Checklist not found' });
    }

    if (!canManageChecklist(checklist, userId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const tripId = checklist.trip_id;

    // Delete checklist (will cascade to delete items and user statuses)
    db.prepare('DELETE FROM checklists WHERE id = ?').run(checklistId);

    // Emit socket event for real-time update (exclude sender)
    if (!checklist.is_personal) {
      emitToTrip(tripId, 'checklist:deleted', checklistId, userId);
    }

    return res.status(200).json({
      message: 'Checklist deleted successfully'
    });
  } catch (error) {
    console.error('Delete checklist error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Create a new checklist item
 */
const createChecklistItem = (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { checklistId } = req.params;
    const { description, note } = req.body;
    const userId = req.user.id;

    // Check if checklist exists
    const checklist = db.prepare('SELECT * FROM checklists WHERE id = ?').get(checklistId);
    if (!checklist) {
      return res.status(404).json({ message: 'Checklist not found' });
    }

    if (!canManageChecklist(checklist, userId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Insert item
    const insert = db.prepare(`
      INSERT INTO checklist_items (checklist_id, description, note)
      VALUES (?, ?, ?)
    `);

    const result = insert.run(checklistId, description, note || '');

    // Get the created item
    const item = db.prepare('SELECT * FROM checklist_items WHERE id = ?').get(result.lastInsertRowid);

    // Recalculate user and collective statuses after adding item
    // (No explicit user status added here, handled by updateUserItemStatus)

    // Emit socket event for real-time update (exclude sender)
    if (!checklist.is_personal) {
      emitToTrip(checklist.trip_id, 'checklistItem:created', { checklistId, item }, userId);
    }

    return res.status(201).json({
      message: 'Checklist item created successfully',
      item // Return the basic item details
    });
  } catch (error) {
    console.error('Create checklist item error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Update a checklist item
 */
const updateChecklistItem = (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { itemId } = req.params;
    const { description, note } = req.body; // Don't update status here directly
    const userId = req.user.id;

    // Check if item exists
    const item = db.prepare('SELECT * FROM checklist_items WHERE id = ?').get(itemId);
    if (!item) {
      return res.status(404).json({ message: 'Checklist item not found' });
    }

    const parentChecklist = db.prepare('SELECT * FROM checklists WHERE id = ?').get(item.checklist_id);
    if (!parentChecklist || !canManageChecklist(parentChecklist, userId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Update item description and note
    const update = db.prepare(`
      UPDATE checklist_items
      SET description = ?, note = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    update.run(
      description || item.description,
      note !== undefined ? note : item.note,
      userId, // Track who updated the description/note
      itemId
    );

    // Get updated item details including who last updated it
    const updatedItem = db.prepare(`
      SELECT ci.*, u.name as updated_by_name, u.profile_image as updated_by_image
      FROM checklist_items ci
      LEFT JOIN users u ON ci.updated_by = u.id
      WHERE ci.id = ?
    `).get(itemId);

    // Fetch user statuses and calculate completion (similar to getChecklist)
    const tripMembers = getChecklistAudience(parentChecklist).map(id => ({ user_id: id }));
    const userStatuses = db.prepare(`
        SELECT cus.*, u.name, u.profile_image
        FROM checklist_item_user_status cus
        JOIN users u ON cus.user_id = u.id
        WHERE cus.item_id = ?
    `).all(itemId);
    const currentUserStatus = db.prepare('SELECT status FROM checklist_item_user_status WHERE item_id = ? AND user_id = ?').get(itemId, userId);

    const totalMembers = tripMembers.length;
    const totalChecked = userStatuses.filter(s => s.status === 'checked').length;
    const totalSkipped = userStatuses.filter(s => s.status === 'skipped').length;
    const totalActioned = totalChecked + totalSkipped;
    const completionPercentage = totalMembers > 0 ? Math.round((totalActioned / totalMembers) * 100) : 0;


    return res.status(200).json({
      message: 'Checklist item updated successfully',
      item: {
        ...updatedItem,
        user_statuses: userStatuses,
        current_user_status: currentUserStatus ? currentUserStatus.status : 'pending',
        completion: {
          total_members: totalMembers,
          checked_count: totalChecked,
          skipped_count: totalSkipped,
          percentage: completionPercentage,
          is_complete: updatedItem.collective_status === 'complete'
        }
      }
    });
  } catch (error) {
    console.error('Update checklist item error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};


/**
 * Delete a checklist item
 */
const deleteChecklistItem = (req, res) => {
  try {
    const { itemId } = req.params;
    const userId = req.user.id;

    // Check if item exists
    const item = db.prepare('SELECT * FROM checklist_items WHERE id = ?').get(itemId);
    if (!item) {
      return res.status(404).json({ message: 'Checklist item not found' });
    }

    // Get checklist for trip_id and permission check
    const checklist = db.prepare('SELECT * FROM checklists WHERE id = ?').get(item.checklist_id);
    if (!checklist || !canManageChecklist(checklist, userId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Delete item (will cascade delete user statuses)
    db.prepare('DELETE FROM checklist_items WHERE id = ?').run(itemId);

    // Emit socket event for real-time update (exclude sender)
    if (!checklist.is_personal) {
      emitToTrip(checklist.trip_id, 'checklistItem:deleted', { checklistId: item.checklist_id, itemId }, userId);
    }

    return res.status(200).json({
      message: 'Checklist item deleted successfully'
    });
  } catch (error) {
    console.error('Delete checklist item error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getTripChecklists,
  getChecklist,
  updateUserItemStatus,
  createChecklist,
  updateChecklist,
  deleteChecklist,
  createChecklistItem,
  updateChecklistItem,
  deleteChecklistItem
};