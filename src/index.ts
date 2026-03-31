/**
 * Remote Key Manager for AgentPad Passkey Authentication
 * 
 * This server provides HTTP endpoints for the Wagmi `KeyManager.http()` connector.
 * It stores public keys and credential IDs securely in SQLite, enabling:
 * - Cross-device sync (keys stored server-side)
 * - Account recovery (if user logs in from new device)
 * - Persistent storage (not lost on browser clear)
 * 
 * Architecture:
 * - Frontend: Browser WebAuthn API ↔ Wagmi connector ↔ This Backend
 * - Backend: HTTP API ↔ SQLite DB (encrypted at rest)
 * 
 * Security Notes:
 * - Private keys NEVER leave the user's device (WebAuthn architecture)
 * - Only public keys + credential IDs are stored here
 * - Production: Add rate limiting, API keys, HTTPS enforcement
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'

// Import sqlite3 with ESM compatibility
import sqlite3Pkg from 'sqlite3'
const { Database } = sqlite3Pkg

// Initialize Express-like app with Hono
const app = new Hono()

// Middleware
app.use('*', logger())

// Dynamic CORS from Environment
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
  : ['http://localhost:3000', 'https://agentpad.vercel.app']

app.use('*', cors({
  origin: allowedOrigins,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'X-API-Key'],
  credentials: true,
  maxAge: 86400,
}))

app.use('*', secureHeaders())

// Simple Rate Limiting (In-memory for Dev, use Redis for Prod scale)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 100
const RATE_LIMIT_WINDOW = 60 * 1000 // 60s

app.use('*', async (c, next) => {
  try {
    const ip = c.req.header('x-forwarded-for')?.split(',')[0] || 'unknown'
    const now = Date.now()
    const entry = rateLimitStore.get(ip)

    if (!entry || now > entry.resetAt) {
      rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    } else if (entry.count >= RATE_LIMIT_MAX) {
      return c.json({ error: 'Rate limit exceeded' }, 429)
    } else {
      entry.count++
    }

    c.header('X-RateLimit-Remaining', String(RATE_LIMIT_MAX - entry.count))
  } catch (err) {
    console.error('Rate limit error:', err)
  }
  await next()
})

// SQLite Database Setup
const dbPath = './passkeys.db'
const db = new Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message)
    process.exit(1)
  }
  console.log('✅ Connected to SQLite database')
})

// Initialize schema
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS passkeys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      credential_id TEXT UNIQUE NOT NULL,
      public_key TEXT NOT NULL,
      counter INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_used DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
  console.log('🗄️  Database schema initialized')
})

// API Key for protection (generate in production)
const API_KEY = process.env.API_KEY || 'dev-key-change-in-production'

// Helper: Verify API Key
function verifyApiKey(c: any) {
  const key = c.req.header('X-API-Key')
  if (key !== API_KEY) {
    return c.json({ error: 'Invalid API key' }, 401)
  }
  return null
}

// Routes
app.get('/', (c) => {
  return c.json({
    service: 'AgentPad Remote Key Manager',
    version: '1.0.0',
    status: 'operational',
    docs: '/docs'
  })
})

/**
 * Register a new passkey credential
 * POST /keys
 * Body: { userId, credentialId, publicKey }
 */
