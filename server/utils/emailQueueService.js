// server/utils/emailQueueService.js
const { db } = require('../db/database');
const { sendEmail } = require('./emailService');

// Queue duration in milliseconds (default: 1 hour)
const QUEUE_DURATION_MS = parseInt(process.env.EMAIL_QUEUE_DURATION_MS) || 60 * 60 * 1000;

// Minimum interval between queue processing runs (default: 5 minutes)
const PROCESS_INTERVAL_MS = parseInt(process.env.EMAIL_PROCESS_INTERVAL_MS) || 5 * 60 * 1000;

/**
 * Initialize the email queue table
 */
const initializeEmailQueue = () => {
    try {
        db.exec(`
      CREATE TABLE IF NOT EXISTS email_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trip_id TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        updater_id INTEGER NOT NULL,
        update_type TEXT NOT NULL CHECK(update_type IN ('activity', 'transportation', 'lodging', 'checklist')),
        update_data TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (trip_id) REFERENCES trips (id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (updater_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

        // Create index for faster querying
        db.exec(`
      CREATE INDEX IF NOT EXISTS idx_email_queue_created_at ON email_queue(created_at)
    `);

        console.log('Email queue table initialized');
    } catch (error) {
        console.error('Error initializing email queue table:', error);
    }
};

/**
 * Queue an email notification for later delivery
 * @param {string} tripId - The trip ID
 * @param {number} userId - The recipient user ID
 * @param {number} updaterId - The user who made the update
 * @param {string} updateType - Type of update (activity, transportation, lodging, checklist)
 * @param {object} updateData - The update details
 */
const queueEmailNotification = (tripId, userId, updaterId, updateType, updateData) => {
    try {
        const insert = db.prepare(`
      INSERT INTO email_queue (trip_id, user_id, updater_id, update_type, update_data)
      VALUES (?, ?, ?, ?, ?)
    `);

        insert.run(tripId, userId, updaterId, updateType, JSON.stringify(updateData));
        console.log(`Queued ${updateType} notification for user ${userId} on trip ${tripId}`);
    } catch (error) {
        console.error('Error queuing email notification:', error);
    }
};

/**
 * Queue notifications for all trip members (excluding the updater)
 * @param {string} tripId - The trip ID
 * @param {number} updaterId - The user who made the update
 * @param {string} updateType - Type of update
 * @param {object} updateData - The update details
 * @param {object} tripInfo - Trip information (name, location)
 */
const queueNotificationsForTripMembers = (tripId, updaterId, updateType, updateData, tripInfo) => {
    try {
        // Get trip members who should receive notifications (excluding updater)
        const membersToNotify = db.prepare(`
      SELECT u.id, u.name, u.email, u.profile_image, u.receiveEmails
      FROM users u
      JOIN trip_members tm ON u.id = tm.user_id
      WHERE tm.trip_id = ? AND u.id != ? AND u.receiveEmails = 1
    `).all(tripId, updaterId);

        // Add trip info to update data
        const enrichedData = {
            ...updateData,
            tripName: tripInfo.name,
            tripDestination: tripInfo.location || 'Unknown Destination',
            tripLink: `${process.env.FRONTEND_URL}/trips/${tripId}`
        };

        // Queue notification for each member
        membersToNotify.forEach(member => {
            queueEmailNotification(tripId, member.id, updaterId, updateType, enrichedData);
        });

        return membersToNotify.length;
    } catch (error) {
        console.error('Error queuing notifications for trip members:', error);
        return 0;
    }
};

/**
 * Get pending notifications that are ready to be sent
 * Groups notifications by user and trip
 * @returns {Array} Grouped notifications ready to be processed
 */
const getPendingNotifications = () => {
    try {
        const cutoffTime = new Date(Date.now() - QUEUE_DURATION_MS).toISOString();

        // Get all notifications for users that have at least one notification older than the queue duration
        // This ensures we don't send partial batches
        const usersWithOldNotifications = db.prepare(`
      SELECT DISTINCT user_id, trip_id
      FROM email_queue
      WHERE created_at <= ?
    `).all(cutoffTime);

        if (usersWithOldNotifications.length === 0) {
            return [];
        }

        const groupedNotifications = [];

        for (const { user_id, trip_id } of usersWithOldNotifications) {
            // Get all notifications for this user/trip combination
            const notifications = db.prepare(`
        SELECT eq.*, 
               u.name as recipient_name, 
               u.email as recipient_email,
               updater.name as updater_name,
               updater.profile_image as updater_avatar
        FROM email_queue eq
        JOIN users u ON eq.user_id = u.id
        JOIN users updater ON eq.updater_id = updater.id
        WHERE eq.user_id = ? AND eq.trip_id = ?
        ORDER BY eq.created_at ASC
      `).all(user_id, trip_id);

            if (notifications.length > 0) {
                groupedNotifications.push({
                    userId: user_id,
                    tripId: trip_id,
                    recipientName: notifications[0].recipient_name,
                    recipientEmail: notifications[0].recipient_email,
                    notifications: notifications.map(n => ({
                        id: n.id,
                        type: n.update_type,
                        data: JSON.parse(n.update_data),
                        updaterName: n.updater_name,
                        updaterAvatar: n.updater_avatar ? `${process.env.FRONTEND_URL}${n.updater_avatar}` : 'https://example.com/default-avatar.png',
                        createdAt: n.created_at
                    }))
                });
            }
        }

        return groupedNotifications;
    } catch (error) {
        console.error('Error getting pending notifications:', error);
        return [];
    }
};

/**
 * Delete processed notifications from the queue
 * @param {Array} notificationIds - Array of notification IDs to delete
 */
const deleteProcessedNotifications = (notificationIds) => {
    try {
        if (notificationIds.length === 0) return;

        const placeholders = notificationIds.map(() => '?').join(',');
        db.prepare(`DELETE FROM email_queue WHERE id IN (${placeholders})`).run(...notificationIds);
        console.log(`Deleted ${notificationIds.length} processed notifications from queue`);
    } catch (error) {
        console.error('Error deleting processed notifications:', error);
    }
};

/**
 * Process the email queue and send batched notifications
 */
const processEmailQueue = () => {
    try {
        const groupedNotifications = getPendingNotifications();

        if (groupedNotifications.length === 0) {
            console.log('No pending notifications to process');
            return;
        }

        console.log(`Processing ${groupedNotifications.length} batched notifications`);

        for (const group of groupedNotifications) {
            const { recipientName, recipientEmail, notifications } = group;

            // Get trip info from first notification
            const tripName = notifications[0].data.tripName;
            const tripDestination = notifications[0].data.tripDestination;
            const tripLink = notifications[0].data.tripLink;

            // Group by update type for the email
            const activities = notifications.filter(n => n.type === 'activity');
            const transportation = notifications.filter(n => n.type === 'transportation');
            const lodging = notifications.filter(n => n.type === 'lodging');
            const checklists = notifications.filter(n => n.type === 'checklist');

            // Count total updates
            const totalUpdates = notifications.length;

            // Get unique updaters
            const uniqueUpdaters = [...new Set(notifications.map(n => n.updaterName))];
            const updatersText = uniqueUpdaters.length === 1
                ? uniqueUpdaters[0]
                : `${uniqueUpdaters.slice(0, -1).join(', ')} and ${uniqueUpdaters[uniqueUpdaters.length - 1]}`;

            // Prepare email data for batched template
            const emailData = {
                isBatched: true,
                userName: recipientName,
                userEmail: recipientEmail,
                tripName,
                tripDestination,
                tripLink,
                totalUpdates,
                updatersText,

                // Activities
                hasActivities: activities.length > 0,
                activitiesCount: activities.length,
                activities: activities.map(a => ({
                    name: a.data.activityName,
                    date: a.data.activityDate,
                    time: a.data.activityTime || '',
                    location: a.data.activityLocation || 'N/A',
                    addedBy: a.updaterName
                })),

                // Transportation
                hasTransportation: transportation.length > 0,
                transportationCount: transportation.length,
                transportationItems: transportation.map(t => ({
                    type: t.data.transportType,
                    company: t.data.transportCompany || '',
                    from: t.data.transportFrom,
                    to: t.data.transportTo,
                    date: t.data.transportDate,
                    time: t.data.transportTime || '',
                    addedBy: t.updaterName
                })),

                // Lodging
                hasLodging: lodging.length > 0,
                lodgingCount: lodging.length,
                lodgingItems: lodging.map(l => ({
                    name: l.data.lodgingName,
                    address: l.data.lodgingAddress || 'N/A',
                    checkIn: l.data.lodgingCheckIn,
                    checkOut: l.data.lodgingCheckOut,
                    addedBy: l.updaterName
                })),

                // Checklists
                hasChecklists: checklists.length > 0,
                checklistsCount: checklists.length,
                checklistItems: checklists.map(c => ({
                    name: c.data.checklistName,
                    addedBy: c.updaterName
                })),

                // Common links
                appLink: `${process.env.FRONTEND_URL}/dashboard`,
                privacyLink: `${process.env.FRONTEND_URL}/privacy`,
                termsLink: `${process.env.FRONTEND_URL}/terms`,
                unsubscribeLink: `${process.env.FRONTEND_URL}/unsubscribe`,
                facebookLink: 'https://facebook.com',
                twitterLink: 'https://twitter.com',
                instagramLink: 'https://instagram.com'
            };

            // Send the batched email
            const subject = totalUpdates === 1
                ? `Update on trip "${tripName}": New ${notifications[0].type.charAt(0).toUpperCase() + notifications[0].type.slice(1)} Added`
                : `${totalUpdates} updates on trip "${tripName}"`;

            sendEmail(
                recipientEmail,
                subject,
                'trip-update-batched-template',
                emailData
            );

            // Delete processed notifications
            const processedIds = notifications.map(n => n.id);
            deleteProcessedNotifications(processedIds);
        }
    } catch (error) {
        console.error('Error processing email queue:', error);
    }
};

// Track the interval ID for cleanup
let processingInterval = null;

/**
 * Start the email queue processor
 */
const startEmailQueueProcessor = () => {
    console.log(`Starting email queue processor (queue duration: ${QUEUE_DURATION_MS / 1000 / 60} minutes, check interval: ${PROCESS_INTERVAL_MS / 1000 / 60} minutes)`);

    // Process immediately on startup in case there are old notifications
    setTimeout(() => {
        processEmailQueue();
    }, 10000); // Wait 10 seconds after startup

    // Then process periodically
    processingInterval = setInterval(() => {
        processEmailQueue();
    }, PROCESS_INTERVAL_MS);
};

/**
 * Stop the email queue processor
 */
const stopEmailQueueProcessor = () => {
    if (processingInterval) {
        clearInterval(processingInterval);
        processingInterval = null;
        console.log('Email queue processor stopped');
    }
};

module.exports = {
    initializeEmailQueue,
    queueEmailNotification,
    queueNotificationsForTripMembers,
    processEmailQueue,
    startEmailQueueProcessor,
    stopEmailQueueProcessor
};
