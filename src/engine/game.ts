import { Grid } from './grid'
import { SHAPES } from './shapes'
import type { ShapeDefinition } from './shapes'
import { DeterministicRNG, dealThree } from './rng'
import { calculateScore, getComboMultiplier, MILESTONE_BONUS } from './scoring'
import type { ScoreEvent } from './scoring'

export interface MoveRecord {
  pieceIndex: number
  shapeId: string
  row: number
  col: number
  scoreEvent: ScoreEvent
  rotations?: number        // 0-3 CW quarter-turns applied before placement
  bomb?: { row: number; col: number }
  revive?: true             // marks a revival point — replay calls session.revive()
  shield?: true             // revival came from a shield — replay must clear shieldCols first
  shieldCols?: number[]     // columns cleared by shieldRevive(), recorded for deterministic replay
  lotteryBonus?: number     // flat score bonus awarded by lottery — replay adds to session.score
  lotteryMultiplierStart?: true  // lottery ×2 multiplier activated — replay sets lotteryMultiplierMovesLeft=3
}

export interface PlaceResult {
  success: boolean
  error?: string
  scoreEvent?: ScoreEvent
  linesCleared?: { rows: number[]; cols: number[] }
  isGameOver: boolean
}

// Rotate a ShapeDefinition 90° clockwise
export function rotatePieceShape(piece: ShapeDefinition): ShapeDefinition {
  const cells = piece.cells as [number, number][]
  const maxR = Math.max(...cells.map(([r]) => r))
  const rotated: [number, number][] = cells.map(([r, c]) => [c, maxR - r])
  const minR = Math.min(...rotated.map(([r]) => r))
  const minC = Math.min(...rotated.map(([, c]) => c))
  const normalized = rotated.map(([r, c]) => [r - minR, c - minC] as [number, number])
  const newWidth = Math.max(...normalized.map(([, c]) => c)) + 1
  const newHeight = Math.max(...normalized.map(([r]) => r)) + 1
  return {
    ...piece,
    cells: normalized,
    width: newWidth,
    height: newHeight,
    rotations: ((piece.rotations ?? 0) + 1) % 4,
  }
}

export class GameSession {
  grid: Uint8Array
  score: number = 0
  comboStreak: number = 0
  currentPieces: (ShapeDefinition | null)[] = [null, null, null]
  piecesPlaced: number = 0
  moveHistory: MoveRecord[] = []
  isGameOver: boolean = false
  dealCount: number = 0
  seed: bigint
  scoreBoostActive: boolean = false
  // Lottery ×2 multiplier — counts down from 3 to 0 as pieces are placed.
  // Replay restores this via a lotteryMultiplierStart record in moveHistory.
  lotteryMultiplierMovesLeft: number = 0

  private rng: DeterministicRNG

  constructor(seed: bigint) {
    this.seed = seed
    this.rng = new DeterministicRNG(seed)
    this.grid = Grid.createGrid()
    this.deal()
  }

  revive(): void {
    this.isGameOver = false
    this.deal()
  }

  // Shield revive: clears the 3 most-filled columns to create space, then revives.
  // Returns the column indices that were cleared (for UI feedback).
  shieldRevive(): number[] {
    // Count filled cells per column
    const fillCounts = Array.from({ length: Grid.SIZE }, (_, col) => {
      let count = 0
      for (let r = 0; r < Grid.SIZE; r++) {
        if (this.grid[r * Grid.SIZE + col] !== 0) count++
      }
      return { col, count }
    })
    // Pick 3 most-filled columns
    const topThree = fillCounts
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map((x) => x.col)

    // Clear those columns
    for (const col of topThree) {
      for (let r = 0; r < Grid.SIZE; r++) {
        this.grid[r * Grid.SIZE + col] = 0
      }
    }

    this.revive()
    return topThree.sort((a, b) => a - b)
  }

  // Rotate piece at index 90° CW. Returns false if slot is empty.
  rotatePiece(pieceIndex: number): boolean {
    const piece = this.currentPieces[pieceIndex]
    if (!piece) return false
    this.currentPieces[pieceIndex] = rotatePieceShape(piece)
    return true
  }

