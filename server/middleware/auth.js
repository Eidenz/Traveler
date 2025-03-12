// server/middleware/auth.js
const jwt = require('jsonwebtoken');
const { db } = require('../db/database');

/**
 * Middleware to authenticate JWT tokens
 */
const authenticate = (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization token required' });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify token
    const { userId } = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Check if user exists
    const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(401).json({ message: 'User no longer exists' });
    }
    
    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    return res.status(401).json({ message: 'Invalid authorization token' });
  }
};

/**
 * Middleware to check if user has access to a trip
 */
const checkTripAccess = (roles = ['owner', 'editor', 'viewer']) => {
  return (req, res, next) => {
    try {
      // Look for tripId in URL params, query params, or request body
      const tripId = req.params.tripId || req.query.tripId || (req.body && req.body.trip_id);
      
      if (!tripId) {
        return res.status(400).json({ message: 'Trip ID is required' });
      }
      
      const userId = req.user.id;

      // Check if user has access to this trip
      const tripMember = db.prepare(`
        SELECT role FROM trip_members 
        WHERE trip_id = ? AND user_id = ?
      `).get(tripId, userId);

      if (!tripMember || !roles.includes(tripMember.role)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      req.userRole = tripMember.role;
      next();
    } catch (error) {
      console.error('Trip access check error:', error);
      return res.status(500).json({ message: 'Server error' });
    }
  };
};

/**
 * Middleware to check if user has edit access to a trip
 */
const requireEditAccess = (req, res, next) => {
  return checkTripAccess(['owner', 'editor'])(req, res, next);
};

/**
 * Middleware to check if user is the owner of a trip
 */
const requireOwnerAccess = (req, res, next) => {
  return checkTripAccess(['owner'])(req, res, next);
};

module.exports = {
  authenticate,
  checkTripAccess,
  requireEditAccess,
  requireOwnerAccess
};