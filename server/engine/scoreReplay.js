/**
 * Server-side score replay validator.
 *
 * Fully re-simulates a client-submitted move history with the same rules as
 * the client engine (src/engine/game.ts + scoring.ts + rng.ts):
 *
 *   - Deterministic piece deals from the game seed (RNG + weighted catalog)
 *   - Piece placements incl. Rotate Pass rotations
 *   - Line clears, combo streaks, milestone bonuses
 *   - Bomb (full row + column cross, combo-feeding, boost ×3 cell points)
 *   - Shield revives (clears the recorded columns, restores the combo streak)
 *   - Plain revives (fresh trio, board untouched)
 *   - Lottery markers (flat +500 bonus, ×2 multiplier for 3 placements)
 *
 * Per-move points are recomputed server-side. The only client-trusted degree of
 * freedom is whether Score Boost was active for a given move (base points ×2),
 * since boost activation is client-side state — each move's totalPoints must
 * match either the boosted or unboosted expected value exactly.
 */

import { SHAPES, TOTAL_WEIGHT, SHAPE_MAP } from './shapesCatalog.js'

const GRID_SIZE = 9
const MILESTONE_BONUS = { 3: 300, 5: 750, 10: 2000 }
const MAX_MOVES = 5000
const LOTTERY_BONUS_POINTS = 500
const MAX_LOTTERY_MARKERS = 5 // per kind; lottery is classic-only today, keep tournament abuse bounded

// ── Deterministic RNG (port of src/engine/rng.ts) ─────────────────────────────

const MASK64 = 0xffffffffffffffffn

class DeterministicRNG {
  constructor(seed) {
    this.s0 = seed & MASK64
    this.s1 = (seed ^ 0xdeadbeefcafen) & MASK64
    if (this.s0 === 0n && this.s1 === 0n) this.s1 = 0xdeadbeefcafen
  }

  next() {
    let s1 = this.s0
    const s0 = this.s1
    this.s0 = s0
    s1 ^= (s1 << 23n) & MASK64
    s1 ^= (s1 >> 17n) & MASK64
    s1 ^= s0
    s1 ^= (s0 >> 26n) & MASK64
    this.s1 = s1 & MASK64
    const sum = (this.s0 + this.s1) & 0xffffffffn
    return Number(sum) / 0x100000000
  }
}

function selectShape(rng) {
  const threshold = rng.next() * TOTAL_WEIGHT
  let accumulator = 0
  for (const shape of SHAPES) {
    accumulator += shape.spawnWeight
    if (threshold < accumulator) return shape
  }
  return SHAPES[SHAPES.length - 1]
}

function dealThree(rng) {
  return [selectShape(rng), selectShape(rng), selectShape(rng)]
}

// ── Grid utilities ────────────────────────────────────────────────────────────

function createGrid() {
  return new Uint8Array(GRID_SIZE * GRID_SIZE)
}

// Mirrors rotatePieceShape() in src/engine/game.ts (90° CW + re-normalise)
function rotateCells(cells) {
  const maxR = Math.max(...cells.map(([r]) => r))
  const rotated = cells.map(([r, c]) => [c, maxR - r])
  const minR = Math.min(...rotated.map(([r]) => r))
  const minC = Math.min(...rotated.map(([, c]) => c))
  return rotated.map(([r, c]) => [r - minR, c - minC])
}

function canPlace(grid, cells, row, col) {
  for (const [dr, dc] of cells) {
    const r = row + dr, c = col + dc
    if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE) return false
    if (grid[r * GRID_SIZE + c] !== 0) return false
  }
  return true
}

function placeShape(grid, cells, row, col, colorId) {
  for (const [dr, dc] of cells) {
    grid[(row + dr) * GRID_SIZE + (col + dc)] = colorId
  }
}

