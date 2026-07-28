// server/middleware/auth.js
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { db } = require('../db/database');
const { isValidTripId } = require('../utils/idGenerator');

const API_KEY_PREFIX = 'trv_';
const READ_ONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const hashApiKey = (rawKey) =>
  crypto.createHash('sha256').update(rawKey).digest('hex');

/**
 * Authenticate a request using an API key. API keys are read-only —
 * any non-GET request is rejected so a leaked key cannot mutate state.
 */
const authenticateWithApiKey = (rawKey, req, res, next) => {
  try {
    const keyHash = hashApiKey(rawKey);
    const keyRow = db.prepare(
      'SELECT id, user_id, expires_at FROM api_keys WHERE key_hash = ?'
    ).get(keyHash);

    if (!keyRow) {
      return res.status(401).json({ message: 'Invalid API key' });
    }

    if (keyRow.expires_at && new Date(keyRow.expires_at).getTime() < Date.now()) {
      return res.status(401).json({ message: 'API key expired' });
    }

    if (!READ_ONLY_METHODS.has(req.method)) {
      return res.status(403).json({ message: 'API keys are read-only' });
    }

    const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(keyRow.user_id);
    if (!user) {
      return res.status(401).json({ message: 'User no longer exists' });
    }

    // Best-effort touch — failure here must not block the request.
    try {
      db.prepare('UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?').run(keyRow.id);
    } catch (e) {
      console.error('Failed to update api_key last_used_at:', e);
    }

    req.user = user;
    req.authMethod = 'apikey';
    req.apiKeyId = keyRow.id;
    return next();
  } catch (error) {
    console.error('API key auth error:', error);
    return res.status(401).json({ message: 'Invalid API key' });
  }
};

/**
 * Middleware to authenticate JWT tokens or API keys (auto-detected by prefix).
 */
const authenticate = (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization token required' });
    }

    const token = authHeader.split(' ')[1];

    if (token.startsWith(API_KEY_PREFIX)) {
      return authenticateWithApiKey(token, req, res, next);
    }

    // Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { userId, iat } = decoded;

    // Check if user exists
    const row = db.prepare('SELECT id, name, email, password_changed_at FROM users WHERE id = ?').get(userId);
    if (!row) {
      return res.status(401).json({ message: 'User no longer exists' });
    }

    // Tokens issued before the last password change are revoked
    const { password_changed_at, ...user } = row;
    if (password_changed_at && iat < password_changed_at) {
      return res.status(401).json({ message: 'Token expired' });
    }

    // Add user to request object
    req.user = user;
    req.authMethod = 'jwt';
    // Expose the token's claims so endpoints that re-issue tokens (refresh,
    // password change) can preserve the session's "remember me" choice
    req.tokenClaims = decoded;
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
 * Middleware that rejects API-key auth — for sensitive routes that must
 * only be accessible from a real logged-in session (password change,
 * account deletion, managing API keys themselves, etc.).
 */
const requireSessionAuth = (req, res, next) => {
  if (req.authMethod !== 'jwt') {
    return res.status(403).json({ message: 'This endpoint requires a logged-in session' });
  }
  next();
};

/**
 * Middleware to check if user has access to a trip
 */
const checkTripAccess = (roles = ['owner', 'editor', 'viewer']) => {
  return (req, res, next) => {
    try {
      // Look for tripId in URL params, query params, or request body
      let tripId = req.params.tripId || req.query.tripId || (req.body && req.body.trip_id);

      // If we have a checklistId but no tripId, try to get the tripId from the checklist
      if (!tripId && req.params.checklistId) {
        const checklistId = req.params.checklistId;
        const checklist = db.prepare('SELECT trip_id FROM checklists WHERE id = ?').get(checklistId);
        if (checklist) {
          tripId = checklist.trip_id;
          // Add it to the request body for later middleware
          if (!req.body) req.body = {};
          req.body.trip_id = tripId;
        }
      }

      if (!tripId) {
        return res.status(400).json({ message: 'Trip ID is required' });
      }

      // Validate trip ID format
     if (!isValidTripId(tripId)) {
       return res.status(400).json({ message: 'Invalid trip ID format' });
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
  requireSessionAuth,
  checkTripAccess,
  requireEditAccess,
  requireOwnerAccess,
  hashApiKey,
  API_KEY_PREFIX,
};
