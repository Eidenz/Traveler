// server/index.js
const express = require('express');
const http = require('http');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const helmet = require('helmet');
const multer = require('multer');
const fs = require('fs');
const cron = require('node-cron');
require('dotenv').config();

// Socket.IO
const { initializeSocket } = require('./utils/socketService');

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
const brainstormRoutes = require('./routes/brainstorm');
const oembedRoutes = require('./routes/oembed');
const apiKeyRoutes = require('./routes/apiKeys');

// Database initialization
const { initializeDatabase, db } = require('./db/database'); // Added db export

// Email Service
const { sendEmail } = require('./utils/emailService'); // Added
const { getUserById } = require('./controllers/tripController'); // Added
const { getFallbackImageUrl } = require('./utils/ssrUtils');

// Escape values interpolated into server-rendered HTML meta tags.
// Without this a trip named `</title><script>...</script>` executes for anyone
// who opens the trip or its public share link.
const escapeHtml = (value) => String(value ?? '').replace(
  /[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
);

// Email Queue Service
const { initializeEmailQueue, startEmailQueueProcessor } = require('./utils/emailQueueService');

// Weather Service
const { getWeatherForTrip } = require('./utils/weatherService');

// Refuse to start without a real signing secret — tokens signed with a weak or
// default secret can be forged, which would let anyone impersonate any account.
const INSECURE_SECRETS = ['your-secret-key', 'your-session-secret', 'secret', 'changeme'];
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 ||
  INSECURE_SECRETS.includes(process.env.JWT_SECRET)) {
  console.error(
    '\nFATAL: JWT_SECRET must be set to a unique random value of at least 32 characters.\n' +
    'Generate one with:  openssl rand -hex 32\n'
  );
  process.exit(1);
}

// Initialize express app
const app = express();
const PORT = process.env.PORT || 5000;

// Reverse proxy support. Auth rate limits are keyed by client IP, so behind a
// proxy (nginx, Caddy, Cloudflare, a docker ingress) the real address only
// arrives in X-Forwarded-For. Enable this by setting TRUST_PROXY:
//   TRUST_PROXY=1            trust one proxy hop (typical)
//   TRUST_PROXY=loopback     trust local proxies
//   TRUST_PROXY=true         trust all hops (only behind a proxy you control)
// Leave it unset when the app is exposed directly — trusting a forwarded header
// that anyone can send would let a client spoof its IP and bypass the limits.
if (process.env.TRUST_PROXY) {
  const value = process.env.TRUST_PROXY;
  app.set('trust proxy', /^\d+$/.test(value) ? Number(value) : value === 'true' ? true : value);
  console.log(`Trusting proxy: ${value}`);
}

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
      "default-src": ["'self'"],
      "script-src": ["'self'", "'unsafe-inline'"], // Mapbox GL requires some inline scripts
      "style-src": [
        "'self'",
        "'unsafe-inline'",
        "blob:",
        "https://fonts.googleapis.com", // Google Fonts
        "https://api.mapbox.com" // Mapbox GL CSS
      ],
      "img-src": [
        "'self'",
        "data:",
        "blob:",
        "https://images.unsplash.com",
        "https://*.tiles.mapbox.com", // Mapbox map tiles
        "https://api.mapbox.com", // Mapbox images/sprites
        process.env.FRONTEND_URL
      ],
      "connect-src": [
        "'self'",
        "https://api.mapbox.com", // Mapbox API (geocoding, styles, etc.)
        "https://events.mapbox.com" // Mapbox analytics (optional)
      ],
      "worker-src": ["'self'", "blob:"], // Web Workers for Mapbox GL
      "child-src": ["'self'", "blob:"], // For older browsers
      "font-src": ["'self'", "data:", "https://fonts.gstatic.com"],
    },
  },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
}));
app.use(morgan('dev'));

// CORS configuration — origins from CORS_ORIGINS env var (comma-separated)
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'capacitor://localhost', 'https://localhost'];

const corsOptions = {
  origin: corsOrigins,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));