function findAndClearLines(grid) {
  const rows = [], cols = []
  for (let r = 0; r < GRID_SIZE; r++) {
    let full = true
    for (let c = 0; c < GRID_SIZE; c++) {
      if (grid[r * GRID_SIZE + c] === 0) { full = false; break }
    }
    if (full) rows.push(r)
  }
  for (let c = 0; c < GRID_SIZE; c++) {
    let full = true
    for (let r = 0; r < GRID_SIZE; r++) {
      if (grid[r * GRID_SIZE + c] === 0) { full = false; break }
    }
    if (full) cols.push(c)
  }
  const toClear = new Set()
  for (const r of rows) for (let c = 0; c < GRID_SIZE; c++) toClear.add(r * GRID_SIZE + c)
  for (const c of cols) for (let r = 0; r < GRID_SIZE; r++) toClear.add(r * GRID_SIZE + c)
  for (const idx of toClear) grid[idx] = 0
  return rows.length + cols.length
}

function clearColumns(grid, cols) {
  for (const col of cols) {
    for (let r = 0; r < GRID_SIZE; r++) grid[r * GRID_SIZE + col] = 0
  }
}

// Mirrors shieldRevive()'s column selection (stable sort, count desc)
function mostFilledColumns(grid, n) {
  const fillCounts = Array.from({ length: GRID_SIZE }, (_, col) => {
    let count = 0
    for (let r = 0; r < GRID_SIZE; r++) {
      if (grid[r * GRID_SIZE + col] !== 0) count++
    }
    return { col, count }
  })
  return fillCounts
    .sort((a, b) => b.count - a.count)
    .slice(0, n)
    .map((x) => x.col)
}

// ── Scoring (port of src/engine/scoring.ts) ───────────────────────────────────

function getComboMultiplier(streak) {
  if (streak >= 10) return 4.0
  if (streak >= 7)  return 3.0
  if (streak >= 5)  return 2.5
  if (streak >= 3)  return 2.0
  if (streak >= 2)  return 1.5
  if (streak >= 1)  return 1.25
  return 1.0
}

// Expected totalPoints for a placement given base points, matching calculateScore()
function expectedTotal(basePoints, linesCleared, prevComboStreak) {
  const multiLineFactor = linesCleared >= 3 ? 2.5 : linesCleared === 2 ? 1.5 : 1.0
  const linePoints = Math.round(linesCleared * 100 * multiLineFactor)
  let comboMultiplier = 1.0
  let milestoneBonus = 0
  if (linesCleared > 0) {
    const newStreak = prevComboStreak + 1
    comboMultiplier = getComboMultiplier(newStreak)
    milestoneBonus = MILESTONE_BONUS[newStreak] ?? 0
  }
  return Math.round((basePoints + linePoints) * comboMultiplier) + milestoneBonus
}

// ── Main validator ─────────────────────────────────────────────────────────────

/**
 * Replays moves against a full engine simulation and verifies the claimed score.
 *
 * @param {Array}   moves        - moveHistory array from the client
 * @param {number}  claimedScore - the score the client submitted
 * @param {bigint=} localSeed    - engine seed derived from the on-chain seed
 *                                 (BigInt(keccak256(seed ‖ player).slice(0, 18))).
 *                                 When provided, dealt pieces are verified against
 *                                 the seed; without it only geometry/points are checked.
 * @returns {{ ok: boolean, reason?: string }}
 */
