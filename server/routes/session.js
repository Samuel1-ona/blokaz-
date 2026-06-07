import { Router } from 'express'
import { supabase } from '../db/supabase.js'
import { syncLimiter } from '../middleware/rateLimits.js'

const router = Router()

function requireDb(res) {
  if (!supabase) {
    res.status(503).json({ error: 'Session persistence not configured' })
    return false
  }
  return true
}

function validateAddress(address) {
  return typeof address === 'string' && /^0x[0-9a-fA-F]{40}$/.test(address)
}

function validateSeed(seed) {
  return seed != null && String(seed).length > 0 && String(seed).length < 100
}

/**
 * POST /session/start
 * Registers a new game. Abandons any previous active session for this address.
 */
router.post('/start', async (req, res) => {
  if (!requireDb(res)) return
  const { address, seed, onChainGameId, onChainSeed } = req.body

  if (!validateAddress(address)) return res.status(400).json({ error: 'Invalid address' })
  if (!validateSeed(seed)) return res.status(400).json({ error: 'Invalid seed' })

  const addr = address.toLowerCase()

  // Abandon stale active sessions in one shot
  await supabase
    .from('game_sessions')
    .update({ status: 'abandoned' })
    .eq('address', addr)
    .eq('status', 'active')

  const { data, error } = await supabase
    .from('game_sessions')
    .insert({
      address: addr,
      seed: String(seed),
      on_chain_game_id: onChainGameId ? String(onChainGameId) : null,
      on_chain_seed: onChainSeed ?? null,
      move_history: [],
      score: 0,
      score_boost_active: false,
      is_game_over: false,
      revive_count: 0,
      status: 'active',
    })
    .select('id')
    .single()

  if (error) {
    console.error('session/start error:', error)
    return res.status(500).json({ error: 'Failed to start session' })
  }

  res.json({ sessionId: data.id })
})

/**
 * POST /session/sync
 * Hot path — called after every move for every player.
 * Uses a single upsert (requires unique index on address+seed where status='active').
 * Rate-limited to 60 req/min per IP.
 */
router.post('/sync', syncLimiter, async (req, res) => {
  if (!requireDb(res)) return
  const {
    address, seed, moveHistory, score,
    scoreBoostActive, isGameOver, reviveCount,
    onChainGameId, onChainSeed,
  } = req.body

  if (!validateAddress(address)) return res.status(400).json({ error: 'Invalid address' })
  if (!validateSeed(seed)) return res.status(400).json({ error: 'Invalid seed' })
  if (!Array.isArray(moveHistory)) return res.status(400).json({ error: 'moveHistory must be an array' })

  const addr = address.toLowerCase()

  // Single upsert — no SELECT needed. Relies on the partial unique index:
  //   CREATE UNIQUE INDEX idx_unique_active_session ON game_sessions (address, seed)
  //   WHERE status = 'active';
  const { error } = await supabase
    .from('game_sessions')
    .upsert(
      {
        address: addr,
        seed: String(seed),
        status: 'active',
        move_history: moveHistory,
        score: score ?? 0,
        score_boost_active: !!scoreBoostActive,
        is_game_over: !!isGameOver,
        revive_count: reviveCount ?? 0,
        ...(onChainGameId != null && { on_chain_game_id: String(onChainGameId) }),
        ...(onChainSeed != null && { on_chain_seed: onChainSeed }),
      },
      { onConflict: 'address,seed', ignoreDuplicates: false }
    )

  if (error) {
    console.error('session/sync error:', error)
    return res.status(500).json({ error: 'Failed to sync session' })
  }

  res.json({ ok: true })
})

/**
 * GET /session/restore/:address
 * Returns the latest active session for recovery after a browser crash or
 * localStorage wipe.
 */
router.get('/restore/:address', async (req, res) => {
  if (!requireDb(res)) return
  const address = req.params.address

  if (!validateAddress(address)) return res.status(400).json({ error: 'Invalid address' })

  const { data, error } = await supabase
    .from('game_sessions')
    .select('*')
    .eq('address', address.toLowerCase())
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('session/restore error:', error)
    return res.status(500).json({ error: 'Failed to restore session' })
  }

  if (!data) return res.json({ session: null })

  res.json({
    session: {
      address: data.address,
      seed: data.seed,
      onChainGameId: data.on_chain_game_id,
      onChainSeed: data.on_chain_seed,
      moveHistory: data.move_history,
      score: data.score,
      scoreBoostActive: data.score_boost_active,
      isGameOver: data.is_game_over,
      reviveCount: data.revive_count,
      updatedAt: data.updated_at,
    },
  })
})

/**
 * POST /session/complete
 * Marks a session as submitted after successful on-chain score submission.
 */
router.post('/complete', async (req, res) => {
  if (!requireDb(res)) return
  const { address, seed } = req.body

  if (!validateAddress(address)) return res.status(400).json({ error: 'Invalid address' })
  if (!validateSeed(seed)) return res.status(400).json({ error: 'Invalid seed' })

  const { error } = await supabase
    .from('game_sessions')
    .update({ status: 'submitted' })
    .eq('address', address.toLowerCase())
    .eq('seed', String(seed))
    .eq('status', 'active')

  if (error) {
    console.error('session/complete error:', error)
    return res.status(500).json({ error: 'Failed to complete session' })
  }

  res.json({ ok: true })
})

export default router
