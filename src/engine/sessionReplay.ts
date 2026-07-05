import { GameSession } from './game'
import type { MoveRecord } from './game'
import { Grid } from './grid'

// Clear full columns on a grid — used to re-apply a shield revival during replay.
function clearColumns(grid: Uint8Array, cols: number[]): void {
  for (const col of cols) {
    for (let r = 0; r < Grid.SIZE; r++) {
      grid[r * Grid.SIZE + col] = 0
    }
  }
}

// Fallback for legacy shield markers recorded without shieldCols: recompute the
// 3 most-filled columns with the same algorithm shieldRevive() uses.
function mostFilledColumns(grid: Uint8Array, n: number): number[] {
  const fillCounts = Array.from({ length: Grid.SIZE }, (_, col) => {
    let count = 0
    for (let r = 0; r < Grid.SIZE; r++) {
      if (grid[r * Grid.SIZE + col] !== 0) count++
    }
    return { col, count }
  })
  return fillCounts
    .sort((a, b) => b.count - a.count)
    .slice(0, n)
    .map((x) => x.col)
}

/**
 * Rebuilds a GameSession by replaying a recorded move history against a fresh
 * session seeded with the same seed. Used to restore a run after a crash,
 * refresh, or device switch — shared by classic and tournament modes.
 *
 * Marker records (pieceIndex -1) are applied via engine methods that do not
 * push to session.moveHistory; callers that need the markers preserved should
 * overwrite session.moveHistory with the original history afterwards.
 */
export function replayMoveHistory(
  seed: bigint,
  history: MoveRecord[],
  scoreBoostActive = false
): GameSession {
  const session = new GameSession(seed)
  session.scoreBoostActive = scoreBoostActive
  // Combo streak before the most recent placement — a shield revival restores
  // it, matching the live-game behaviour in gameStore.placePiece.
  let prevComboStreak = 0
  for (const move of history) {
    if (move.revive) {
      if (move.shield) {
        clearColumns(session.grid, move.shieldCols ?? mostFilledColumns(session.grid, 3))
        session.comboStreak = prevComboStreak
      }
      session.revive()
      continue
    }
    if (move.bomb) {
      session.bombZone(move.bomb.row, move.bomb.col)
      continue
    }
    // Lottery ×2 multiplier activation — restore the counter so the next 3
    // placePiece calls inside the engine double their score, matching the live run.
    if (move.lotteryMultiplierStart) {
      session.lotteryMultiplierMovesLeft = 3
      continue
    }
    // Lottery flat bonus — add directly to session score, no piece placement.
    if (move.lotteryBonus) {
      session.score += move.lotteryBonus
      continue
    }
    if (move.rotations) {
      for (let i = 0; i < move.rotations; i++) session.rotatePiece(move.pieceIndex)
    }
    prevComboStreak = session.comboStreak
    session.placePiece(move.pieceIndex, move.row, move.col)
  }

  // The recorded history is the authority on score: the live score is always
  // the sum of recorded totalPoints (markers carry 0, lottery bonuses carry
  // their bonus). Recomputing can drift when Score Boost was activated
  // mid-run — the single scoreBoostActive flag can't express that — and a
  // drifted score would fail server-side score validation on submit.
  session.score = history.reduce((sum, m) => sum + (m.scoreEvent?.totalPoints ?? 0), 0)
  return session
}
