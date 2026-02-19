/**
 * In-memory mock database for cart and user data.
 * For production, replace with DynamoDB or similar.
 * @module shared/mockDb
 */

const bcrypt = require('bcryptjs');

/** @type {Map<string, { items: Array<{productId: string, productName: string, price: number, quantity: number, imageUrl?: string}>, updatedAt: Date }>} */
const carts = new Map();

/** @type {Map<string, { email: string, name: string, passwordHash: string, createdAt: Date }>} */
const users = new Map();

// Pre-seed demo user: demo@rumshop.com / password123
const DEMO_PASSWORD_HASH = bcrypt.hashSync('password123', 10);
users.set('demo@rumshop.com', {
  email: 'demo@rumshop.com',
  name: 'Demo User',
  passwordHash: DEMO_PASSWORD_HASH,
  createdAt: new Date(),
});

/**
 * Get or create a cart for a session.
 * @param {string} sessionId - Session identifier
 * @returns {object} Cart object
 */
function getCart(sessionId) {
  if (!carts.has(sessionId)) {
    carts.set(sessionId, { items: [], updatedAt: new Date() });
  }
  return carts.get(sessionId);
}

/**
 * Save cart (updates updatedAt).
 * @param {string} sessionId - Session identifier
 * @param {object} cart - Cart object
 */
function saveCart(sessionId, cart) {
  cart.updatedAt = new Date();
  carts.set(sessionId, cart);
}

/**
 * Get user by email.
 * @param {string} email - User email
 * @returns {object|undefined} User object or undefined
 */
function getUserByEmail(email) {
  return users.get(email);
}

/**
 * Create a new user.
 * @param {string} email - User email
 * @param {string} name - User name
 * @param {string} passwordHash - Bcrypt hashed password
 */
function createUser(email, name, passwordHash) {
  users.set(email, {
    email,
    name,
    passwordHash,
    createdAt: new Date(),
  });
}

module.exports = {
  carts,
  users,
  getCart,
  saveCart,
  getUserByEmail,
  createUser,
};
