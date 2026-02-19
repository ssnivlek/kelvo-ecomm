/**
 * RUM Shop Auth Lambda - User registration, login, and profile with Datadog APM.
 * @module auth/handler
 */

const tracer = require('../shared/tracer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { success, error, created, CORS_HEADERS } = require('../shared/responses');
const { getUserByEmail, createUser } = require('../shared/mockDb');

const JWT_SECRET = process.env.JWT_SECRET || 'rum-shop-secret-key-2024';
const JWT_EXPIRY = '24h';

/**
 * Hash password with bcrypt.
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
function hashPassword(password) {
  return tracer.trace('auth.hashPassword', () => bcrypt.hash(password, 10));
}

/**
 * Verify password against hash.
 * @param {string} password - Plain text password
 * @param {string} hash - Bcrypt hash
 * @returns {Promise<boolean>} True if valid
 */
function verifyPassword(password, hash) {
  return tracer.trace('auth.verifyPassword', () => bcrypt.compare(password, hash));
}

/**
 * Generate JWT token for user.
 * @param {object} payload - Token payload (email, etc.)
 * @returns {string} JWT token
 */
function generateToken(payload) {
  return tracer.trace('auth.generateToken', () =>
    jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY })
  );
}

/**
 * Verify and decode JWT token.
 * @param {string} token - JWT token
 * @returns {object} Decoded payload
 */
function verifyToken(token) {
  return tracer.trace('auth.verifyToken', () => jwt.verify(token, JWT_SECRET));
}

/**
 * Extract Bearer token from Authorization header.
 * @param {object} headers - Request headers
 * @returns {string|null} Token or null
 */
function getBearerToken(headers) {
  const auth = headers?.Authorization || headers?.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

/**
 * Register new user.
 * @param {object} body - Request body
 * @returns {Promise<object>} API Gateway response
 */
async function register(body) {
  const { email, name, password } = body;

  if (!email || !name || !password) {
    return error('Missing required fields: email, name, password', 400);
  }

  const normalizedEmail = email.toLowerCase().trim();
  if (getUserByEmail(normalizedEmail)) {
    return error('User already exists with this email', 409);
  }

  const passwordHash = await hashPassword(password);
  createUser(normalizedEmail, name, passwordHash);

  const token = generateToken({ email: normalizedEmail });
  const user = getUserByEmail(normalizedEmail);

  return created({
    message: 'User registered successfully',
    token,
    user: {
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    },
  });
}

/**
 * Login user and return JWT.
 * @param {object} body - Request body
 * @returns {Promise<object>} API Gateway response
 */
async function login(body) {
  const { email, password } = body;

  if (!email || !password) {
    return error('Missing required fields: email, password', 400);
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = getUserByEmail(normalizedEmail);

  if (!user) {
    return error('Invalid email or password', 401);
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return error('Invalid email or password', 401);
  }

  const token = generateToken({ email: normalizedEmail });

  return success({
    message: 'Login successful',
    token,
    user: {
      email: user.email,
      name: user.name,
    },
  });
}

/**
 * Get user profile (requires JWT).
 * @param {string} token - JWT token
 * @returns {object} API Gateway response
 */
function getProfile(token) {
  if (!token) {
    return error('Authorization required', 401);
  }

  try {
    const decoded = verifyToken(token);
    const user = getUserByEmail(decoded.email);

    if (!user) {
      return error('User not found', 404);
    }

    return success({
      user: {
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return error('Token expired', 401);
    }
    if (err.name === 'JsonWebTokenError') {
      return error('Invalid token', 401);
    }
    throw err;
  }
}

/**
 * Main Lambda handler - routes requests to appropriate handlers.
 * @param {object} event - API Gateway event
 * @param {object} context - Lambda context
 * @returns {Promise<object>} API Gateway response
 */
async function handler(event, context) {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: '',
      };
    }

    const { httpMethod, path, body: rawBody, headers = {} } = event;
    const body = rawBody ? (typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody) : {};

    // POST /api/auth/register
    if (httpMethod === 'POST' && path.endsWith('/register')) {
      return register(body);
    }

    // POST /api/auth/login
    if (httpMethod === 'POST' && path.endsWith('/login')) {
      return login(body);
    }

    // GET /api/auth/profile
    if (httpMethod === 'GET' && path.endsWith('/profile')) {
      const token = getBearerToken(headers);
      return getProfile(token);
    }

    return error('Not Found', 404);
  } catch (err) {
    console.error('Auth handler error:', err);
    return error(err.message || 'Internal server error', 500);
  }
}

module.exports = { handler };
