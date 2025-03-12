// server/index.js
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const helmet = require('helmet');
const multer = require('multer');
const fs = require('fs');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const tripRoutes = require('./routes/trips');
const transportRoutes = require('./routes/transportation');
const lodgingRoutes = require('./routes/lodging');
const activityRoutes = require('./routes/activities');
const documentRoutes = require('./routes/documents');

// Database initialization
const { initializeDatabase } = require('./db/database');

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
if (process.env.NODE_ENV === 'production') {
  // Use a more relaxed helmet configuration in production
  app.use(
    helmet({
      contentSecurityPolicy: false, // Disable CSP for simplicity
      strictTransportSecurity: false, // Disable HSTS to prevent forcing HTTPS
    })
  );
} else {
  app.use(helmet()); // Standard helmet in development
}

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

// Serve static files from the React app in production
if (process.env.NODE_ENV === 'production') {
  // Serve the static files from the React app
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