// Preflight must use the same restrictive options — a bare cors() here would
// answer every preflight with Access-Control-Allow-Origin: *
app.options('*', cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files - provide access to uploads directory
//
// Uploaded documents (tickets, passports, booking confirmations) must NOT be
// publicly readable: they are served only through /api/documents/:id/view|download,
// which enforces trip membership and the personal-document rule.
app.use('/uploads/documents', (req, res) => {
  res.status(403).json({ message: 'Documents must be accessed through the API' });
});

// Remaining uploads are user-visible images (avatars, covers, banners) rendered
// in <img> tags without auth headers. nosniff stops a mislabelled file from
// being interpreted as HTML/script on this origin.
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
  },
}));

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
app.use('/api/brainstorm', brainstormRoutes);
app.use('/api/oembed', oembedRoutes);
app.use('/api/api-keys', apiKeyRoutes);

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
      const pageDescription = (trip.description || `A trip to ${trip.location || 'an amazing place'} from ${tripDates}.`).substring(0, 160);
      const protocol = req.get('x-forwarded-proto') || req.protocol;
      const host = req.get('host');
      const fullUrl = `${protocol}://${host}${req.originalUrl}`;

      let fullImageUrl = getFallbackImageUrl('trip'); // Use a default fallback
      if (trip.cover_image) {
        // Handle both external URLs and local paths
        fullImageUrl = trip.cover_image.startsWith('http')
          ? trip.cover_image
          : `${protocol}://${host}${trip.cover_image}`;
      }

      // Construct meta tags
      const oembedUrl = `${protocol}://${host}/api/oembed?url=${encodeURIComponent(fullUrl)}&format=json`;
      const metaTags = `
        <title>${escapeHtml(pageTitle)}</title>
        <meta name="description" content="${escapeHtml(pageDescription)}">
        <meta property="og:title" content="${escapeHtml(pageTitle)}">
        <meta property="og:description" content="${escapeHtml(pageDescription)}">
        <meta property="og:image" content="${escapeHtml(fullImageUrl)}">
        <meta property="og:url" content="${escapeHtml(fullUrl)}">
        <meta property="og:type" content="website">
        <meta name="twitter:card" content="summary_large_image">
        <link rel="alternate" type="application/json+oembed" href="${escapeHtml(oembedUrl)}" title="${escapeHtml(pageTitle)}" />
      `;

      htmlData = htmlData.replace('</head>', `${metaTags}</head>`);
      res.header('Content-Type', 'text/html').send(htmlData);
    } catch (err) {
      console.error('SSR Meta Tag Error (Trip):', err);
      next(); // Fallback to SPA on error
    }
  });

  // SSR for public trip share links
  app.get('/trip/public/:token', async (req, res, next) => {
    try {
      const { token } = req.params;
      const trip = db.prepare('SELECT name, description, location, start_date, end_date, cover_image FROM trips WHERE public_share_token = ?').get(token);

      if (!trip) return next();

      const indexPath = path.join(frontendBuildPath, 'index.html');
      let htmlData = fs.readFileSync(indexPath, 'utf8');

      const pageTitle = trip.name;
      const tripDates = `${new Date(trip.start_date).toLocaleDateString()} - ${new Date(trip.end_date).toLocaleDateString()}`;
      const pageDescription = (trip.description || `A trip to ${trip.location || 'an amazing place'} from ${tripDates}.`).substring(0, 160);
      const protocol = req.get('x-forwarded-proto') || req.protocol;
      const host = req.get('host');
      const fullUrl = `${protocol}://${host}${req.originalUrl}`;

      let fullImageUrl = getFallbackImageUrl('trip');
      if (trip.cover_image) {
        fullImageUrl = trip.cover_image.startsWith('http')
          ? trip.cover_image
          : `${protocol}://${host}${trip.cover_image}`;
      }

      const oembedUrl = `${protocol}://${host}/api/oembed?url=${encodeURIComponent(fullUrl)}&format=json`;
      const metaTags = `
        <title>${escapeHtml(pageTitle)}</title>
        <meta name="description" content="${escapeHtml(pageDescription)}">
        <meta property="og:title" content="${escapeHtml(pageTitle)}">
        <meta property="og:description" content="${escapeHtml(pageDescription)}">
        <meta property="og:image" content="${escapeHtml(fullImageUrl)}">
        <meta property="og:url" content="${escapeHtml(fullUrl)}">
        <meta property="og:type" content="website">
        <meta name="twitter:card" content="summary_large_image">
        <link rel="alternate" type="application/json+oembed" href="${escapeHtml(oembedUrl)}" title="${escapeHtml(pageTitle)}" />
      `;

      htmlData = htmlData.replace('</head>', `${metaTags}</head>`);
      res.header('Content-Type', 'text/html').send(htmlData);
    } catch (err) {
      console.error('SSR Meta Tag Error (Public Trip):', err);
      next();
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
  try {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowDateString = tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD format

    // Find trips starting tomorrow
    const tripsStartingTomorrow = db.prepare('SELECT * FROM trips WHERE start_date = ?').all(tomorrowDateString);

    for (const trip of tripsStartingTomorrow) {
      // Get all members of the trip
      const members = db.prepare(`
                SELECT u.id, u.name, u.email, u.receiveEmails
                FROM users u
                JOIN trip_members tm ON u.id = tm.user_id
                WHERE tm.trip_id = ? AND u.receiveEmails = 1
            `).all(trip.id);

      if (members.length === 0) continue;

      // --- Prepare common email data ---
      const firstLodging = db.prepare('SELECT name, address, confirmation_code FROM lodging WHERE trip_id = ? ORDER BY check_in ASC LIMIT 1').get(trip.id);
      const firstTransport = db.prepare('SELECT type, company, from_location, to_location, departure_time, confirmation_code FROM transportation WHERE trip_id = ? AND departure_date = ? ORDER BY departure_time ASC LIMIT 1').get(trip.id, tomorrowDateString);
      const firstActivity = db.prepare('SELECT name, time, location, confirmation_code FROM activities WHERE trip_id = ? AND date = ? ORDER BY time ASC LIMIT 1').get(trip.id, tomorrowDateString);
      const checklists = db.prepare('SELECT id FROM checklists WHERE trip_id = ?').all(trip.id);

      // Fetch real weather data from Open-Meteo (free, no API key needed)
      let weather = null;
      if (trip.location) {
        try {
          weather = await getWeatherForTrip(trip.location, tomorrowDateString);
          if (weather) {
            console.log(`Weather for ${trip.name}: ${weather.temp}°C, ${weather.condition}`);
          }
        } catch (weatherError) {
          console.error(`Failed to fetch weather for trip ${trip.name}:`, weatherError.message);
        }
      }

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
        // Weather (only include if we got valid data)
        hasWeather: !!weather,
        weatherIcon: weather?.icon || '',
        weatherTemp: weather?.temp || '',
        weatherTempMax: weather?.tempMax || '',
        weatherTempMin: weather?.tempMin || '',
        weatherCondition: weather?.condition || '',
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
    // Initialize email queue table
    initializeEmailQueue();

    // Start the email queue processor
    startEmailQueueProcessor();

    // Create HTTP server and attach Socket.IO
    const httpServer = http.createServer(app);
    initializeSocket(httpServer);

    // Listen on all network interfaces (0.0.0.0) instead of just localhost
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Real-time collaboration enabled via Socket.IO`);
      console.log(`Access the app at http://localhost:${PORT} or http://<your-ip-address>:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });