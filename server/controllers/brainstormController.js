// server/controllers/brainstormController.js
const { db } = require('../db/database');
const fs = require('fs');
const path = require('path');

/**
 * Helper to check if user has edit access to an item's trip
 */
const checkItemEditAccess = (itemId, userId) => {
    const item = db.prepare('SELECT trip_id FROM brainstorm_items WHERE id = ?').get(itemId);
    if (!item) return { allowed: false, error: 'Item not found', status: 404 };

    const tripMember = db.prepare(`
    SELECT role FROM trip_members 
    WHERE trip_id = ? AND user_id = ?
  `).get(item.trip_id, userId);

    if (!tripMember || !['owner', 'editor'].includes(tripMember.role)) {
        return { allowed: false, error: 'Access denied', status: 403 };
    }

    return { allowed: true, tripId: item.trip_id };
};

/**
 * Get all brainstorm items for a trip
 */
const getBrainstormItems = async (req, res) => {
    try {
        const { tripId } = req.params;

        const items = db.prepare(`
      SELECT bi.*, u.name as creator_name, u.profile_image as creator_image
      FROM brainstorm_items bi
      LEFT JOIN users u ON bi.created_by = u.id
      WHERE bi.trip_id = ?
      ORDER BY bi.created_at DESC
    `).all(tripId);

        res.json({ items });
    } catch (error) {
        console.error('Error fetching brainstorm items:', error);
        res.status(500).json({ message: 'Failed to fetch brainstorm items' });
    }
};

/**
 * Get a single brainstorm item
 */
const getBrainstormItem = async (req, res) => {
    try {
        const { itemId } = req.params;

        const item = db.prepare(`
      SELECT bi.*, u.name as creator_name, u.profile_image as creator_image
      FROM brainstorm_items bi
      LEFT JOIN users u ON bi.created_by = u.id
      WHERE bi.id = ?
    `).get(itemId);

        if (!item) {
            return res.status(404).json({ message: 'Brainstorm item not found' });
        }

        res.json({ item });
    } catch (error) {
        console.error('Error fetching brainstorm item:', error);
        res.status(500).json({ message: 'Failed to fetch brainstorm item' });
    }
};

/**
 * Create a new brainstorm item
 */
const createBrainstormItem = async (req, res) => {
    try {
        const { tripId } = req.params;
        const userId = req.user.id;
        const {
            type,
            title,
            content,
            url,
            latitude,
            longitude,
            location_name,
            position_x,
            position_y,
            color,
            priority
        } = req.body;

        // Validate type
        const validTypes = ['place', 'note', 'image', 'link', 'idea'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({ message: 'Invalid item type' });
        }

        // Handle image upload if present
        let imagePath = null;
        if (req.file) {
            imagePath = `/uploads/${req.file.filename}`;
        }

        const result = db.prepare(`
      INSERT INTO brainstorm_items (
        trip_id, type, title, content, url, image_path,
        latitude, longitude, location_name,
        position_x, position_y, color, priority, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            tripId,
            type,
            title || null,
            content || null,
            url || null,
            imagePath,
            latitude || null,
            longitude || null,
            location_name || null,
            position_x || 100,
            position_y || 100,
            color || null,
            priority || 0,
            userId
        );

        const newItem = db.prepare(`
      SELECT bi.*, u.name as creator_name, u.profile_image as creator_image
      FROM brainstorm_items bi
      LEFT JOIN users u ON bi.created_by = u.id
      WHERE bi.id = ?
    `).get(result.lastInsertRowid);

        res.status(201).json({ item: newItem });
    } catch (error) {
        console.error('Error creating brainstorm item:', error);
        res.status(500).json({ message: 'Failed to create brainstorm item' });
    }
};

/**
 * Update a brainstorm item
 */
const updateBrainstormItem = async (req, res) => {
    try {
        const { itemId } = req.params;

        // Check edit access
        const access = checkItemEditAccess(itemId, req.user.id);
        if (!access.allowed) {
            return res.status(access.status).json({ message: access.error });
        }

        const {
            title,
            content,
            url,
            latitude,
            longitude,
            location_name,
            position_x,
            position_y,
            color,
            priority,
            remove_image
        } = req.body;

        // Get existing item
        const existingItem = db.prepare('SELECT * FROM brainstorm_items WHERE id = ?').get(itemId);
        if (!existingItem) {
            return res.status(404).json({ message: 'Brainstorm item not found' });
        }

        // Handle image
        let imagePath = existingItem.image_path;
        if (remove_image === 'true' && existingItem.image_path) {
            // Delete old image file
            const oldPath = path.join(__dirname, '..', existingItem.image_path);
            if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
            }
            imagePath = null;
        }
        if (req.file) {
            // Delete old image if exists
            if (existingItem.image_path) {
                const oldPath = path.join(__dirname, '..', existingItem.image_path);
                if (fs.existsSync(oldPath)) {
                    fs.unlinkSync(oldPath);
                }
            }
            imagePath = `/uploads/${req.file.filename}`;
        }

        db.prepare(`
      UPDATE brainstorm_items SET
        title = COALESCE(?, title),
        content = COALESCE(?, content),
        url = COALESCE(?, url),
        image_path = ?,
        latitude = COALESCE(?, latitude),
        longitude = COALESCE(?, longitude),
        location_name = COALESCE(?, location_name),
        position_x = COALESCE(?, position_x),
        position_y = COALESCE(?, position_y),
        color = COALESCE(?, color),
        priority = COALESCE(?, priority),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
            title,
            content,
            url,
            imagePath,
            latitude,
            longitude,
            location_name,
            position_x,
            position_y,
            color,
            priority,
            itemId
        );

        const updatedItem = db.prepare(`
      SELECT bi.*, u.name as creator_name, u.profile_image as creator_image
      FROM brainstorm_items bi
      LEFT JOIN users u ON bi.created_by = u.id
      WHERE bi.id = ?
    `).get(itemId);

        res.json({ item: updatedItem });
    } catch (error) {
        console.error('Error updating brainstorm item:', error);
        res.status(500).json({ message: 'Failed to update brainstorm item' });
    }
};

