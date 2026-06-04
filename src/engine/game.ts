import { Grid } from './grid'
import { SHAPES } from './shapes'
import type { ShapeDefinition } from './shapes'
import { DeterministicRNG, dealThree } from './rng'
import { calculateScore } from './scoring'
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

  // Rotate piece at index 90° CW. Returns false if slot is empty.
  rotatePiece(pieceIndex: number): boolean {
    const piece = this.currentPieces[pieceIndex]
    if (!piece) return false
    this.currentPieces[pieceIndex] = rotatePieceShape(piece)
    return true
  }

  // Clear a 3×3 zone centred on (centerRow, centerCol). Returns score awarded.
  bombZone(centerRow: number, centerCol: number): number {
    let cellsCleared = 0
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const r = centerRow + dr
        const c = centerCol + dc
        if (r >= 0 && r < Grid.SIZE && c >= 0 && c < Grid.SIZE) {
          if (this.grid[r * Grid.SIZE + c] !== 0) {
            this.grid[r * Grid.SIZE + c] = 0
            cellsCleared++
          }
        }
      }
    }
    const pts = cellsCleared * 5
    this.score += pts
    return pts
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
