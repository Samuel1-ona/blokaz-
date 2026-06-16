// PowerUpHintManager — automated board shadow hints that fire at psychologically
// timed moments to guide users toward power-up purchases. Each type has its own
// cooldown so hints can cycle without colliding. The canvas effect is decoupled
// from the DOM hand animation: update() fires onAutoTrigger (→ React overlay),
// and the overlay calls commitCanvasHint() ~1050ms later to start the board effect.

export type HintType = 'bomb' | 'shield' | 'scoreBoost' | 'rotatePass'

interface BombHint       { type: 'bomb';        targetRow: number; targetCol: number }
interface ShieldHint     { type: 'shield';      columns: number[] }
interface ScoreBoostHint { type: 'scoreBoost' }
interface RotatePassHint { type: 'rotatePass' }

type HintData = (BombHint | ShieldHint | ScoreBoostHint | RotatePassHint) & { phase: number }

const P_EFFECT_END = 0.85

export class PowerUpHintManager {
  private hint: HintData | null = null

  // Per-type cooldowns (ms timestamp until each type may fire again)
  private cooldowns: Record<HintType, number> = {
    bomb: 0, shield: 0, scoreBoost: 0, rotatePass: 0,
  }

  // Global minimum gap between any two hints
  private lastHintAt = -Infinity
  private readonly MIN_HINT_GAP = 18_000   // 18s between any two hints

  private lastPiecePlacedAt = -Infinity
  private lastLineClearAt   = -Infinity

  private onAutoTrigger: ((type: HintType) => void) | null = null

  private readonly DURATION = 5500

  // How long after the triggering event before the hint fires
  private readonly IDLE_BEFORE: Record<HintType, number> = {
    scoreBoost: 900,   // show quickly after line clear — "multiply those points!"
    bomb:       2500,  // brief pause then show bomb for a nearly-full line
    shield:     4000,  // a bit longer — let the danger sink in first
    rotatePass: 6000,  // user has been stuck a while before we suggest rotating
  }