  // Explode the full row and column through (centerRow, centerCol).
  // Treats the cross as 2 line clears — feeds combo streak and applies score boost.
  bombZone(centerRow: number, centerCol: number): ScoreEvent {
    let cellsCleared = 0
    for (let c = 0; c < Grid.SIZE; c++) {
      if (this.grid[centerRow * Grid.SIZE + c] !== 0) {
        this.grid[centerRow * Grid.SIZE + c] = 0
        cellsCleared++
      }
    }
    for (let r = 0; r < Grid.SIZE; r++) {
      if (this.grid[r * Grid.SIZE + centerCol] !== 0) {
        this.grid[r * Grid.SIZE + centerCol] = 0
        cellsCleared++
      }
    }

    // Cell pts: 3× when both boost and bomb are synergised, 2× for boost alone
    const basePoints   = Math.round(cellsCleared * 5 * (this.scoreBoostActive ? 3.0 : 1.0))
    // Row + column = 2 line clears → 2-line multi-factor
    const linesCleared    = 2
    const multiLineFactor = 1.5
    const linePoints      = Math.round(linesCleared * 100 * multiLineFactor)

    // Feed the combo streak
    const newComboStreak  = this.comboStreak + 1
    const comboMultiplier = getComboMultiplier(newComboStreak)
    const isMilestone     = newComboStreak in MILESTONE_BONUS
    const milestoneBonus  = MILESTONE_BONUS[newComboStreak] ?? 0

    const rawPoints  = basePoints + linePoints
    const totalPoints = Math.round(rawPoints * comboMultiplier) + milestoneBonus
    const comboBonus  = totalPoints - rawPoints

    this.comboStreak = newComboStreak
    this.score      += totalPoints

    return {
      basePoints, linePoints, comboBonus, totalPoints,
      linesCleared, newComboStreak, comboMultiplier, isMilestone, multiLineFactor,
    }
  }

  deal(): void {
    const trio = dealThree(this.rng, SHAPES)
    this.currentPieces = [...trio]
    this.piecesPlaced = 0
    this.dealCount++

    if (!Grid.canPlaceAny(this.grid, trio)) {
      this.isGameOver = true
    }
  }

  placePiece(pieceIndex: number, row: number, col: number): PlaceResult {
    if (this.isGameOver) {
      return { success: false, error: 'Game is over', isGameOver: true }
    }

    if (pieceIndex < 0 || pieceIndex > 2) {
      return { success: false, error: 'Invalid piece index', isGameOver: false }
    }

    const piece = this.currentPieces[pieceIndex]
    if (!piece) {
      return {
        success: false,
        error: 'Piece already placed',
        isGameOver: false,
      }
    }

    if (!Grid.canPlace(this.grid, piece, row, col)) {
      return { success: false, error: 'Invalid placement', isGameOver: false }
    }

    // Assign the color ID defined in the shape definition
    const colorId = piece.colorId

    Grid.placeShape(this.grid, piece, row, col, colorId)

    const fullLines = Grid.findFullLines(this.grid)
    const { cellsCleared } = Grid.clearLines(
      this.grid,
      fullLines.rows,
      fullLines.cols
    )

    const baseEvent = calculateScore(
      piece,
      fullLines.rows.length + fullLines.cols.length,
      this.comboStreak,
      this.scoreBoostActive
    )

    // Apply lottery ×2 multiplier if active — doubles total and base points,
    // then counts down. The modified event is what gets saved to moveHistory
    // so the recorded score matches what the player saw.
    let scoreEvent = baseEvent
    if (this.lotteryMultiplierMovesLeft > 0) {
      scoreEvent = {
        ...baseEvent,
        basePoints:  baseEvent.basePoints  * 2,
        totalPoints: baseEvent.totalPoints * 2,
      }
      this.lotteryMultiplierMovesLeft--
    }

    this.score += scoreEvent.totalPoints
    this.comboStreak = scoreEvent.newComboStreak
    this.currentPieces[pieceIndex] = null
    this.piecesPlaced++

    this.moveHistory.push({
      pieceIndex,
      shapeId: piece.id,
      row,
      col,
      scoreEvent,
      ...(piece.rotations ? { rotations: piece.rotations } : {}),
    })

    // If all pieces placed, deal new ones
    if (this.piecesPlaced === 3) {
      this.deal()
    } else {
      // Check if any remaining pieces can be placed
      const remainingPieces = this.currentPieces.filter(
        (p): p is ShapeDefinition => p !== null
      )
      if (!Grid.canPlaceAny(this.grid, remainingPieces)) {
        this.isGameOver = true
      }
    }

    return {
      success: true,
      scoreEvent,
      linesCleared: fullLines,
      isGameOver: this.isGameOver,
    }
  }
}