/**
 * Update item position (for drag and drop on canvas)
 */
const updateItemPosition = async (req, res) => {
    try {
        const { itemId } = req.params;
        const { position_x, position_y } = req.body;

        // Check edit access
        const access = checkItemEditAccess(itemId, req.user.id);
        if (!access.allowed) {
            return res.status(access.status).json({ message: access.error });
        }

        db.prepare(`
      UPDATE brainstorm_items SET
        position_x = ?,
        position_y = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(position_x, position_y, itemId);

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating item position:', error);
        res.status(500).json({ message: 'Failed to update item position' });
    }
};

/**
 * Batch update positions (for multiple items moved)
 */
const batchUpdatePositions = async (req, res) => {
    try {
        const { positions } = req.body; // Array of { id, position_x, position_y }

        const updateStmt = db.prepare(`
      UPDATE brainstorm_items SET
        position_x = ?,
        position_y = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

        const updateMany = db.transaction((items) => {
            for (const item of items) {
                updateStmt.run(item.position_x, item.position_y, item.id);
            }
        });

        updateMany(positions);

        res.json({ success: true });
    } catch (error) {
        console.error('Error batch updating positions:', error);
        res.status(500).json({ message: 'Failed to update positions' });
    }
};

/**
 * Delete a brainstorm item
 */
const deleteBrainstormItem = async (req, res) => {
    try {
        const { itemId } = req.params;

        // Check edit access
        const access = checkItemEditAccess(itemId, req.user.id);
        if (!access.allowed) {
            return res.status(access.status).json({ message: access.error });
        }

        // Get item to delete image if exists
        const item = db.prepare('SELECT * FROM brainstorm_items WHERE id = ?').get(itemId);
        if (!item) {
            return res.status(404).json({ message: 'Brainstorm item not found' });
        }

        // Delete image file if exists
        if (item.image_path) {
            const imagePath = path.join(__dirname, '..', item.image_path);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }

        db.prepare('DELETE FROM brainstorm_items WHERE id = ?').run(itemId);

        res.json({ message: 'Brainstorm item deleted successfully' });
    } catch (error) {
        console.error('Error deleting brainstorm item:', error);
        res.status(500).json({ message: 'Failed to delete brainstorm item' });
    }
};

/**
 * Get brainstorm items for public view (by trip public token)
 */
const getPublicBrainstormItems = async (req, res) => {
    try {
        const { token } = req.params;

        // Find trip by public share token
        const trip = db.prepare('SELECT id FROM trips WHERE public_share_token = ?').get(token);
        if (!trip) {
            return res.status(404).json({ message: 'Trip not found or not shared publicly' });
        }

        const items = db.prepare(`
      SELECT bi.*, u.name as creator_name, u.profile_image as creator_image
      FROM brainstorm_items bi
      LEFT JOIN users u ON bi.created_by = u.id
      WHERE bi.trip_id = ?
      ORDER BY bi.created_at DESC
    `).all(trip.id);

        res.json({ items });
    } catch (error) {
        console.error('Error fetching public brainstorm items:', error);
        res.status(500).json({ message: 'Failed to fetch brainstorm items' });
    }
};

/**
 * Get all brainstorm groups for a trip
 */
const getBrainstormGroups = async (req, res) => {
    try {
        const { tripId } = req.params;

        const groups = db.prepare(`
      SELECT bg.*
      FROM brainstorm_groups bg
      WHERE bg.trip_id = ?
      ORDER BY bg.created_at ASC
    `).all(tripId);

        res.json({ groups });
    } catch (error) {
        console.error('Error fetching brainstorm groups:', error);
        res.status(500).json({ message: 'Failed to fetch brainstorm groups' });
    }
};

/**
 * Create a new brainstorm group
 */
const createBrainstormGroup = async (req, res) => {
    try {
        const { tripId } = req.params;
        const userId = req.user.id;
        const {
            title,
            color,
            position_x,
            position_y,
            width,
            height
        } = req.body;

        const result = db.prepare(`
      INSERT INTO brainstorm_groups (
        trip_id, title, color, position_x, position_y, width, height, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            tripId,
            title || 'New Group',
            color || '#e5e7eb',
            position_x || 100,
            position_y || 100,
            width || 300,
            height || 300,
            userId
        );

        const newGroup = db.prepare(`
      SELECT * FROM brainstorm_groups WHERE id = ?
    `).get(result.lastInsertRowid);

        res.status(201).json({ group: newGroup });
    } catch (error) {
        console.error('Error creating brainstorm group:', error);
        res.status(500).json({ message: 'Failed to create brainstorm group' });
    }
};

/**
 * Update a brainstorm group
 */
const updateBrainstormGroup = async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = req.user.id;

        // Verify group exists
        const group = db.prepare('SELECT * FROM brainstorm_groups WHERE id = ?').get(groupId);
        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        // Check edit access
        const access = checkItemEditAccess(group.id, userId); // Reusing checkItemEditAccess logic requires slight adjustment or check trip ID directly
        // checkItemEditAccess queries 'brainstorm_items'. We need to check 'brainstorm_groups' or just use the trip_id.

        // Let's do a direct check for trip access since group logic is similar
        const tripMember = db.prepare(`
            SELECT role FROM trip_members 
            WHERE trip_id = ? AND user_id = ?
        `).get(group.trip_id, userId);

        if (!tripMember || !['owner', 'editor'].includes(tripMember.role)) {
            return res.status(403).json({ message: 'Access denied' });
        }


        const {
            title,
            color,
            position_x,
            position_y,
            width,
            height
        } = req.body;

        db.prepare(`
      UPDATE brainstorm_groups SET
        title = COALESCE(?, title),
        color = COALESCE(?, color),
        position_x = COALESCE(?, position_x),
        position_y = COALESCE(?, position_y),
        width = COALESCE(?, width),
        height = COALESCE(?, height),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
            title,
            color,
            position_x,
            position_y,
            width,
            height,
            groupId
        );

        const updatedGroup = db.prepare(`
      SELECT * FROM brainstorm_groups WHERE id = ?
    `).get(groupId);

        res.json({ group: updatedGroup });
    } catch (error) {
        console.error('Error updating brainstorm group:', error);
        res.status(500).json({ message: 'Failed to update brainstorm group' });
    }
};

/**
 * Delete a brainstorm group
 */
const deleteBrainstormGroup = async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = req.user.id;

        const group = db.prepare('SELECT * FROM brainstorm_groups WHERE id = ?').get(groupId);
        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        // Check edit access
        const tripMember = db.prepare(`
            SELECT role FROM trip_members 
            WHERE trip_id = ? AND user_id = ?
        `).get(group.trip_id, userId);

        if (!tripMember || !['owner', 'editor'].includes(tripMember.role)) {
            return res.status(403).json({ message: 'Access denied' });
        }

        db.prepare('DELETE FROM brainstorm_groups WHERE id = ?').run(groupId);

        res.json({ message: 'Group deleted successfully' });
    } catch (error) {
        console.error('Error deleting brainstorm group:', error);
        res.status(500).json({ message: 'Failed to delete brainstorm group' });
    }
};

module.exports = {
    getBrainstormItems,
    getBrainstormItem,
    createBrainstormItem,
    updateBrainstormItem,
    updateItemPosition,
    batchUpdatePositions,
    deleteBrainstormItem,
    getPublicBrainstormItems,
    getBrainstormGroups,
    createBrainstormGroup,
    updateBrainstormGroup,
    deleteBrainstormGroup
};