  // Per-type cooldowns after a hint plays
  private readonly COOLDOWNS: Record<HintType, number> = {
    scoreBoost: 90_000,
    bomb:       45_000,
    shield:     60_000,
    rotatePass: 50_000,
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Register the React callback that kicks off the DOM hand animation. */
  setAutoTriggerCallback(cb: (type: HintType) => void): void {
    this.onAutoTrigger = cb
  }

  /** Call on every piece placement to reset the idle timer. */
  notifyPiecePlaced(now: number): void {
    this.lastPiecePlacedAt = now
    if (this.hint) {
      // Interrupt the canvas animation; apply a short per-type cooldown
      const type = this.hint.type
      this.hint = null
      this.cooldowns[type] = Math.max(this.cooldowns[type], now + 8_000)
      this.lastHintAt = now
    }
  }

  /** Call whenever the engine clears at least one line. */
  notifyLineClear(now: number): void {
    this.lastLineClearAt = now
  }

  /**
   * Called by PowerUpHintOverlay at t≈1050ms to start the canvas board effect.
   * Decoupled from the auto-trigger so the hand animation plays first.
   */
  commitCanvasHint(type: HintType, grid?: Uint8Array): void {
    switch (type) {
      case 'bomb':
        this.hint = grid ? { ...buildBombHint(grid), phase: 0 } : null
        break
      case 'shield':
        this.hint = grid ? { ...buildShieldHint(grid), phase: 0 } : null
        break
      case 'scoreBoost':
        this.hint = { type: 'scoreBoost', phase: 0 }
        break
      case 'rotatePass':
        this.hint = { type: 'rotatePass', phase: 0 }
        break
    }
  }

  /** Advance state and decide whether to fire a new auto-hint. */
  update(now: number, dt: number, grid: Uint8Array, canShow: boolean): void {
    // Advance active canvas animation
    if (this.hint) {
      if (!canShow) {
        this.hint = null
        return
      }
      this.hint.phase = Math.min(1, this.hint.phase + dt / this.DURATION)
      if (this.hint.phase >= 1) this.hint = null
      return
    }

    if (!canShow || !this.onAutoTrigger) return

    // Respect global gap between hints
    if (now < this.lastHintAt + this.MIN_HINT_GAP) return

    const fillRatio   = countFilled(grid) / 81
    const idleMs      = now - this.lastPiecePlacedAt
    const lineClearAgo = now - this.lastLineClearAt

    // ── 1. Score Boost ── right after a line clear: "multiply those points!"
    if (
      lineClearAgo < 2500 &&
      lineClearAgo >= this.IDLE_BEFORE.scoreBoost &&
      now > this.cooldowns.scoreBoost
    ) {
      this._fire('scoreBoost', now)
      return
    }

    // ── 2. Bomb ── when a row or column is nearly full (7+ cells)
    if (
      idleMs >= this.IDLE_BEFORE.bomb &&
      now > this.cooldowns.bomb &&
      fillRatio > 0.28 &&
      this._hasNearFullLine(grid)
    ) {
      this._fire('bomb', now)
      return
    }

    // ── 3. Shield ── board is dangerously dense
    if (
      idleMs >= this.IDLE_BEFORE.shield &&
      now > this.cooldowns.shield &&
      fillRatio >= 0.62
    ) {
      this._fire('shield', now)
      return
    }

    // ── 4. Rotate Pass ── medium fill + player has been idle (stuck)
    if (
      idleMs >= this.IDLE_BEFORE.rotatePass &&
      now > this.cooldowns.rotatePass &&
      fillRatio >= 0.35 &&
      fillRatio < 0.62
    ) {
      this._fire('rotatePass', now)
      return
    }
  }

  /** Draw the canvas board shadow effect. Call after gridRenderer.draw(). */
  draw(ctx: CanvasRenderingContext2D, cs: number): void {
    if (!this.hint) return

    const p = this.hint.phase
    const masterAlpha = p < 0.08 ? p / 0.08 : p > P_EFFECT_END ? (1 - p) / 0.15 : 1
    if (masterAlpha < 0.01) return

    ctx.save()
    ctx.shadowBlur = 0

    switch (this.hint.type) {
      case 'bomb':
        drawBombEffect(ctx, (this.hint as BombHint).targetRow, (this.hint as BombHint).targetCol, p, masterAlpha, cs)
        break
      case 'shield':
        drawShieldEffect(ctx, (this.hint as ShieldHint).columns, p, masterAlpha, cs)
        break
      case 'scoreBoost':
        drawScoreBoostEffect(ctx, p, masterAlpha, cs)
        break
      case 'rotatePass':
        drawRotatePassEffect(ctx, p, masterAlpha, cs)
        break
    }

    ctx.restore()
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private _fire(type: HintType, now: number): void {
    this.cooldowns[type] = now + this.COOLDOWNS[type]
    this.lastHintAt = now
    this.onAutoTrigger!(type)
  }

  private _hasNearFullLine(grid: Uint8Array): boolean {
    for (let r = 0; r < 9; r++) {
      let f = 0
      for (let c = 0; c < 9; c++) if (grid[r * 9 + c] !== 0) f++
      if (f >= 7) return true
    }
    for (let c = 0; c < 9; c++) {
      let f = 0
      for (let r = 0; r < 9; r++) if (grid[r * 9 + c] !== 0) f++
      if (f >= 7) return true
    }
    return false
  }
}

// ─── Board canvas effects ─────────────────────────────────────────────────────

function drawBombEffect(
  ctx: CanvasRenderingContext2D,
  targetRow: number, targetCol: number,
  p: number, alpha: number, cs: number,
): void {
  const C = '#F5A623'
  const sweepR = Math.min(p * 10, 9.5)

  ctx.shadowColor = C
  ctx.shadowBlur  = cs * 0.25

  for (let c = 0; c < 9; c++) {
    const dist  = Math.abs(c - targetCol)
    const cellA = Math.max(0, Math.min(1, (sweepR - dist) * 0.8)) * alpha * 0.45
    if (cellA < 0.01) continue
    ctx.globalAlpha = cellA
    ctx.fillStyle   = C
    ctx.fillRect(c * cs + 2, targetRow * cs + 2, cs - 4, cs - 4)
  }
  for (let r = 0; r < 9; r++) {
    if (r === targetRow) continue
    const dist  = Math.abs(r - targetRow)
    const cellA = Math.max(0, Math.min(1, (sweepR - dist) * 0.8)) * alpha * 0.45
    if (cellA < 0.01) continue
    ctx.globalAlpha = cellA
    ctx.fillStyle   = C
    ctx.fillRect(targetCol * cs + 2, r * cs + 2, cs - 4, cs - 4)
  }

  const strokeA = Math.min(1, p * 2) * alpha * 0.7
  ctx.globalAlpha = strokeA
  ctx.strokeStyle = C
  ctx.lineWidth   = Math.max(1, cs * 0.045)
  ctx.setLineDash([cs * 0.2, cs * 0.15])
  ctx.strokeRect(1, targetRow * cs + 1, cs * 9 - 2, cs - 2)
  ctx.strokeRect(targetCol * cs + 1, 1, cs - 2, cs * 9 - 2)
  ctx.setLineDash([])
  ctx.shadowBlur = 0
}

function drawShieldEffect(
  ctx: CanvasRenderingContext2D,
  columns: number[], p: number, alpha: number, cs: number,
): void {
  const C = '#4A9EFF'
  const sweepRow = p * 9

  ctx.shadowColor = C
  ctx.shadowBlur  = cs * 0.2

  for (const col of columns) {
    for (let r = 0; r < 9; r++) {
      if (r >= sweepRow) continue
      const depth = Math.min(sweepRow - r, 2)
      const cellA = (depth / 2) * alpha * 0.48
      if (cellA < 0.01) continue
      ctx.globalAlpha = cellA
      ctx.fillStyle   = C
      ctx.fillRect(col * cs + 2, r * cs + 2, cs - 4, cs - 4)
    }
    const fr = Math.floor(sweepRow)
    if (fr < 9) {
      const frac = sweepRow - fr
      ctx.globalAlpha = frac * alpha * 0.9
      ctx.fillStyle   = '#fff'
      ctx.fillRect(col * cs + 3, fr * cs + 3, cs - 6, cs - 6)
    }
    const borderA = Math.min(1, p * 2.5) * alpha * 0.6
    ctx.globalAlpha = borderA
    ctx.strokeStyle = C
    ctx.lineWidth   = Math.max(1, cs * 0.045)
    ctx.setLineDash([cs * 0.18, cs * 0.14])
    ctx.strokeRect(col * cs + 2, 2, cs - 4, cs * 9 - 4)
    ctx.setLineDash([])
  }
  ctx.shadowBlur = 0
}

function drawScoreBoostEffect(
  ctx: CanvasRenderingContext2D,
  p: number, alpha: number, cs: number,
): void {
  const C = '#FFD51F'
  const cx = cs * 4.5
  const cy = cs * 4.5
  const maxR = cs * 7.5

  const ringR = p * maxR
  const ringA = p < 0.55 ? 1 : 1 - (p - 0.55) / 0.45
  if (ringA > 0.01) {
    ctx.globalAlpha = ringA * alpha * 0.85
    ctx.strokeStyle = C
    ctx.lineWidth   = Math.max(2, cs * 0.1)
    ctx.shadowColor = C
    ctx.shadowBlur  = cs * 0.35
    ctx.beginPath()
    ctx.arc(cx, cy, ringR, 0, Math.PI * 2)
    ctx.stroke()
    ctx.shadowBlur = 0

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const dx = (c + 0.5) * cs - cx
        const dy = (r + 0.5) * cs - cy
        if (Math.sqrt(dx * dx + dy * dy) > ringR) continue
        const cellA = Math.min(1, (ringR - Math.sqrt(dx * dx + dy * dy)) / (cs * 1.5)) * ringA * alpha * 0.42
        if (cellA < 0.01) continue
        ctx.globalAlpha = cellA
        ctx.fillStyle   = C
        ctx.fillRect(c * cs + 2, r * cs + 2, cs - 4, cs - 4)
      }
    }
  }

