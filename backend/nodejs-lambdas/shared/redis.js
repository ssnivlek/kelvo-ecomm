/**
 * Redis client for session-based data (carts, payment intents).
 * Used by Cart and Payment services. Connection via REDIS_URL env var.
 * @module shared/redis
 */

const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let client;

function getClient() {
  if (!client) {
    client = new Redis(REDIS_URL, {
      retryStrategy: (times) => Math.min(times * 200, 3000),
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    });
    client.on('error', (err) => console.error('[Redis] Error:', err.message));
    client.on('connect', () => console.log('[Redis] Connected'));
  }
  return client;
}

const CART_TTL = 86400; // 24 hours
const PAYMENT_TTL = 3600; // 1 hour

// ── Cart operations ──────────────────────────────────────────

async function getCart(sessionId) {
  const data = await getClient().get(`cart:${sessionId}`);
  if (!data) return { items: [], updatedAt: new Date().toISOString() };
  return JSON.parse(data);
}

async function saveCart(sessionId, cart) {
  cart.updatedAt = new Date().toISOString();
  await getClient().set(`cart:${sessionId}`, JSON.stringify(cart), 'EX', CART_TTL);
}

async function deleteCart(sessionId) {
  await getClient().del(`cart:${sessionId}`);
}

// ── Payment intent operations ────────────────────────────────

async function getPaymentIntent(id) {
  const data = await getClient().get(`payment:${id}`);
  return data ? JSON.parse(data) : null;
}

async function savePaymentIntent(id, intent) {
  await getClient().set(`payment:${id}`, JSON.stringify(intent), 'EX', PAYMENT_TTL);
}

module.exports = {
  getClient,
  getCart,
  saveCart,
  deleteCart,
  getPaymentIntent,
  savePaymentIntent,
};
