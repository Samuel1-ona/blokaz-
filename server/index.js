import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import morgan from 'morgan'
import dotenv from 'dotenv'
dotenv.config()

import { globalLimiter } from './middleware/rateLimits.js'
import signRouter, { account, publicClient, TOURNAMENT_ADDRESS } from './routes/sign.js'
import sessionRouter from './routes/session.js'
import inventoryRouter from './routes/inventory.js'

const app = express()

// ── Request logging ──────────────────────────────────────────────────────────
app.use(morgan('dev'))

// ── Security headers ────────────────────────────────────────────────────────
app.use(helmet())

// Bypass localtunnel's interstitial warning page for API requests
app.use((_req, res, next) => {
  res.setHeader('Bypass-Tunnel-Reminder', 'true')
  next()
})

// ── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      cb(null, true)
    } else {
      cb(new Error(`CORS: origin ${origin} not allowed`))
    }
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}))

// ── Compression ──────────────────────────────────────────────────────────────
app.use(compression())

// ── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '256kb' }))

// ── Global rate limit ────────────────────────────────────────────────────────
app.use(globalLimiter)

// ── Request timeout ──────────────────────────────────────────────────────────
app.use((_req, res, next) => {
  res.setTimeout(10_000, () => {
    res.status(503).json({ error: 'Request timeout' })
  })
  next()
})

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/', signRouter)
app.use('/session', sessionRouter)
app.use('/inventory', inventoryRouter)

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }))

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }))

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err.message)
  res.status(500).json({ error: 'Internal server error' })
})

// ── Graceful shutdown ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001
const server = app.listen(PORT, async () => {
  console.log(`Blokz server running on port ${PORT}`)
  console.log(`Signer address: ${account.address}`)
  console.log(`Tournament proxy: ${TOURNAMENT_ADDRESS}`)
  console.log(`RPC: ${process.env.RPC_URL}`)
  console.log(`Supabase: ${process.env.SUPABASE_URL ? 'connected' : 'NOT CONFIGURED'}`)

  try {
    const code = await publicClient.getBytecode({ address: TOURNAMENT_ADDRESS })
    console.log(code && code !== '0x' ? 'Contract bytecode verified OK' : 'WARNING: No contract code at TOURNAMENT_ADDRESS')
  } catch (err) {
    console.error('Failed to verify contract on startup:', err.message)
  }
})

function shutdown(signal) {
  console.log(`${signal} received — shutting down gracefully`)
  server.close(() => { console.log('Server closed'); process.exit(0) })
  setTimeout(() => process.exit(1), 10_000)
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
