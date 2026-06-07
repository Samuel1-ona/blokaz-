import { Router } from 'express'
import { supabase } from '../db/supabase.js'

const router = Router()

const VALID_ITEM_IDS = new Set(['revivalBundle', 'scoreBoost', 'shield', 'bomb', 'rotatePass'])
const VALID_TOKENS = new Set(['USDC', 'USDT', 'USDm'])

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

/**
 * GET /inventory/:address
 * Returns the server-side inventory + free tries for a player.
 * Called on game load so players recover items after a localStorage wipe.
 */
router.get('/:address', async (req, res) => {
  if (!requireDb(res)) return
  const address = req.params.address

  if (!validateAddress(address)) return res.status(400).json({ error: 'Invalid address' })

  const { data, error } = await supabase
    .from('player_inventory')
    .select('*')
    .eq('address', address.toLowerCase())
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('inventory/get error:', error)
    return res.status(500).json({ error: 'Failed to fetch inventory' })
  }

  if (!data) return res.json({ inventory: null })

  res.json({
    inventory: {
      revivalBundle: data.revival_bundle,
      scoreBoost: data.score_boost,
      shield: data.shield,
      bomb: data.bomb,
      rotatePass: data.rotate_pass,
    },
    freeTries: {
      scoreBoost: data.free_score_boost,
      shield: data.free_shield,
      bomb: data.free_bomb,
      rotatePass: data.free_rotate_pass,
    },
  })
})

/**
 * POST /inventory/sync
 * Syncs the client's current inventory + free tries to the server.
 * Called whenever inventory changes (purchase, use, load).
 *
 * Body: { address, inventory: { revivalBundle, scoreBoost, shield, bomb, rotatePass },
 *         freeTries: { scoreBoost, shield, bomb, rotatePass } }
 */
router.post('/sync', async (req, res) => {
  if (!requireDb(res)) return
  const { address, inventory, freeTries } = req.body

  if (!validateAddress(address)) return res.status(400).json({ error: 'Invalid address' })
  if (!inventory || !freeTries) return res.status(400).json({ error: 'inventory and freeTries required' })

  const { error } = await supabase
    .from('player_inventory')
    .upsert(
      {
        address: address.toLowerCase(),
        revival_bundle: Math.max(0, inventory.revivalBundle ?? 0),
        score_boost: Math.max(0, inventory.scoreBoost ?? 0),
        shield: Math.max(0, inventory.shield ?? 0),
        bomb: Math.max(0, inventory.bomb ?? 0),
        rotate_pass: Math.max(0, inventory.rotatePass ?? 0),
        free_score_boost: Math.max(0, freeTries.scoreBoost ?? 0),
        free_shield: Math.max(0, freeTries.shield ?? 0),
        free_bomb: Math.max(0, freeTries.bomb ?? 0),
        free_rotate_pass: Math.max(0, freeTries.rotatePass ?? 0),
      },
      { onConflict: 'address' }
    )

  if (error) {
    console.error('inventory/sync error:', error)
    return res.status(500).json({ error: 'Failed to sync inventory' })
  }

  res.json({ ok: true })
})

/**
 * POST /inventory/purchase
 * Records a confirmed on-chain purchase and credits inventory server-side.
 * Called after waitForTransactionReceipt resolves successfully.
 *
 * Body: { address, itemId, quantity, tokenSymbol, txHash }
 */
router.post('/purchase', async (req, res) => {
  if (!requireDb(res)) return
  const { address, itemId, quantity, tokenSymbol, txHash } = req.body

  if (!validateAddress(address)) return res.status(400).json({ error: 'Invalid address' })
  if (!VALID_ITEM_IDS.has(itemId)) return res.status(400).json({ error: 'Invalid itemId' })
  if (!VALID_TOKENS.has(tokenSymbol)) return res.status(400).json({ error: 'Invalid tokenSymbol' })
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
    return res.status(400).json({ error: 'Invalid quantity' })
  }

  const addr = address.toLowerCase()

  // Prevent duplicate processing of the same tx
  if (txHash) {
    const { data: existing } = await supabase
      .from('purchase_log')
      .select('id')
      .eq('tx_hash', txHash)
      .limit(1)
      .single()

    if (existing) {
      return res.status(409).json({ error: 'Transaction already processed' })
    }
  }

  // Map itemId to the column name in player_inventory
  const columnMap = {
    revivalBundle: 'revival_bundle',
    scoreBoost: 'score_boost',
    shield: 'shield',
    bomb: 'bomb',
    rotatePass: 'rotate_pass',
  }
  const column = columnMap[itemId]

  // Log the purchase + credit inventory atomically using an RPC function
  // (falls back to two sequential writes if the RPC doesn't exist yet)
  const [logResult, invResult] = await Promise.all([
    supabase.from('purchase_log').insert({
      address: addr,
      item_id: itemId,
      quantity,
      token_symbol: tokenSymbol,
      tx_hash: txHash ?? null,
    }),
    supabase.rpc('increment_inventory', {
      p_address: addr,
      p_column: column,
      p_qty: quantity,
    }).then(r => {
      // If the RPC doesn't exist yet, fall back to read-modify-write
      if (r.error?.code === 'PGRST202') {
        return supabase
          .from('player_inventory')
          .select(column)
          .eq('address', addr)
          .single()
          .then(({ data }) => {
            const current = data?.[column] ?? 0
            return supabase
              .from('player_inventory')
              .upsert({ address: addr, [column]: current + quantity }, { onConflict: 'address' })
          })
      }
      return r
    }),
  ])

  if (logResult.error) console.error('purchase_log insert error:', logResult.error)
  if (invResult.error) {
    console.error('inventory credit error:', invResult.error)
    return res.status(500).json({ error: 'Failed to credit inventory' })
  }

  res.json({ ok: true })
})

/**
 * GET /inventory/purchases/:address
 * Returns the full purchase history for an address.
 * Useful for dispute resolution and player-facing receipts.
 */
router.get('/purchases/:address', async (req, res) => {
  if (!requireDb(res)) return
  const address = req.params.address

  if (!validateAddress(address)) return res.status(400).json({ error: 'Invalid address' })

  const { data, error } = await supabase
    .from('purchase_log')
    .select('item_id, quantity, token_symbol, tx_hash, created_at')
    .eq('address', address.toLowerCase())
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('purchases/get error:', error)
    return res.status(500).json({ error: 'Failed to fetch purchases' })
  }

  res.json({ purchases: data ?? [] })
})

export default router