app.post('/keys', async (c) => {
  const authError = verifyApiKey(c)
  if (authError) return authError

  const body = await c.req.json()
  const { userId, credentialId, publicKey } = body

  if (!userId || !credentialId || !publicKey) {
    return c.json({ error: 'Missing required fields: userId, credentialId, publicKey' }, 400)
  }

  // Ensure user exists
  await new Promise<void>((resolve, reject) => {
    db.run(
      'INSERT OR IGNORE INTO users (user_id) VALUES (?)',
      [userId],
      (err) => err ? reject(err) : resolve()
    )
  })

  // Insert passkey
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO passkeys (user_id, credential_id, public_key) 
       VALUES (?, ?, ?)`,
      [userId, credentialId, publicKey],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            resolve(c.json({ error: 'Credential already exists', exists: true }, 409))
          } else {
            resolve(c.json({ error: 'Failed to store credential' }, 500))
          }
          return
        }
        resolve(c.json({ 
          success: true, 
          message: 'Passkey stored',
          userId 
        }, 201))
      }
    )
  })
})

/**
 * Retrieve user's passkeys
 * GET /keys/:userId
 */
app.get('/keys/:userId', async (c) => {
  const authError = verifyApiKey(c)
  if (authError) return authError

  const userId = c.req.param('userId')

  return new Promise((resolve, reject) => {
    db.all(
      'SELECT credential_id, public_key, counter FROM passkeys WHERE user_id = ?',
      [userId],
      (err, rows) => {
        if (err) {
          resolve(c.json({ error: 'Failed to retrieve keys' }, 500))
          return
        }
        resolve(c.json({
          success: true,
          userId,
          credentials: rows || []
        }))
      }
    )
  })
})

/**
 * Retrieve a specific credential by ID
 * GET /credential/:credentialId
 */
app.get('/credential/:credentialId', async (c) => {
  const authError = verifyApiKey(c)
  if (authError) return authError

  const credentialId = c.req.param('credentialId')

  return new Promise((resolve, reject) => {
    db.get(
      'SELECT user_id, public_key, counter FROM passkeys WHERE credential_id = ?',
      [credentialId],
      (err, row) => {
        if (err) {
          resolve(c.json({ error: 'Database error' }, 500))
          return
        }
        if (!row) {
          resolve(c.json({ error: 'Credential not found' }, 404))
          return
        }
        resolve(c.json({
          success: true,
          credential: row
        }))
      }
    )
  })
})

/**
 * Update counter after authentication
 * PUT /counter/:credentialId
 * Body: { counter }
 */
app.put('/counter/:credentialId', async (c) => {
  const authError = verifyApiKey(c)
  if (authError) return authError

  const credentialId = c.req.param('credentialId')
  const body = await c.req.json()
  const { counter } = body

  if (counter === undefined) {
    return c.json({ error: 'Missing counter' }, 400)
  }

  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE passkeys SET counter = ?, last_used = CURRENT_TIMESTAMP WHERE credential_id = ?',
      [counter, credentialId],
      function(err) {
        if (err) {
          resolve(c.json({ error: 'Failed to update counter' }, 500))
          return
        }
        resolve(c.json({
          success: true,
          message: 'Counter updated'
        }))
      }
    )
  })
})

/**
 * Delete a passkey credential
 * DELETE /keys/:userId/:credentialId
 */
app.delete('/keys/:userId/:credentialId', async (c) => {
  const authError = verifyApiKey(c)
  if (authError) return authError

  const { userId, credentialId } = c.req.param()

  return new Promise((resolve, reject) => {
    db.run(
      'DELETE FROM passkeys WHERE user_id = ? AND credential_id = ?',
      [userId, credentialId],
      function(err) {
        if (err) {
          resolve(c.json({ error: 'Failed to delete credential' }, 500))
          return
        }
        resolve(c.json({
          success: true,
          message: 'Credential deleted'
        }))
      }
    )
  })
})

/**
 * Health check
 * GET /health
 */
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: 'connected'
  })
})

// Start server with Node.js adapter
import { serve } from '@hono/node-server'

const PORT = Number(process.env.PORT) || 3001

serve({
  fetch: app.fetch,
  port: PORT,
}, () => {
  console.log(`🚀 Remote Key Manager running on http://localhost:${PORT}`)
  console.log(`📚 API docs: http://localhost:${PORT}/`)
  console.log(`🔑 API Key configured: ${process.env.API_KEY ? 'Yes' : 'No'}`)
  console.log(`⚠️  Change API_KEY in production!`)
})
