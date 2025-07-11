// server/index.js
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const helmet = require('helmet');
const multer = require('multer');
const fs = require('fs');
const cron = require('node-cron'); // Added
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const tripRoutes = require('./routes/trips');
const transportRoutes = require('./routes/transportation');
const lodgingRoutes = require('./routes/lodging');
const activityRoutes = require('./routes/activities');
const documentRoutes = require('./routes/documents');
const checklistRoutes = require('./routes/checklists');
const budgetRoutes = require('./routes/budgets');
const personalBudgetRoutes = require('./routes/personalBudgets');

// Database initialization
const { initializeDatabase, db } = require('./db/database'); // Added db export

// Email Service
const { sendEmail } = require('./utils/emailService'); // Added
const { getUserById } = require('./controllers/tripController'); // Added

// Initialize express app
const app = express();
const PORT = process.env.PORT || 5000;

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Ensure DB directory exists
const dbDir = path.join(__dirname, 'db', 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Middleware
app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "img-src": ["'self'", "data:", "https://images.unsplash.com", process.env.FRONTEND_URL], // Allow images from self, data URLs, Unsplash, and frontend URL
      },
    },
  })); // Security headers
app.use(morgan('dev')); // Logging
app.use(cors()); // CORS handling
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Static files - provide access to uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/transportation', transportRoutes);
app.use('/api/lodging', lodgingRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/checklists', checklistRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/personal-budgets', personalBudgetRoutes);

