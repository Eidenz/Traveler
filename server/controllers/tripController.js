// server/controllers/tripController.js
const { db } = require('../db/database');
const { validationResult } = require('express-validator');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { generateTripId, isValidTripId } = require('../utils/idGenerator');
const { sendEmail } = require('../utils/emailService'); // Added
const { getRate, isValidCode } = require('../utils/currencyService');
const { computeSettlement } = require('./budgetController');

// Helper function to get user details
const getUserById = (userId) => {
  return db.prepare('SELECT id, name, email, profile_image, receiveEmails FROM users WHERE id = ?').get(userId);
};

/**
 * Get all trips for the current user
 */
const getUserTrips = (req, res) => {
  try {
    const userId = req.user.id;

    // Get all trips where user is a member
    const trips = db.prepare(`
      SELECT t.*, tm.role
      FROM trips t
      JOIN trip_members tm ON t.id = tm.trip_id
      WHERE tm.user_id = ?
      ORDER BY t.start_date DESC
    `).all(userId);

    return res.status(200).json({ trips });
  } catch (error) {
    console.error('Get user trips error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Get a single trip by ID
 */
const getTripById = (req, res) => {
  try {
    const { tripId } = req.params;

    // Get basic trip info
    const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    // Get trip members
    const members = db.prepare(`
      SELECT u.id, u.name, u.email, u.profile_image, tm.role
      FROM trip_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.trip_id = ?
    `).all(tripId);

    const userId = req.user.id;

    // Get transportation
    const transportation = db.prepare(`
      SELECT t.*,
        (SELECT COUNT(*) FROM documents d WHERE d.reference_type = 'transportation' AND d.reference_id = t.id AND (d.is_personal = 0 OR d.is_personal IS NULL OR d.uploaded_by = ?)) as has_documents
      FROM transportation t
      WHERE t.trip_id = ?
      ORDER BY t.departure_date, COALESCE(NULLIF(t.departure_time_exact, ''), t.departure_time)
    `).all(userId, tripId);

    // Get lodging
    const lodging = db.prepare(`
      SELECT l.*,
        (SELECT COUNT(*) FROM documents d WHERE d.reference_type = 'lodging' AND d.reference_id = l.id AND (d.is_personal = 0 OR d.is_personal IS NULL OR d.uploaded_by = ?)) as has_documents
      FROM lodging l
      WHERE l.trip_id = ?
      ORDER BY l.check_in
    `).all(userId, tripId);

    // Get activities
    const activities = db.prepare(`
      SELECT a.*,
        (SELECT COUNT(*) FROM documents d WHERE d.reference_type = 'activity' AND d.reference_id = a.id AND (d.is_personal = 0 OR d.is_personal IS NULL OR d.uploaded_by = ?)) as has_documents
      FROM activities a
      WHERE a.trip_id = ?
      ORDER BY a.date, COALESCE(NULLIF(a.time_exact, ''), a.time)
    `).all(userId, tripId);

    return res.status(200).json({
      trip,
      members,
      transportation,
      lodging,
      activities
    });
  } catch (error) {
    console.error('Get trip error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Create a new trip with a random ID
 */
const createTrip = (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, location, start_date, end_date } = req.body;
    const userId = req.user.id;

    let coverImage = null;
    if (req.file) {
      coverImage = `/uploads/trips/${req.file.filename}`;
    }

    // Start a transaction
    db.prepare('BEGIN TRANSACTION').run();

    try {
      // Generate a random trip ID
      const tripId = generateTripId();

      // Insert trip with the random ID
      const insertTrip = db.prepare(`
        INSERT INTO trips (id, name, description, location, start_date, end_date, cover_image, owner_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insertTrip.run(tripId, name, description, location, start_date, end_date, coverImage, userId);

      // Add user as owner in trip_members
      const insertMember = db.prepare(`
        INSERT INTO trip_members (trip_id, user_id, role)
        VALUES (?, ?, ?)
      `);
      insertMember.run(tripId, userId, 'owner');

      // Commit transaction
      db.prepare('COMMIT').run();

      // Get the created trip
      const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId);

      return res.status(201).json({
        message: 'Trip created successfully',
        trip
      });
    } catch (error) {
      // Rollback on error
      db.prepare('ROLLBACK').run();
      throw error;
    }
  } catch (error) {
    console.error('Create trip error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Update a trip
 */
const updateTrip = (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { tripId } = req.params;
    const { name, description, location, start_date, end_date, photo_album_url } = req.body;

    // Get current trip
    const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    // Photo album link: http(s) only — it is rendered as an href, so a
    // javascript: URL here would be stored XSS (same rule as link documents).
    // Absent field keeps the current value; empty string clears it.
    let albumUrl = trip.photo_album_url;
    if (photo_album_url !== undefined) {
      const trimmed = String(photo_album_url).trim();
      if (trimmed === '') {
        albumUrl = null;
      } else {
        try {
          const parsed = new URL(trimmed);
          if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('bad protocol');
          albumUrl = trimmed;
        } catch {
          return res.status(400).json({ message: 'Photo album link must be a valid http(s) URL' });
        }
      }
    }

    // Handle cover image
    let coverImage = trip.cover_image;
    if (req.file) {
      // Delete old image if exists and not the default
      if (trip.cover_image && !trip.cover_image.includes('default')) {
        const oldImagePath = path.join(__dirname, '..', trip.cover_image);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      coverImage = `/uploads/trips/${req.file.filename}`;
    }

    // Update trip
    const updateTrip = db.prepare(`
      UPDATE trips
      SET name = ?, description = ?, location = ?, start_date = ?, end_date = ?, cover_image = ?, photo_album_url = ?
      WHERE id = ?
    `);

    updateTrip.run(name, description, location, start_date, end_date, coverImage, albumUrl, tripId);

    // Get updated trip
    const updatedTrip = db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId);

    return res.status(200).json({
      message: 'Trip updated successfully',
      trip: updatedTrip
    });
  } catch (error) {
    console.error('Update trip error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Archive / unarchive a trip. Archived trips are hidden from default lists
 * and skip reminder emails but stay fully editable.
 */
const setTripArchived = (req, res) => {
  try {
    const { tripId } = req.params;
    const archived = req.body.archived === true || req.body.archived === 'true';

    const trip = db.prepare('SELECT id FROM trips WHERE id = ?').get(tripId);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    db.prepare('UPDATE trips SET archived_at = ? WHERE id = ?')
      .run(archived ? new Date().toISOString() : null, tripId);

    const updatedTrip = db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId);
    return res.status(200).json({
      message: archived ? 'Trip archived' : 'Trip unarchived',
      trip: updatedTrip
    });
  } catch (error) {
    console.error('Archive trip error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Aggregate recap for a trip: itinerary stats, distance, money, artifacts.
 * Shared sections are identical for every member; the `personal` section is
 * computed for the requester only (their expenses + their shared splits).
 */
const EARTH_RADIUS_KM = 6371;
const haversineKm = (lat1, lon1, lat2, lon2) => {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
};

const getTripRecap = async (req, res) => {
  try {
    const { tripId } = req.params;
    const userId = req.user.id;

    const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    const members = db.prepare(`
      SELECT u.id, u.name, u.profile_image, tm.role
      FROM trip_members tm JOIN users u ON tm.user_id = u.id
      WHERE tm.trip_id = ?
    `).all(tripId);

    const activities = db.prepare('SELECT * FROM activities WHERE trip_id = ?').all(tripId);
    const transports = db.prepare('SELECT * FROM transportation WHERE trip_id = ?').all(tripId);
    const lodgings = db.prepare('SELECT COUNT(*) as c FROM lodging WHERE trip_id = ?').get(tripId).c;
    const documents = db.prepare(`
      SELECT COUNT(*) as c FROM documents
      WHERE trip_id = ? AND (is_personal = 0 OR is_personal IS NULL OR uploaded_by = ?)
    `).get(tripId, userId).c;
    const brainstormItems = db.prepare('SELECT COUNT(*) as c FROM brainstorm_items WHERE trip_id = ?').get(tripId).c;
    const brainstormGroups = db.prepare('SELECT COUNT(*) as c FROM brainstorm_groups WHERE trip_id = ?').get(tripId).c;

    // Checklist completion (shared lists, collective status)
    const checklist = db.prepare(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN ci.collective_status = 'complete' THEN 1 ELSE 0 END) as completed
      FROM checklist_items ci
      JOIN checklists c ON c.id = ci.checklist_id
      WHERE c.trip_id = ? AND (c.is_personal = 0 OR c.is_personal IS NULL)
    `).get(tripId);

    // Transport breakdown + distance over legs with full coordinates
    const transportTypes = {};
    let distanceKm = 0;
    for (const t of transports) {
      transportTypes[t.type] = (transportTypes[t.type] || 0) + 1;
      if (t.from_latitude != null && t.from_longitude != null &&
          t.to_latitude != null && t.to_longitude != null) {
        distanceKm += haversineKm(t.from_latitude, t.from_longitude, t.to_latitude, t.to_longitude);
      }
    }

    // Distinct visited places (activity locations; coordinates are not
    // stored — the client map geocodes at render time)
    const seen = new Set();
    const places = [];
    for (const a of activities) {
      const name = (a.location || '').trim();
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      places.push({ name });
    }

    // Shared money: totals + per-viewer home conversion + settlement state
    const sharedBudget = db.prepare('SELECT * FROM budgets WHERE trip_id = ?').get(tripId);
    let shared = null;
    if (sharedBudget) {
      const categoryTotals = {};
      db.prepare('SELECT category, SUM(amount) as total FROM expenses WHERE budget_id = ? GROUP BY category')
        .all(sharedBudget.id)
        .forEach((r) => { categoryTotals[r.category] = r.total; });
      const totalSpent = Object.values(categoryTotals).reduce((a, b) => a + b, 0);

      const profileHome = db.prepare('SELECT home_currency_code FROM users WHERE id = ?')
        .get(userId)?.home_currency_code;
      const homeCode = isValidCode(profileHome) ? profileHome : sharedBudget.home_currency_code;
      let conversion = null;
      if (isValidCode(sharedBudget.currency_code) && isValidCode(homeCode)
          && sharedBudget.currency_code !== homeCode) {
        const rate = await getRate(sharedBudget.currency_code, homeCode);
        if (rate) conversion = { home_currency_code: homeCode, rate: rate.rate };
      }

      const settlement = computeSettlement(tripId);
      shared = {
        currency: sharedBudget.currency || '$',
        currency_code: sharedBudget.currency_code || null,
        total_amount: sharedBudget.total_amount,
        total_spent: Math.round(totalSpent * 100) / 100,
        category_totals: categoryTotals,
        conversion,
        settlement: {
          settled: settlement.transfers.length === 0,
          remaining: settlement.progress.remaining,
          ratio: settlement.progress.ratio,
        },
      };
    }

    // Private per-requester money: personal expenses (converted into the
    // personal budget's trip currency) + their share of shared expenses
    let personal = null;
    const personalBudget = db.prepare('SELECT * FROM personal_budgets WHERE trip_id = ? AND user_id = ?')
      .get(tripId, userId);
    {
      const pExpenses = personalBudget
        ? db.prepare('SELECT * FROM personal_expenses WHERE personal_budget_id = ?').all(personalBudget.id)
        : [];

      const tripCode = personalBudget?.currency_code || sharedBudget?.currency_code || null;
      const profileHome = db.prepare('SELECT home_currency_code FROM users WHERE id = ?')
        .get(userId)?.home_currency_code;
      const homeCode = isValidCode(profileHome) ? profileHome : sharedBudget?.home_currency_code;
      let rate = null;
      if (isValidCode(tripCode) && isValidCode(homeCode) && tripCode !== homeCode) {
        rate = (await getRate(tripCode, homeCode))?.rate ?? null;
      }
      const toTrip = (amount, code) => {
        const c = code || tripCode;
        if (!c || !tripCode || c === tripCode) return amount;
        if (rate && c === homeCode) return amount / rate;
        return amount;
      };

      let personalSpent = 0;
      for (const e of pExpenses) personalSpent += toTrip(e.amount, e.currency_code);

      let sharesTotal = 0;
      if (sharedBudget) {
        const rows = db.prepare(`
          SELECT e.amount, (SELECT COUNT(*) FROM expense_splits s2 WHERE s2.expense_id = e.id) as parts
          FROM expenses e
          JOIN expense_splits s ON s.expense_id = e.id
          WHERE e.budget_id = ? AND e.paid_by IS NOT NULL AND s.user_id = ?
        `).all(sharedBudget.id, userId);
        for (const r of rows) {
          if (r.parts > 0) sharesTotal += toTrip(r.amount / r.parts, sharedBudget.currency_code);
        }
      }

      const total = personalSpent + sharesTotal;
      if (total > 0 || personalBudget) {
        personal = {
          currency_code: tripCode,
          personal_spent: Math.round(personalSpent * 100) / 100,
          shares_total: Math.round(sharesTotal * 100) / 100,
          total: Math.round(total * 100) / 100,
          home: rate ? {
            currency_code: homeCode,
            total: Math.round(total * rate * 100) / 100,
          } : null,
        };
      }
    }

    const days = Math.round(
      (new Date(trip.end_date) - new Date(trip.start_date)) / 86400000
    ) + 1;

    return res.status(200).json({
      trip: {
        id: trip.id,
        name: trip.name,
        description: trip.description,
        location: trip.location,
        start_date: trip.start_date,
        end_date: trip.end_date,
        cover_image: trip.cover_image,
        photo_album_url: trip.photo_album_url,
        archived_at: trip.archived_at,
      },
      members,
      days,
      counts: {
        activities: activities.length,
        transports: transports.length,
        lodgings,
        documents,
        brainstorm_items: brainstormItems,
        brainstorm_groups: brainstormGroups,
      },
      transport_types: transportTypes,
      distance_km: Math.round(distanceKm),
      places,
      checklist: {
        total: checklist.total || 0,
        completed: checklist.completed || 0,
      },
      shared,
      personal,
    });
  } catch (error) {
    console.error('Get trip recap error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Delete a trip
 */

const deleteTrip = (req, res) => {
  try {
    const { tripId } = req.params;

    // Get current trip
    const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    // Start transaction
    db.prepare('BEGIN TRANSACTION').run();

    try {
      // Delete trip documents
      const tripDocs = db.prepare('SELECT * FROM documents WHERE reference_type = ? AND reference_id = ?').all('trip', tripId);
      const transportDocs = db.prepare(`
        SELECT d.* FROM documents d
        JOIN transportation t ON d.reference_id = t.id
        WHERE d.reference_type = 'transportation' AND t.trip_id = ?
      `).all(tripId);
      const lodgingDocs = db.prepare(`
        SELECT d.* FROM documents d
        JOIN lodging l ON d.reference_id = l.id
        WHERE d.reference_type = 'lodging' AND l.trip_id = ?
      `).all(tripId);
      const activityDocs = db.prepare(`
        SELECT d.* FROM documents d
        JOIN activities a ON d.reference_id = a.id
        WHERE d.reference_type = 'activity' AND a.trip_id = ?
      `).all(tripId);

      const allDocs = [...tripDocs, ...transportDocs, ...lodgingDocs, ...activityDocs];

      // Delete document files
      allDocs.forEach(doc => {
        try {
          const filePath = path.join(__dirname, '..', doc.file_path);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (err) {
          console.error(`Error deleting file: ${doc.file_path}`, err);
        }
      });

      // Delete cover image
      if (trip.cover_image && !trip.cover_image.includes('default')) {
        try {
          const coverPath = path.join(__dirname, '..', trip.cover_image);
          if (fs.existsSync(coverPath)) {
            fs.unlinkSync(coverPath);
          }
        } catch (err) {
          console.error(`Error deleting cover image: ${trip.cover_image}`, err);
        }
      }

      // Delete trip (cascades to transportation, lodging, activities, trip_members)
      db.prepare('DELETE FROM trips WHERE id = ?').run(tripId);

      // Commit transaction
      db.prepare('COMMIT').run();

      return res.status(200).json({
        message: 'Trip deleted successfully'
      });
    } catch (error) {
      // Rollback on error
      db.prepare('ROLLBACK').run();
      throw error;
    }
  } catch (error) {
    console.error('Delete trip error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Share a trip with another user
 */
const shareTrip = (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { tripId } = req.params;
    const { email, role } = req.body;
    const ownerId = req.user.id;

    // Validate role
    if (!['editor', 'viewer'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role. Must be editor or viewer.' });
    }

    // Find user by email
    const userToShareWith = getUserById(db.prepare('SELECT id FROM users WHERE email = ?').get(email)?.id);
    if (!userToShareWith) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Cannot share with self
    if (userToShareWith.id === ownerId) {
      return res.status(400).json({ message: 'Cannot share trip with yourself.' });
    }

    // Check if trip exists
    const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    // Get owner details
    const owner = getUserById(ownerId);

    // Check if user is already a member of this trip
    const existingMember = db.prepare('SELECT * FROM trip_members WHERE trip_id = ? AND user_id = ?')
      .get(tripId, userToShareWith.id);

    let message = '';
    if (existingMember) {
      // Update role if user is already a member
      db.prepare('UPDATE trip_members SET role = ? WHERE trip_id = ? AND user_id = ?')
        .run(role, tripId, userToShareWith.id);
      message = `User's role updated to ${role}`;
    } else {
      // Add user as a member
      db.prepare('INSERT INTO trip_members (trip_id, user_id, role) VALUES (?, ?, ?)')
        .run(tripId, userToShareWith.id, role);
      message = `Trip shared with ${userToShareWith.name}`;
    }

    // Send invitation email if user allows emails
    if (userToShareWith.receiveEmails) {
      const emailData = {
        userName: userToShareWith.name,
        userEmail: userToShareWith.email,
        ownerName: owner.name,
        ownerAvatar: owner.profile_image ? `${process.env.FRONTEND_URL}${owner.profile_image}` : 'https://example.com/default-avatar.png', // Replace with actual default
        tripName: trip.name,
        tripDestination: trip.location || 'Unknown Destination',
        tripImage: trip.cover_image ? `${process.env.FRONTEND_URL}${trip.cover_image}` : 'https://example.com/default-trip.png', // Replace with actual default
        tripStartDate: new Date(trip.start_date).toLocaleDateString(),
        tripEndDate: new Date(trip.end_date).toLocaleDateString(),
        accessLevel: role.charAt(0).toUpperCase() + role.slice(1),
        accessDescription: role === 'editor' ? 'Can edit trip details' : 'Can only view trip details',
        tripLink: `${process.env.FRONTEND_URL}/trips/${tripId}`,
        privacyLink: `${process.env.FRONTEND_URL}/privacy`,
        termsLink: `${process.env.FRONTEND_URL}/terms`,
        unsubscribeLink: `${process.env.FRONTEND_URL}/unsubscribe`,
        facebookLink: 'https://facebook.com',
        twitterLink: 'https://twitter.com',
        instagramLink: 'https://instagram.com'
      };

      sendEmail(
        userToShareWith.email,
        `${owner.name} shared the trip "${trip.name}" with you!`,
        'trip-invitation-template',
        emailData
      );
    }

    return res.status(200).json({ message });
  } catch (error) {
    console.error('Share trip error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Remove a user from a trip
 */
const removeTripMember = (req, res) => {
  try {
    const { tripId, userId } = req.params;

    // Check if trip exists
    const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    // Cannot remove the owner
    const member = db.prepare('SELECT * FROM trip_members WHERE trip_id = ? AND user_id = ?')
      .get(tripId, userId);

    if (!member) {
      return res.status(404).json({ message: 'User is not a member of this trip' });
    }

    if (member.role === 'owner') {
      return res.status(403).json({ message: 'Cannot remove the owner of the trip' });
    }

    // Remove member
    db.prepare('DELETE FROM trip_members WHERE trip_id = ? AND user_id = ?')
      .run(tripId, userId);

    return res.status(200).json({
      message: 'User removed from trip'
    });
  } catch (error) {
    console.error('Remove trip member error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Update a trip member's role
 */
const updateMemberRole = (req, res) => {
  try {
    const { tripId, userId } = req.params;
    const { role } = req.body;

    // Validate role
    if (!['editor', 'viewer'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role. Must be editor or viewer.' });
    }

    // Check if trip exists
    const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    // Check if member exists
    const member = db.prepare('SELECT * FROM trip_members WHERE trip_id = ? AND user_id = ?')
      .get(tripId, userId);

    if (!member) {
      return res.status(404).json({ message: 'User is not a member of this trip' });
    }

    // Cannot change owner's role
    if (member.role === 'owner') {
      return res.status(403).json({ message: 'Cannot change the role of the trip owner' });
    }

    // Update role
    db.prepare('UPDATE trip_members SET role = ? WHERE trip_id = ? AND user_id = ?')
      .run(role, tripId, userId);

    return res.status(200).json({
      message: `Member role updated to ${role}`
    });
  } catch (error) {
    console.error('Update member role error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Generate a public share token for a trip (owner only)
 */
const generatePublicShareToken = (req, res) => {
  try {
    const { tripId } = req.params;

    // Check if trip exists
    const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    // Generate a new token
    const token = crypto.randomBytes(32).toString('hex');

    // Update trip with the token
    db.prepare('UPDATE trips SET public_share_token = ? WHERE id = ?')
      .run(token, tripId);

    return res.status(200).json({
      message: 'Public share link created',
      token
    });
  } catch (error) {
    console.error('Generate public share token error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Revoke the public share token for a trip (owner only)
 */
const revokePublicShareToken = (req, res) => {
  try {
    const { tripId } = req.params;

    // Check if trip exists
    const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    // Remove the token
    db.prepare('UPDATE trips SET public_share_token = NULL WHERE id = ?')
      .run(tripId);

    return res.status(200).json({
      message: 'Public share link revoked'
    });
  } catch (error) {
    console.error('Revoke public share token error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Get trip data by public share token (no auth required)
 * Filters sensitive information like confirmation codes and documents
 */
const getTripByPublicToken = (req, res) => {
  try {
    const { token } = req.params;

    if (!token || token.length !== 64) {
      return res.status(400).json({ message: 'Invalid share token' });
    }

    // Find trip by token
    const trip = db.prepare('SELECT * FROM trips WHERE public_share_token = ?').get(token);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found or link has expired' });
    }

    // Remove sensitive fields from trip
    const publicTrip = {
      id: trip.id,
      name: trip.name,
      description: trip.description,
      location: trip.location,
      start_date: trip.start_date,
      end_date: trip.end_date,
      cover_image: trip.cover_image,
      is_brainstorm_public: trip.is_brainstorm_public
    };

    // Get trip members (without email for privacy)
    const members = db.prepare(`
      SELECT u.id, u.name, u.profile_image, tm.role
      FROM trip_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.trip_id = ?
    `).all(trip.id);

    // Get transportation (without confirmation codes)
    const transportation = db.prepare(`
      SELECT id, trip_id, type, company, from_location, to_location, 
             departure_date, departure_time, departure_time_exact,
             arrival_date, arrival_time, arrival_time_exact,
             notes, banner_image
      FROM transportation
      WHERE trip_id = ?
      ORDER BY departure_date, COALESCE(NULLIF(departure_time_exact, ''), departure_time)
    `).all(trip.id);

    // Get lodging (without confirmation codes)
    const lodging = db.prepare(`
      SELECT id, trip_id, name, address, check_in, check_out, 
             notes, banner_image
      FROM lodging
      WHERE trip_id = ?
      ORDER BY check_in
    `).all(trip.id);

    // Get activities (without confirmation codes)
    const activities = db.prepare(`
      SELECT id, trip_id, name, date, time, time_exact, location, 
             notes, banner_image
      FROM activities
      WHERE trip_id = ?
      ORDER BY date, COALESCE(NULLIF(time_exact, ''), time)
    `).all(trip.id);

    return res.status(200).json({
      trip: publicTrip,
      members,
      transportation,
      lodging,
      activities,
      brainstorm_items: trip.is_brainstorm_public ? db.prepare('SELECT * FROM brainstorm_items WHERE trip_id = ?').all(trip.id) : []
    });
  } catch (error) {
    console.error('Get trip by public token error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};



/**
 * Toggle public access to brainstorming page
 */
const toggleBrainstormPublic = (req, res) => {
  try {
    const { tripId } = req.params;
    const { isPublic } = req.body;

    const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    db.prepare('UPDATE trips SET is_brainstorm_public = ? WHERE id = ?')
      .run(isPublic ? 1 : 0, tripId);

    return res.status(200).json({
      message: `Brainstorming page is now ${isPublic ? 'public' : 'private'}`
    });
  } catch (error) {
    console.error('Toggle brainstorm public error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  setTripArchived,
  getTripRecap,
  getUserTrips,
  getTripById,
  createTrip,
  updateTrip,
  deleteTrip,
  shareTrip,
  removeTripMember,
  updateMemberRole,
  generatePublicShareToken,
  revokePublicShareToken,
  getTripByPublicToken,
  toggleBrainstormPublic,
  getUserById
};