  const textA = p < 0.25 ? p / 0.25 : p > 0.78 ? (1 - p) / 0.22 : 1
  if (textA > 0.01) {
    const fontSize = Math.max(14, cs * 0.9)
    ctx.font = `bold ${fontSize}px 'Courier New', monospace`
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'
    ctx.globalAlpha  = textA * alpha * 0.95
    ctx.shadowColor  = '#000'
    ctx.shadowBlur   = cs * 0.15
    ctx.fillStyle    = C
    ctx.fillText('×2', cx, cy)
    ctx.shadowBlur   = 0
    ctx.textAlign    = 'left'
  }
}

function drawRotatePassEffect(
  ctx: CanvasRenderingContext2D,
  p: number, alpha: number, cs: number,
): void {
  const C = '#38BDF8'
  const trayY = cs * 9
  const slotCenters = [
    { x: cs * 1.5, y: trayY + cs * 1.5 },
    { x: cs * 4.5, y: trayY + cs * 1.5 },
    { x: cs * 7.5, y: trayY + cs * 1.5 },
  ]

  const spin = p * Math.PI * 3

  ctx.strokeStyle = C
  ctx.lineWidth   = Math.max(1.5, cs * 0.07)
  ctx.lineCap     = 'round'
  ctx.shadowColor = C
  ctx.shadowBlur  = cs * 0.18

  for (let i = 0; i < 3; i++) {
    const { x, y } = slotCenters[i]
    const delay  = i * 0.12
    const localP = Math.max(0, Math.min(1, (p - delay) / (1 - delay)))
    if (localP <= 0) continue

    const envA = localP < 0.12 ? localP / 0.12 : localP > 0.78 ? (1 - localP) / 0.22 : 1
    const r    = cs * 0.7

    ctx.globalAlpha = envA * alpha * 0.9

    ctx.setLineDash([cs * 0.15, cs * 0.12])
    ctx.strokeRect(x - r, y - r, r * 2, r * 2)
    ctx.setLineDash([])

    const startA = spin + (i * Math.PI * 2) / 3
    const endA   = startA + Math.PI * 1.6
    ctx.globalAlpha = envA * alpha
    ctx.beginPath()
    ctx.arc(x, y, r * 0.68, startA, endA)
    ctx.stroke()

    const ax  = x + Math.cos(endA) * r * 0.68
    const ay  = y + Math.sin(endA) * r * 0.68
    const tan = endA + Math.PI / 2
    const as  = cs * 0.14
    ctx.beginPath()
    ctx.moveTo(ax, ay)
    ctx.lineTo(ax - Math.cos(tan - 0.5) * as, ay - Math.sin(tan - 0.5) * as)
    ctx.moveTo(ax, ay)
    ctx.lineTo(ax - Math.cos(tan + 0.5) * as, ay - Math.sin(tan + 0.5) * as)
    ctx.stroke()
  }

  ctx.lineCap    = 'butt'
  ctx.shadowBlur = 0
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function countFilled(grid: Uint8Array): number {
  let n = 0
  for (let i = 0; i < 81; i++) if (grid[i] !== 0) n++
  return n
}

function buildBombHint(grid: Uint8Array): BombHint {
  let bestRow = 0, bestRowFill = -1, bestCol = 0, bestColFill = -1
  for (let r = 0; r < 9; r++) {
    let f = 0; for (let c = 0; c < 9; c++) if (grid[r * 9 + c] !== 0) f++
    if (f > bestRowFill) { bestRowFill = f; bestRow = r }
  }
  for (let c = 0; c < 9; c++) {
    let f = 0; for (let r = 0; r < 9; r++) if (grid[r * 9 + c] !== 0) f++
    if (f > bestColFill) { bestColFill = f; bestCol = c }
  }
  return { type: 'bomb', targetRow: bestRow, targetCol: bestCol }
}

function buildShieldHint(grid: Uint8Array): ShieldHint {
  const fills = Array.from({ length: 9 }, (_, c) => {
    let n = 0; for (let r = 0; r < 9; r++) if (grid[r * 9 + c] !== 0) n++
    return { c, n }
  })
  return { type: 'shield', columns: fills.sort((a, b) => b.n - a.n).slice(0, 3).map(x => x.c) }
}