// Serve static files from the React app in production
if (process.env.NODE_ENV === 'production') {
  // Serve the static files from the React app
  const frontendBuildPath = path.join(__dirname, '../client/dist');

  // --- SSR for Social Media Meta Tags ---
  // This handler intercepts requests for specific trip pages to inject meta tags
  // for social media sharing cards (e.g., on Facebook, Twitter).
  app.get('/trips/:tripId', async (req, res, next) => {
    try {
      const { tripId } = req.params;

      // Fetch basic trip details. No authentication needed as this is for public crawlers.
      const trip = db.prepare('SELECT name, description, location, start_date, end_date, cover_image FROM trips WHERE id = ?').get(tripId);

      // If trip doesn't exist, pass to the next handler (the SPA) to show a 404 page.
      if (!trip) {
        return next();
      }

      const indexPath = path.join(frontendBuildPath, 'index.html');
      let htmlData = fs.readFileSync(indexPath, 'utf8');

      // Prepare data for meta tags
      const pageTitle = trip.name;
      const tripDates = `${new Date(trip.start_date).toLocaleDateString()} - ${new Date(trip.end_date).toLocaleDateString()}`;
      const pageDescription = (trip.description || `A trip to ${trip.location || 'an amazing place'} from ${tripDates}.`).substring(0, 160).replace(/"/g, '\"');
      const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

      let fullImageUrl = getFallbackImageUrl('trip'); // Use a default fallback
      if (trip.cover_image) {
          // Handle both external URLs and local paths
          fullImageUrl = trip.cover_image.startsWith('http') 
            ? trip.cover_image 
            : `${req.protocol}://${req.get('host')}${trip.cover_image}`;
      }

      // Construct meta tags
      const metaTags = `
        <title>${pageTitle}</title>
        <meta name="description" content="${pageDescription}">
        <meta property="og:title" content="${pageTitle}">
        <meta property="og:description" content="${pageDescription}">
        <meta property="og:image" content="${fullImageUrl}">
        <meta property="og:url" content="${fullUrl}">
        <meta property="og:type" content="website">
        <meta name="twitter:card" content="summary_large_image">
      `;

      htmlData = htmlData.replace('</head>', `${metaTags}</head>`);
      res.header('Content-Type', 'text/html').send(htmlData);
    } catch (err) {
      console.error('SSR Meta Tag Error (Trip):', err);
      next(); // Fallback to SPA on error
    }
  });

  app.use(express.static(path.join(__dirname, '../client/dist')));

  // For any request that doesn't match the above routes, send the React app
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
} else {
  // Basic route for testing in development
  app.get('/', (req, res) => {
    res.send('Travel Companion API is running!');
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// --- Trip Reminder Cron Job ---
// Schedule to run every day at 8:00 AM server time
cron.schedule('0 8 * * *', async () => {
    console.log('Running daily trip reminder check...');
    try {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        const tomorrowDateString = tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD format

        // Find trips starting tomorrow
        const tripsStartingTomorrow = db.prepare('SELECT * FROM trips WHERE start_date = ?').all(tomorrowDateString);

        console.log(`Found ${tripsStartingTomorrow.length} trips starting tomorrow.`);

        for (const trip of tripsStartingTomorrow) {
            // Get all members of the trip
            const members = db.prepare(`
                SELECT u.id, u.name, u.email, u.receiveEmails
                FROM users u
                JOIN trip_members tm ON u.id = tm.user_id
                WHERE tm.trip_id = ? AND u.receiveEmails = 1
            `).all(trip.id);

            if (members.length === 0) continue;

            console.log(`Processing reminders for trip: ${trip.name} (ID: ${trip.id}) for ${members.length} members.`);

            // --- Prepare common email data ---
            const firstLodging = db.prepare('SELECT name, address, confirmation_code FROM lodging WHERE trip_id = ? ORDER BY check_in ASC LIMIT 1').get(trip.id);
            const firstTransport = db.prepare('SELECT type, company, from_location, to_location, departure_time, confirmation_code FROM transportation WHERE trip_id = ? AND departure_date = ? ORDER BY departure_time ASC LIMIT 1').get(trip.id, tomorrowDateString);
            const firstActivity = db.prepare('SELECT name, time, location, confirmation_code FROM activities WHERE trip_id = ? AND date = ? ORDER BY time ASC LIMIT 1').get(trip.id, tomorrowDateString);
            const checklists = db.prepare('SELECT id FROM checklists WHERE trip_id = ?').all(trip.id);

            // Simple placeholder for weather - replace with actual API call if desired
            const weather = { temp: 15, condition: 'Partly cloudy', icon: 'https://example.com/weather-icon.png' };

            const commonEmailData = {
                tripName: trip.name,
                tripDestination: trip.location || 'Unknown Destination',
                tripImage: trip.cover_image ? `${process.env.FRONTEND_URL}${trip.cover_image}` : 'https://example.com/default-trip.png',
                tripStartDate: new Date(trip.start_date).toLocaleDateString(),
                tripEndDate: new Date(trip.end_date).toLocaleDateString(),
                tripLink: `${process.env.FRONTEND_URL}/trips/${trip.id}`,
                offlineLink: `${process.env.FRONTEND_URL}/trips/${trip.id}?offline=true`, // Example link
                privacyLink: `${process.env.FRONTEND_URL}/privacy`,
                termsLink: `${process.env.FRONTEND_URL}/terms`,
                unsubscribeLink: `${process.env.FRONTEND_URL}/unsubscribe`,
                facebookLink: 'https://facebook.com',
                twitterLink: 'https://twitter.com',
                instagramLink: 'https://instagram.com',
                // First day details
                firstLodgingName: firstLodging?.name || 'N/A',
                firstLodgingAddress: firstLodging?.address || 'N/A',
                hasCheckIn: !!firstLodging,
                checkInTime: 'Afternoon', // Placeholder, get from lodging if available
                firstLodgingCode: firstLodging?.confirmation_code || '',
                hasFirstDayTransport: !!firstTransport,
                firstTransportType: firstTransport?.type || '',
                firstTransportCompany: firstTransport?.company || '',
                firstTransportFrom: firstTransport?.from_location || '',
                firstTransportTo: firstTransport?.to_location || '',
                firstTransportTime: firstTransport?.departure_time || 'Morning',
                firstTransportCode: firstTransport?.confirmation_code || '',
                hasFirstDayActivity: !!firstActivity,
                firstActivityName: firstActivity?.name || '',
                firstActivityTime: firstActivity?.time || 'Anytime',
                firstActivityLocation: firstActivity?.location || '',
                firstActivityCode: firstActivity?.confirmation_code || '',
                // Weather
                weatherIcon: weather.icon,
                weatherTemp: weather.temp,
                weatherCondition: weather.condition,
                // Checklists
                hasChecklists: checklists.length > 0,
            };

            // Send email to each member
            for (const member of members) {
                const memberSpecificData = {
                    ...commonEmailData,
                    userName: member.name,
                    userEmail: member.email,
                };

                sendEmail(
                    member.email,
                    `Reminder: Your trip to ${trip.name} starts tomorrow!`,
                    'trip-reminder-template',
                    memberSpecificData
                );
            }
        }
        console.log('Finished daily trip reminder check.');
    } catch (error) {
        console.error('Error running trip reminder job:', error);
    }
}, {
    scheduled: true,
    timezone: "UTC" // Or your server's timezone e.g., "Europe/London"
});


// Initialize database and start server
initializeDatabase()
  .then(() => {
    // Listen on all network interfaces (0.0.0.0) instead of just localhost
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Access the app at http://localhost:${PORT} or http://<your-ip-address>:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });