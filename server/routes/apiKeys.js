// server/routes/apiKeys.js
const express = require('express');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const { db } = require('../db/database');
const {
  authenticate,
  requireSessionAuth,
  hashApiKey,
  API_KEY_PREFIX,
} = require('../middleware/auth');

const router = express.Router();

// All API key management requires a real session — never an API key itself.
router.use(authenticate, requireSessionAuth);

const generateRawKey = () => {
  // 32 random bytes → 43 base64url chars; gives ~256 bits of entropy.
  const random = crypto.randomBytes(32).toString('base64url');
  return `${API_KEY_PREFIX}${random}`;
};

// List the current user's API keys (without secrets).
router.get('/', (req, res) => {
  try {
    const keys = db.prepare(`
      SELECT id, name, key_prefix, last_used_at, expires_at, created_at
      FROM api_keys
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).all(req.user.id);
    return res.status(200).json({ keys });
  } catch (error) {
    console.error('List API keys error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Create a new API key. The plaintext key is returned ONCE in this response.
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
    body('expires_at').optional({ nullable: true, checkFalsy: true }).isISO8601()
      .withMessage('expires_at must be an ISO-8601 datetime'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { name, expires_at } = req.body;

      if (expires_at && new Date(expires_at).getTime() <= Date.now()) {
        return res.status(400).json({ message: 'expires_at must be in the future' });
      }

      const rawKey = generateRawKey();
      const keyHash = hashApiKey(rawKey);
      // Show enough to identify the key in the UI (e.g. "trv_abcd…").
      const keyPrefix = rawKey.slice(0, API_KEY_PREFIX.length + 6);

      const result = db.prepare(`
        INSERT INTO api_keys (user_id, name, key_prefix, key_hash, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(req.user.id, name, keyPrefix, keyHash, expires_at || null);

      const created = db.prepare(`
        SELECT id, name, key_prefix, last_used_at, expires_at, created_at
        FROM api_keys WHERE id = ?
      `).get(result.lastInsertRowid);

      return res.status(201).json({
        message: 'API key created',
        key: created,
        // Plaintext key — only shown here, never retrievable again.
        plaintext: rawKey,
      });
    } catch (error) {
      console.error('Create API key error:', error);
      return res.status(500).json({ message: 'Server error' });
    }
  }
);

// Revoke (delete) an API key.
router.delete('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'Invalid id' });
    }
    const result = db.prepare('DELETE FROM api_keys WHERE id = ? AND user_id = ?')
      .run(id, req.user.id);
    if (result.changes === 0) {
      return res.status(404).json({ message: 'API key not found' });
    }
    return res.status(200).json({ message: 'API key revoked' });
  } catch (error) {
    console.error('Delete API key error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
