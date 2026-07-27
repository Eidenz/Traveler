// server/middleware/rateLimit.js
// Rate limiters for the authentication routes.
//
// These endpoints are the ones worth attacking: unlimited login attempts allow
// credential stuffing, unlimited /forgot-password lets someone mail-bomb a user
// (and burn the SMTP quota), and unlimited /reset-password/:token allows a token
// brute force.
//
// NOTE ON PROXIES: limits are keyed by client IP. Behind a reverse proxy every
// request arrives from the proxy's address, so the limit would apply to all
// users at once. Set TRUST_PROXY (see index.js) when running behind one —
// otherwise leave it off, since blindly trusting X-Forwarded-For lets a client
// spoof its address and bypass these limits entirely.

const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');

/**
 * Key on IP *and* the targeted account.
 *
 * Keying on IP alone means someone brute forcing one account locks every other
 * user at that address out of logging in — and if the app sits behind a proxy
 * without TRUST_PROXY set, that address is shared by everyone. Per-account keys
 * confine the lockout to the account under attack; spraying many accounts from
 * one IP is still caught by the broader authLimiter below.
 */
const ipAndEmailKey = (req, res) => {
  const ip = ipKeyGenerator(req.ip); // normalises IPv6 into a sane bucket
  const email = String(req.body?.email || '').toLowerCase().trim();
  return email ? `${ip}:${email}` : ip;
};

// Rate limiting is disabled under test so suites can register/login freely.
const isTest = process.env.NODE_ENV === 'test';

const baseOptions = {
  standardHeaders: 'draft-7', // RateLimit-* response headers
  legacyHeaders: false,
  skip: () => isTest,
};

/**
 * Broad limit for every /api/auth request — catches scanning and scripted abuse
 * without getting in the way of a person signing in a few times.
 */
const authLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 60,
  message: { message: 'Too many requests. Please try again in a few minutes.' },
});

/**
 * Login: counts only FAILED attempts, so someone legitimately using the app
 * is never locked out by their own successful logins.
 */
const loginLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  keyGenerator: ipAndEmailKey,
  message: { message: 'Too many failed login attempts. Please try again in 15 minutes.' },
});

/** Account creation — slows down bulk signups. */
const registerLimiter = rateLimit({
  ...baseOptions,
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 10,
  message: { message: 'Too many accounts created from this address. Please try again later.' },
});

/**
 * Password reset request — each one sends an email, so this is both an abuse
 * vector against the user's inbox and against the mail quota.
 */
const forgotPasswordLimiter = rateLimit({
  ...baseOptions,
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 5,
  keyGenerator: ipAndEmailKey,
  message: { message: 'Too many password reset requests. Please try again later.' },
});

/** Reset token submission — prevents brute forcing the token. */
const resetPasswordLimiter = rateLimit({
  ...baseOptions,
  windowMs: 60 * 60 * 1000,
  limit: 10,
  message: { message: 'Too many attempts. Please request a new reset link.' },
});

module.exports = {
  authLimiter,
  loginLimiter,
  registerLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
};
