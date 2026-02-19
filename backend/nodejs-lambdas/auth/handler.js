/**
 * Kelvo E-Comm Auth Lambda - User registration, login, and profile backed by PostgreSQL.
 * @module auth/handler
 */

const tracer = require('../shared/tracer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { success, error, created, CORS_HEADERS } = require('../shared/responses');
const { getUserByEmail, createUser } = require('../shared/postgres');

const JWT_SECRET = process.env.JWT_SECRET || 'rum-shop-secret-key-2024';
const JWT_EXPIRY = '24h';

function hashPassword(password) {
  return tracer.trace('auth.hashPassword', () => bcrypt.hash(password, 10));
}

function verifyPassword(password, hash) {
  return tracer.trace('auth.verifyPassword', () => bcrypt.compare(password, hash));
}

function generateToken(payload) {
  return tracer.trace('auth.generateToken', () =>
    jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY })
  );
}

function verifyToken(token) {
  return tracer.trace('auth.verifyToken', () => jwt.verify(token, JWT_SECRET));
}

function getBearerToken(headers) {
  const auth = headers?.Authorization || headers?.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

async function register(body) {
  const { email, name, password } = body;

  if (!email || !name || !password) {
    return error('Missing required fields: email, name, password', 400);
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existing = await getUserByEmail(normalizedEmail);
  if (existing) {
    return error('User already exists with this email', 409);
  }

  const passwordHash = await hashPassword(password);
  await createUser(normalizedEmail, name, passwordHash);

  const token = generateToken({ email: normalizedEmail });
  const user = await getUserByEmail(normalizedEmail);

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

async function login(body) {
  const { email, password } = body;

  if (!email || !password) {
    return error('Missing required fields: email, password', 400);
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = await getUserByEmail(normalizedEmail);

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

async function getProfile(token) {
  if (!token) {
    return error('Authorization required', 401);
  }

  try {
    const decoded = verifyToken(token);
    const user = await getUserByEmail(decoded.email);

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

async function handler(event, context) {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 200, headers: CORS_HEADERS, body: '' };
    }

    const { httpMethod, path, body: rawBody, headers = {} } = event;
    const body = rawBody ? (typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody) : {};

    if (httpMethod === 'POST' && path.endsWith('/register')) return register(body);
    if (httpMethod === 'POST' && path.endsWith('/login')) return login(body);
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