export function replayAndValidateScore(moves, claimedScore, localSeed) {
  if (!Array.isArray(moves)) return { ok: false, reason: 'moves is not an array' }
  if (moves.length > MAX_MOVES) return { ok: false, reason: `too many moves (${moves.length})` }
  if (!Number.isInteger(claimedScore) || claimedScore < 0 || claimedScore > 0xffffffff) {
    return { ok: false, reason: `claimed score out of range (${claimedScore})` }
  }
  if (moves.length === 0) {
    return claimedScore === 0 ? { ok: true } : { ok: false, reason: 'non-zero score with no moves' }
  }

  const rng = localSeed !== undefined ? new DeterministicRNG(localSeed) : null
  // Trio state mirrors GameSession: constructor deals immediately.
  let trio = rng ? dealThree(rng) : null
  let piecesPlaced = 0

  const grid = createGrid()
  let replayedScore = 0
  let comboStreak = 0
  // Combo streak before the most recent placement — a shield revival restores it.
  let prevComboStreak = 0
  let lotteryMovesLeft = 0
  let lotteryStartMarkers = 0
  let lotteryBonusMarkers = 0

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i]

    // ── Lottery ×2 multiplier activation marker ──────────────────────────────
    if (move.lotteryMultiplierStart === true) {
      if (++lotteryStartMarkers > MAX_LOTTERY_MARKERS) {
        return { ok: false, reason: 'too many lottery multiplier markers' }
      }
      lotteryMovesLeft = 3
      continue
    }

    // ── Marker moves (pieceIndex: -1) ────────────────────────────────────────
    if (move.pieceIndex === -1) {
      if (move.revive === true) {
        if (move.shield === true) {
          // Shield revival: re-clear the recorded columns and restore the
          // combo streak from before the fatal placement, exactly like the
          // live engine (gameStore.placePiece → shieldRevive()).
          const cols = Array.isArray(move.shieldCols) && move.shieldCols.length
            ? move.shieldCols
            : mostFilledColumns(grid, 3)
          if (cols.some((c) => !Number.isInteger(c) || c < 0 || c >= GRID_SIZE)) {
            return { ok: false, reason: `move ${i}: invalid shieldCols` }
          }
          clearColumns(grid, cols)
          comboStreak = prevComboStreak
        }
        // Both revive kinds deal a fresh trio, discarding unplaced pieces.
        if (rng) {
          trio = dealThree(rng)
          piecesPlaced = 0
        }
        continue
      }

      if (typeof move.lotteryBonus === 'number') {
        if (move.lotteryBonus !== LOTTERY_BONUS_POINTS) {
          return { ok: false, reason: `move ${i}: lottery bonus ${move.lotteryBonus} ≠ ${LOTTERY_BONUS_POINTS}` }
        }
        if (++lotteryBonusMarkers > MAX_LOTTERY_MARKERS) {
          return { ok: false, reason: 'too many lottery bonus markers' }
        }
        replayedScore += LOTTERY_BONUS_POINTS
        continue
      }

      if (move.bomb) {
        // Mirrors GameSession.bombZone: full row + column cross, feeds combo,
        // counts as a 2-line clear, boost triples the per-cell points.
        const { row: br, col: bc } = move.bomb
        if (!Number.isInteger(br) || br < 0 || br >= GRID_SIZE ||
            !Number.isInteger(bc) || bc < 0 || bc >= GRID_SIZE) {
          return { ok: false, reason: `move ${i}: bomb target out of bounds` }
        }
        let cellsCleared = 0
        for (let c = 0; c < GRID_SIZE; c++) {
          if (grid[br * GRID_SIZE + c] !== 0) { grid[br * GRID_SIZE + c] = 0; cellsCleared++ }
        }
        for (let r = 0; r < GRID_SIZE; r++) {
          if (grid[r * GRID_SIZE + bc] !== 0) { grid[r * GRID_SIZE + bc] = 0; cellsCleared++ }
        }

        const newStreak = comboStreak + 1
        const mult = getComboMultiplier(newStreak)
        const milestone = MILESTONE_BONUS[newStreak] ?? 0
        const linePoints = 300 // round(2 lines × 100 × 1.5 multi-line factor)
        const candidates = [
          Math.round((Math.round(cellsCleared * 5 * 1.0) + linePoints) * mult) + milestone,
          Math.round((Math.round(cellsCleared * 5 * 3.0) + linePoints) * mult) + milestone, // score boost
        ]
        const recorded = move.scoreEvent?.totalPoints
        if (!candidates.includes(recorded)) {
          return { ok: false, reason: `move ${i}: bomb points ${recorded} not in [${candidates}]` }
        }
        comboStreak = newStreak
        replayedScore += recorded
        continue
      }

      // Unknown marker type — reject rather than let it slip through unvalidated
      return { ok: false, reason: `move ${i}: unknown marker record` }
    }

    // ── Regular placement (pieceIndex: 0|1|2) ────────────────────────────────
    if (!Number.isInteger(move.pieceIndex) || move.pieceIndex < 0 || move.pieceIndex > 2) {
      return { ok: false, reason: `move ${i}: invalid pieceIndex ${move.pieceIndex}` }
    }
    if (!move.shapeId) return { ok: false, reason: `move ${i}: missing shapeId` }

    const shape = SHAPE_MAP[move.shapeId]
    if (!shape) return { ok: false, reason: `move ${i}: unknown shapeId ${move.shapeId}` }

    // Verify the piece actually came from the seed-determined deal
    if (trio) {
      const dealt = trio[move.pieceIndex]
      if (!dealt) return { ok: false, reason: `move ${i}: piece slot ${move.pieceIndex} already used` }
      if (dealt.id !== move.shapeId) {
        return { ok: false, reason: `move ${i}: shape ${move.shapeId} does not match dealt ${dealt.id}` }
      }
    }

    // Apply Rotate Pass rotations
    let cells = shape.cells
    const rotations = move.rotations ?? 0
    if (!Number.isInteger(rotations) || rotations < 0 || rotations > 3) {
      return { ok: false, reason: `move ${i}: invalid rotations ${move.rotations}` }
    }
    for (let r = 0; r < rotations; r++) cells = rotateCells(cells)

    if (!canPlace(grid, cells, move.row, move.col)) {
      return { ok: false, reason: `move ${i}: invalid placement ${move.shapeId} at ${move.row},${move.col}` }
    }

    placeShape(grid, cells, move.row, move.col, shape.colorId)
    const linesCleared = findAndClearLines(grid)

    // Verify the reported line count matches the grid simulation
    if (move.scoreEvent?.linesCleared !== undefined && move.scoreEvent.linesCleared !== linesCleared) {
      return { ok: false, reason: `move ${i}: lines client=${move.scoreEvent.linesCleared} server=${linesCleared}` }
    }

    // Verify combo streak follows from actual line clears
    const expectedCombo = linesCleared > 0 ? comboStreak + 1 : 0
    if (move.scoreEvent?.newComboStreak !== undefined && move.scoreEvent.newComboStreak !== expectedCombo) {
      return { ok: false, reason: `move ${i}: combo client=${move.scoreEvent.newComboStreak} server=${expectedCombo}` }
    }

    // Recompute points. Score Boost (client-side state) doubles base points, so
    // accept either the plain or boosted total; the active lottery multiplier
    // doubles the whole event for 3 placements.
    const baseCandidates = [
      Math.round(shape.cellCount * shape.cellCount),
      Math.round(shape.cellCount * shape.cellCount * 2.0), // score boost
    ]
    let candidates = baseCandidates.map((b) => expectedTotal(b, linesCleared, comboStreak))
    if (lotteryMovesLeft > 0) candidates = candidates.map((t) => t * 2)

    const recorded = move.scoreEvent?.totalPoints
    if (!candidates.includes(recorded)) {
      return { ok: false, reason: `move ${i}: points ${recorded} not in [${candidates}]` }
    }

    prevComboStreak = comboStreak
    comboStreak = expectedCombo
    replayedScore += recorded

    if (lotteryMovesLeft > 0) lotteryMovesLeft--

    // Consume the piece; a fresh trio is dealt as soon as all three are placed
    // (same point in the sequence as GameSession.placePiece → deal()).
    if (trio) {
      trio[move.pieceIndex] = null
      piecesPlaced++
      if (piecesPlaced === 3) {
        trio = dealThree(rng)
        piecesPlaced = 0
      }
    }
  }

  if (replayedScore !== claimedScore) {
    return { ok: false, reason: `score mismatch: replayed=${replayedScore} claimed=${claimedScore}` }
  }
  return { ok: true }
}
