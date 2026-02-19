/**
 * PostgreSQL client for user persistence.
 * Used by Auth Service. Connection string via DATABASE_URL env var.
 * @module shared/postgres
 */

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://rumshop:rumshop@localhost:5432/rumshop';

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => console.error('[PostgreSQL] Pool error:', err.message));

/**
 * Initialize users table and seed demo user.
 * Retries connection up to 15 times (waits for DB to be ready).
 */
async function initDb(retries = 15) {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          email       VARCHAR(255) PRIMARY KEY,
          name        VARCHAR(255) NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          created_at  TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      const { rows } = await pool.query(
        'SELECT email FROM users WHERE email = $1',
        ['demo@rumshop.com']
      );
      if (rows.length === 0) {
        const hash = bcrypt.hashSync('password123', 10);
        await pool.query(
          'INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3)',
          ['demo@rumshop.com', 'Demo User', hash]
        );
        console.log('[PostgreSQL] Demo user seeded (demo@rumshop.com / password123)');
      }

      console.log('[PostgreSQL] Connected and initialized');
      return;
    } catch (err) {
      console.log(`[PostgreSQL] Waiting for database... (${i + 1}/${retries})`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error('[PostgreSQL] Failed to connect after retries');
}

async function getUserByEmail(email) {
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  if (rows.length === 0) return undefined;
  return {
    email: rows[0].email,
    name: rows[0].name,
    passwordHash: rows[0].password_hash,
    createdAt: rows[0].created_at,
  };
}

async function createUser(email, name, passwordHash) {
  await pool.query(
    'INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3)',
    [email, name, passwordHash]
  );
}

module.exports = { pool, initDb, getUserByEmail, createUser };
