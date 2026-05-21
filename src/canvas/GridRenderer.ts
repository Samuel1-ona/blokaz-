import { Grid } from '../engine/grid'
import type { TierInfo } from '../engine/scoring'

export const COLOR_PALETTE = {
  0: 'transparent',
  1: '#FF3D3D',
  2: '#FF7A1A',
  3: '#FFD51F',
  4: '#B7FF3B',
  5: '#2CE66A',
  6: '#29E6E6',
  7: '#2F6BFF',
  8: '#8A3DFF',
  9: '#FF3BBD',
}

export const TOURNAMENT_PALETTE = {
  0: 'transparent',
  1: COLOR_PALETTE[9], // hot pink  — singles
  2: COLOR_PALETTE[2], // orange    — L-shapes
  3: COLOR_PALETTE[3], // yellow    — squares
  4: COLOR_PALETTE[4], // lime      — bigL
  5: COLOR_PALETTE[5], // green     — (unused, safety net)
  6: COLOR_PALETTE[6], // cyan      — lines
  7: COLOR_PALETTE[7], // blue      — (unused, safety net)
  8: COLOR_PALETTE[8], // purple    — T/other
  9: COLOR_PALETTE[1], // red       — zigzag
}

const getThemeColor = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()

// Pixel faces: 5 variations, each is an array of [x,y] ink-pixel coords on an 8×8 grid
const PIXEL_FACES: [number, number][][] = [
  [[2,2],[2,3],[5,2],[5,3],[2,5],[5,5],[3,6],[4,6]], // happy
  [[2,3],[5,2],[5,3],[2,5],[3,6],[4,6],[5,5]],       // wink
  [[2,2],[2,3],[5,2],[5,3],[3,5],[4,5],[3,6],[4,6]], // shocked
  [[2,3],[5,3],[2,5],[3,5],[4,5]],                   // smug
  [[2,3],[3,3],[4,3],[5,3],[3,5],[4,5]],             // sleepy
]

export class GridRenderer {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private gridSize: number
  private cellSize: number
  /** Current score tier — controls cell render style */
  private tier: TierInfo | null = null
  /** Animation timestamp in seconds for time-based effects */
  private t: number = 0

  constructor(canvas: HTMLCanvasElement, gridSize: number) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.gridSize = gridSize
    this.cellSize = gridSize / 9
  }

  /** Call every frame before draw() to keep time-based effects running */
  setTime(t: number): void {
    this.t = t
  }

  /** Call whenever the player's score tier changes */
  setTier(tier: TierInfo | null): void {
    this.tier = tier
  }

  getCellSizeInScreen(): number {
    const rect = this.canvas.getBoundingClientRect()
    return rect.width / 9
  }

  draw(
    grid: Uint8Array,
    ghostCells?: { row: number; col: number; valid: boolean }[],
    isTournament: boolean = false
  ): void {
    this.ctx.clearRect(0, 0, this.gridSize, this.gridSize)

    const css = getComputedStyle(document.documentElement)
    const bg = css.getPropertyValue('--board').trim()
    const empty = css.getPropertyValue('--empty-cell').trim()
    const ink = css.getPropertyValue('--ink').trim()
    const rule = css.getPropertyValue('--rule').trim()

    const tierId = this.tier?.id ?? 0

    // Board background — tinted for higher tiers
    this.ctx.fillStyle = bg
    this.ctx.fillRect(0, 0, this.gridSize, this.gridSize)

    // Living background layer for tiers that have it (drawn under cells)
    this.drawBoardBackground(tierId)

    // Board border
    this.ctx.strokeStyle = ink
    this.ctx.lineWidth = 6
    this.ctx.strokeRect(0, 0, this.gridSize, this.gridSize)

    const palette = isTournament ? TOURNAMENT_PALETTE : COLOR_PALETTE
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const val = Grid.getCell(grid, r, c)
        if (val === 0) {
          this.drawEmptyCell(r, c, empty)
        } else {
          const color = palette[val as keyof typeof palette]
          this.drawCellForTier(r, c, color, tierId, val)
        }
      }
    }

    // Gridlines
    this.ctx.strokeStyle = rule
    this.ctx.lineWidth = 1
    this.ctx.setLineDash([])
    for (let i = 1; i < 9; i++) {
      const pos = i * this.cellSize
      this.ctx.beginPath()
      this.ctx.moveTo(pos, 3)
      this.ctx.lineTo(pos, this.gridSize - 3)
      this.ctx.stroke()
      this.ctx.beginPath()
      this.ctx.moveTo(3, pos)
      this.ctx.lineTo(this.gridSize - 3, pos)
      this.ctx.stroke()
    }

    // Row/column completion hint — highlight lines that would clear on placement
    if (ghostCells && ghostCells.length > 0 && ghostCells[0].valid) {
      const ghostSet = new Set(ghostCells.map((g) => `${g.row},${g.col}`))
      const accent = this.tier?.accent ?? '#b7ff3b'
      // Parse accent hex to rgba
      const r = parseInt(accent.slice(1, 3), 16)
      const g = parseInt(accent.slice(3, 5), 16)
      const b = parseInt(accent.slice(5, 7), 16)
      this.ctx.fillStyle = `rgba(${r},${g},${b},0.15)`
      for (let row = 0; row < 9; row++) {
        let willComplete = true
        for (let col = 0; col < 9; col++) {
          if (Grid.getCell(grid, row, col) === 0 && !ghostSet.has(`${row},${col}`)) {
            willComplete = false
            break
          }
        }
        if (willComplete) {
          this.ctx.fillRect(3, row * this.cellSize + 3, this.gridSize - 6, this.cellSize - 6)
        }
      }
      for (let col = 0; col < 9; col++) {
        let willComplete = true
        for (let row = 0; row < 9; row++) {
          if (Grid.getCell(grid, row, col) === 0 && !ghostSet.has(`${row},${col}`)) {
            willComplete = false
            break
          }
        }
        if (willComplete) {
          this.ctx.fillRect(col * this.cellSize + 3, 3, this.cellSize - 6, this.gridSize - 6)
        }
      }
    }

    // Ghost preview
    if (ghostCells) {
      for (const ghost of ghostCells) {
        this.drawGhostCell(ghost.row, ghost.col, ghost.valid)
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // TIER-AWARE CELL DISPATCH
  // ─────────────────────────────────────────────────────────────

  private drawCellForTier(
    row: number,
    col: number,
    color: string,
    tierId: number,
    cellIdx: number
  ): void {
    switch (tierId) {
      case 0: return this.drawCellPaper(row, col, color)
      case 1: return this.drawCellSticker(row, col, color)
      case 2: return this.drawCellStriped(row, col, color)
      case 3: return this.drawCellPixel(row, col, color, cellIdx)
      case 4: return this.drawCellNeon(row, col, color)
      case 5: return this.drawCellCosmic(row, col, color, cellIdx)
      case 6: return this.drawCellLiquid(row, col, color)
      case 7: return this.drawCellGlitch(row, col, color, cellIdx)
      default: return this.drawCellPaper(row, col, color)
    }
  }

  // ─── T1: PAPER — flat ink, hard border (the default look) ───
  private drawCellPaper(row: number, col: number, color: string): void {
    const pad = 1.8
    const x = col * this.cellSize + pad
    const y = row * this.cellSize + pad
    const size = this.cellSize - pad * 2
    if (size <= 0) return

    this.ctx.fillStyle = color
    this.ctx.fillRect(x, y, size, size)
    this.ctx.strokeStyle = 'rgba(0,0,0,0.45)'
    this.ctx.lineWidth = 2.5
    this.ctx.strokeRect(x, y, size, size)
    this.ctx.fillStyle = 'rgba(255,255,255,0.18)'
    this.ctx.fillRect(x + 1, y + 1, size - 2, Math.floor(size * 0.26))
    const shadowH = Math.floor(size * 0.26)
    this.ctx.fillStyle = 'rgba(0,0,0,0.14)'
    this.ctx.fillRect(x + 1, y + size - shadowH - 1, size - 2, shadowH)
  }

  // ─── T2: STICKER — gloss vinyl highlight top-left corner ───
  private drawCellSticker(row: number, col: number, color: string): void {
    const pad = 1.8
    const x = col * this.cellSize + pad
    const y = row * this.cellSize + pad
    const size = this.cellSize - pad * 2
    if (size <= 0) return

    this.ctx.fillStyle = color
    this.ctx.fillRect(x, y, size, size)
    this.ctx.strokeStyle = 'rgba(0,0,0,0.45)'
    this.ctx.lineWidth = 2.5
    this.ctx.strokeRect(x, y, size, size)

    // Corner gloss — two overlapping rects skewed to fake a parallelogram
    this.ctx.save()
    this.ctx.beginPath()
    this.ctx.rect(x, y, size, size)
    this.ctx.clip()
    // Main gloss band
    this.ctx.fillStyle = 'rgba(255,255,255,0.55)'
    this.ctx.save()
    this.ctx.transform(1, 0, -0.32, 1, x + size * 0.08, y + size * 0.08)
    this.ctx.fillRect(0, 0, size * 0.32, size * 0.18)
    this.ctx.restore()
    // Secondary gloss band
    this.ctx.fillStyle = 'rgba(255,255,255,0.35)'
    this.ctx.save()
    this.ctx.transform(1, 0, -0.32, 1, x + size * 0.08, y + size * 0.32)
    this.ctx.fillRect(0, 0, size * 0.16, size * 0.08)
    this.ctx.restore()
    this.ctx.restore()
  }

  // ─── T3: STRIPED — diagonal repeating lines inside the cell ───
  private drawCellStriped(row: number, col: number, color: string): void {
    const pad = 1.8
    const x = col * this.cellSize + pad
    const y = row * this.cellSize + pad
    const size = this.cellSize - pad * 2
    if (size <= 0) return

    this.ctx.fillStyle = color
    this.ctx.fillRect(x, y, size, size)
    this.ctx.strokeStyle = 'rgba(0,0,0,0.45)'
    this.ctx.lineWidth = 2.5
    this.ctx.strokeRect(x, y, size, size)

    // Diagonal hatch stripes drawn clipped to the cell
    this.ctx.save()
    this.ctx.beginPath()
    this.ctx.rect(x + 1, y + 1, size - 2, size - 2)
    this.ctx.clip()
    this.ctx.strokeStyle = 'rgba(0,0,0,0.3)'
    this.ctx.lineWidth = Math.max(1, size * 0.05)
    const stride = size * 0.22
    for (let i = -size; i < size * 2; i += stride) {
      this.ctx.beginPath()
      this.ctx.moveTo(x + i, y)
      this.ctx.lineTo(x + i + size, y + size)
      this.ctx.stroke()
    }
    this.ctx.restore()
  }

  // ─── T4: PIXEL — 8-bit face per cell ───
  private drawCellPixel(row: number, col: number, color: string, cellIdx: number): void {
    const pad = 1.8
    const x = col * this.cellSize + pad
    const y = row * this.cellSize + pad
    const size = this.cellSize - pad * 2
    if (size <= 0) return

    this.ctx.fillStyle = color
    this.ctx.fillRect(x, y, size, size)
    this.ctx.strokeStyle = 'rgba(0,0,0,0.45)'
    this.ctx.lineWidth = 2.5
    this.ctx.strokeRect(x, y, size, size)

    const px = size / 8
    const faceIdx = (cellIdx + row * 9 + col) % 5
    const face = PIXEL_FACES[faceIdx]

    // Small white highlight pixel in top-left
    this.ctx.fillStyle = 'rgba(255,255,255,0.7)'
    this.ctx.fillRect(x + px, y + px, px, px)

    // Draw face pixels
    this.ctx.fillStyle = 'rgba(0,0,0,0.65)'
    for (const [fx, fy] of face) {
      this.ctx.fillRect(x + fx * px, y + fy * px, px, px)
    }
  }

  // ─── T5: NEON — dark bg, glowing inner ring, pulsing center ───
  private drawCellNeon(row: number, col: number, color: string): void {
    const pad = 1.8
    const x = col * this.cellSize + pad
    const y = row * this.cellSize + pad
    const size = this.cellSize - pad * 2
    if (size <= 0) return

    const pulse = 0.5 + 0.5 * Math.sin(this.t * 3 + row * 0.7 + col * 0.5)

    // Dark background
    this.ctx.fillStyle = '#0c0c10'
    this.ctx.fillRect(x, y, size, size)

    // Outer glow (simulated with box-shadow via ctx shadow)
    this.ctx.save()
    this.ctx.shadowColor = color
    this.ctx.shadowBlur = size * (0.18 + pulse * 0.18)
    this.ctx.strokeStyle = color
    this.ctx.lineWidth = Math.max(1.5, size * 0.06)
    this.ctx.strokeRect(
      x + size * 0.15,
      y + size * 0.15,
      size * 0.7,
      size * 0.7
    )
    this.ctx.restore()

    // Inner glowing center dot
    const dotSize = size * (0.2 + pulse * 0.12)
    this.ctx.save()
    this.ctx.shadowColor = color
    this.ctx.shadowBlur = size * 0.25
    this.ctx.fillStyle = color
    this.ctx.globalAlpha = 0.7 + pulse * 0.25
    this.ctx.fillRect(
      x + (size - dotSize) / 2,
      y + (size - dotSize) / 2,
      dotSize,
      dotSize
    )
    this.ctx.restore()

    // Border
    this.ctx.strokeStyle = 'rgba(0,0,0,0.45)'
    this.ctx.lineWidth = 2.5
    this.ctx.setLineDash([])
    this.ctx.strokeRect(x, y, size, size)
  }

  // ─── T6: COSMIC — dark bg, nebula gradient, star speckles ───
  private drawCellCosmic(row: number, col: number, color: string, cellIdx: number): void {
    const pad = 1.8
    const x = col * this.cellSize + pad
    const y = row * this.cellSize + pad
    const size = this.cellSize - pad * 2
    if (size <= 0) return

    const breath = 1 + 0.03 * Math.sin(this.t * 1.6 + cellIdx)

    // Deep dark background
    this.ctx.fillStyle = '#04040a'
    this.ctx.fillRect(x, y, size, size)

    // Nebula glow — parse color for gradient
    const r = parseInt(color.slice(1, 3), 16)
    const g = parseInt(color.slice(3, 5), 16)
    const b = parseInt(color.slice(5, 7), 16)
    const cx2 = x + size * (0.4 + Math.sin(this.t * 0.5 + cellIdx) * 0.2)
    const cy2 = y + size * (0.5 + Math.cos(this.t * 0.4 + cellIdx) * 0.2)
    const grad = this.ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, size * 0.7)
    grad.addColorStop(0, `rgba(${r},${g},${b},0.55)`)
    grad.addColorStop(0.4, `rgba(${r},${g},${b},0.11)`)
    grad.addColorStop(1, 'transparent')
    this.ctx.fillStyle = grad
    this.ctx.fillRect(x, y, size, size)

    // Pseudo-random star speckles seeded by cellIdx
    const seed = (cellIdx + 1) * 9301
    const rand = (n: number) => {
      const val = Math.sin(seed + n * 12.9898) * 43758.5453
      return val - Math.floor(val)
    }
    for (let i = 0; i < 6; i++) {
      const sx = x + rand(i * 2) * size
      const sy = y + rand(i * 2 + 1) * size
      const tw = 0.4 + 0.6 * (Math.sin(this.t * 2.4 + rand(i * 5) * 6.28) * 0.5 + 0.5)
      const isTinted = rand(i * 7) > 0.55
      const sp = Math.max(1, size * 0.04 * (0.5 + rand(i * 3) * 1.4))
      this.ctx.fillStyle = isTinted ? color : '#ffffff'
      this.ctx.globalAlpha = tw * (isTinted ? 0.95 : 0.85)
      this.ctx.fillRect(sx - sp / 2, sy - sp / 2, sp, sp)
    }
    this.ctx.globalAlpha = 1

    // Anchor star
    this.ctx.save()
    this.ctx.shadowColor = color
    this.ctx.shadowBlur = size * 0.18
    this.ctx.fillStyle = '#ffffff'
    const starSize = size * 0.08 * breath
    this.ctx.fillRect(x + (size - starSize) / 2, y + (size - starSize) / 2, starSize, starSize)
    this.ctx.restore()

    // Border
    this.ctx.strokeStyle = 'rgba(0,0,0,0.45)'
    this.ctx.lineWidth = 2.5
    this.ctx.setLineDash([])
    this.ctx.strokeRect(x, y, size, size)
  }

  // ─── T7: LIQUID — dark bg, animated sloshing liquid wave ───
  private drawCellLiquid(row: number, col: number, color: string): void {
    const pad = 1.8
    const x = col * this.cellSize + pad
    const y = row * this.cellSize + pad
    const size = this.cellSize - pad * 2
    if (size <= 0) return

    // Dark container
    this.ctx.fillStyle = '#0c0c10'
    this.ctx.fillRect(x, y, size, size)

    // Clamp drawing to cell
    this.ctx.save()
    this.ctx.beginPath()
    this.ctx.rect(x, y, size, size)
    this.ctx.clip()

    const phase = this.t * 2.2 + row * 0.7 + col * 0.5
    const waveH = size * (0.42 + Math.sin(phase) * 0.06)
    const waveTop = y + waveH

    // Parse color for gradient
    const r = parseInt(color.slice(1, 3), 16)
    const g2 = parseInt(color.slice(3, 5), 16)
    const b = parseInt(color.slice(5, 7), 16)
    const fillGrad = this.ctx.createLinearGradient(x, waveTop, x, y + size)
    fillGrad.addColorStop(0, `rgba(${r},${g2},${b},0.85)`)
    fillGrad.addColorStop(1, `rgba(${r},${g2},${b},1)`)

    // Wave path
    const waveX1 = size * 0.25
    const waveOff = Math.sin(this.t * 3 + col * 0.8) * size * 0.05
    this.ctx.beginPath()
    this.ctx.moveTo(x, waveTop)
    this.ctx.quadraticCurveTo(x + waveX1, waveTop - waveOff, x + size / 2, waveTop)
    this.ctx.quadraticCurveTo(x + size * 0.75, waveTop + waveOff, x + size, waveTop)
    this.ctx.lineTo(x + size, y + size)
    this.ctx.lineTo(x, y + size)
    this.ctx.closePath()
    this.ctx.fillStyle = fillGrad
    this.ctx.fill()

    // Meniscus highlight line
    this.ctx.strokeStyle = 'rgba(255,255,255,0.55)'
    this.ctx.lineWidth = Math.max(1, size * 0.04)
    this.ctx.setLineDash([])
    this.ctx.beginPath()
    this.ctx.moveTo(x, waveTop + 4)
    this.ctx.quadraticCurveTo(x + waveX1, waveTop + 4 - waveOff * 0.8, x + size / 2, waveTop + 4)
    this.ctx.quadraticCurveTo(x + size * 0.75, waveTop + 4 + waveOff * 0.8, x + size, waveTop + 4)
    this.ctx.stroke()

    // Bubble highlight
    this.ctx.fillStyle = 'rgba(255,255,255,0.6)'
    const bx = x + size * 0.65
    const by = y + size * 0.5
    const br = size * 0.06
    this.ctx.beginPath()
    this.ctx.arc(bx, by, br, 0, Math.PI * 2)
    this.ctx.fill()

    this.ctx.restore()

    // Border
    this.ctx.strokeStyle = 'rgba(0,0,0,0.45)'
    this.ctx.lineWidth = 2.5
    this.ctx.setLineDash([])
    this.ctx.strokeRect(x, y, size, size)
  }

  // ─── T8: GLITCH — RGB split, scanlines, random slip ───
  private drawCellGlitch(row: number, col: number, color: string, cellIdx: number): void {
    const pad = 1.8
    const x = col * this.cellSize + pad
    const y = row * this.cellSize + pad
    const size = this.cellSize - pad * 2
    if (size <= 0) return

    const slip = Math.sin(this.t * 11 + cellIdx) > 0.85 ? size * 0.18 : 0

    // Dark background
    this.ctx.fillStyle = '#0c0c10'
    this.ctx.fillRect(x, y, size, size)

    this.ctx.save()
    this.ctx.beginPath()
    this.ctx.rect(x, y, size, size)
    this.ctx.clip()

    // Main color layer with slip
    this.ctx.fillStyle = color
    this.ctx.fillRect(x + slip * 0.3, y, size, size)

    // Pink channel (difference-like)
    this.ctx.globalCompositeOperation = 'difference'
    this.ctx.fillStyle = 'rgba(255,59,189,0.45)'
    this.ctx.fillRect(x - slip * 0.6, y, size, size)

    // Cyan channel (screen-like)
    this.ctx.globalCompositeOperation = 'screen'
    this.ctx.fillStyle = 'rgba(41,230,230,0.35)'
    this.ctx.fillRect(x + slip * 0.6, y, size, size)

    // Scanlines
    this.ctx.globalCompositeOperation = 'source-over'
    const lineH = Math.max(1, size * 0.05)
    const lineStride = Math.max(2, size * 0.1)
    this.ctx.fillStyle = 'rgba(0,0,0,0.35)'
    for (let ly = y; ly < y + size; ly += lineStride) {
      this.ctx.fillRect(x, ly, size, lineH)
    }

    // Random data band
    if (Math.sin(this.t * 9 + cellIdx * 2) > 0.7) {
      this.ctx.globalCompositeOperation = 'difference'
      this.ctx.fillStyle = 'rgba(255,255,255,1)'
      this.ctx.fillRect(x, y + size * 0.4, size, size * 0.08)
    }

    this.ctx.globalCompositeOperation = 'source-over'
    this.ctx.restore()

    // Border
    this.ctx.strokeStyle = 'rgba(0,0,0,0.45)'
    this.ctx.lineWidth = 2.5
    this.ctx.setLineDash([])
    this.ctx.strokeRect(x, y, size, size)
  }

  // ─────────────────────────────────────────────────────────────
  // LIVING BOARD BACKGROUNDS — per-tier animated layer behind cells
  // ─────────────────────────────────────────────────────────────
  private drawBoardBackground(tierId: number): void {
    const s = this.gridSize
    const t = this.t

    if (tierId === 1) {
      // Sticker: slow drifting pink gloss bands
      this.ctx.save()
      this.ctx.globalAlpha = 0.06
      const offset = (t * 18) % 110
      for (let i = -110; i < s + 110; i += 110) {
        this.ctx.fillStyle = '#ff3bbd'
        this.ctx.save()
        this.ctx.transform(1, 0, Math.tan((115 * Math.PI) / 180), 1, 0, 0)
        this.ctx.fillRect(i + offset, 0, 40, s)
        this.ctx.restore()
      }
      this.ctx.restore()
    } else if (tierId === 2) {
      // Striped: drifting diagonal hatch
      this.ctx.save()
      this.ctx.globalAlpha = 0.08
      this.ctx.strokeStyle = '#ff7a1a'
      this.ctx.lineWidth = 3
      const drift = (t * 30) % 24
      for (let i = -s; i < s * 2; i += 24) {
        this.ctx.beginPath()
        this.ctx.moveTo(i + drift, 0)
        this.ctx.lineTo(i + drift + s, s)
        this.ctx.stroke()
      }
      this.ctx.restore()
    } else if (tierId === 3) {
      // Pixel: twinkling pixel constellation
      this.ctx.save()
      for (let i = 0; i < 14; i++) {
        const phase = t * 0.8 + i * 1.3
        const alpha = (Math.sin(phase) * 0.5 + 0.5) * 0.7
        const px = ((i * 73) % 100) / 100 * s
        const py = ((i * 137) % 100) / 100 * s
        this.ctx.fillStyle = '#b7ff3b'
        this.ctx.globalAlpha = alpha
        this.ctx.fillRect(px - 3, py - 3, 6, 6)
      }
      this.ctx.globalAlpha = 1
      this.ctx.restore()
    } else if (tierId === 4) {
      // Neon: CRT scanlines slowly rolling
      this.ctx.save()
      this.ctx.globalAlpha = 0.08
      const rollOffset = (t * 40) % 5
      for (let ly = rollOffset; ly < s; ly += 5) {
        this.ctx.fillStyle = '#29e6e6'
        this.ctx.fillRect(0, ly, s, 2)
      }
      this.ctx.restore()
    } else if (tierId === 5) {
      // Cosmic: drifting starfield
      this.ctx.save()
      for (let i = 0; i < 30; i++) {
        const speed = 6 + (i % 4) * 4
        const drift = ((i * 23 + t * speed) % (s + 20)) - 10
        const px = ((i * 37) % 100) / 100 * s
        const alpha = 0.4 + ((i * 13) % 6) / 10
        this.ctx.globalAlpha = alpha
        this.ctx.fillStyle = '#ffffff'
        this.ctx.beginPath()
        this.ctx.arc(px, drift, 1.5, 0, Math.PI * 2)
        this.ctx.fill()
      }
      this.ctx.globalAlpha = 1
      this.ctx.restore()
    } else if (tierId === 6) {
      // Liquid: slow water ripple rings from center
      this.ctx.save()
      const cx = s / 2
      const cy = s / 2
      for (let i = 0; i < 3; i++) {
        const phase = (t * 0.5 + i * 0.33) % 1
        const radius = phase * s * 0.7
        const alpha = (1 - phase) * 0.4
        this.ctx.globalAlpha = alpha
        this.ctx.strokeStyle = '#29e6e6'
        this.ctx.lineWidth = 2
        this.ctx.beginPath()
        this.ctx.arc(cx, cy, radius, 0, Math.PI * 2)
        this.ctx.stroke()
      }
      this.ctx.globalAlpha = 1
      this.ctx.restore()
    } else if (tierId === 7) {
      // Glitch: flashing RGB scan band + occasional full-frame flash
      this.ctx.save()
      const bandY = ((t * 90) % 100) / 100 * s
      this.ctx.globalCompositeOperation = 'difference'
      this.ctx.fillStyle = '#ff3bbd'
      this.ctx.globalAlpha = 0.5
      this.ctx.fillRect(0, bandY, s, 4)
      this.ctx.globalCompositeOperation = 'screen'
      this.ctx.fillStyle = '#29e6e6'
      this.ctx.globalAlpha = 0.35
      this.ctx.fillRect(0, (bandY + s * 0.3) % s, s, 2)
      if (Math.sin(t * 7) > 0.9) {
        this.ctx.globalCompositeOperation = 'source-over'
        this.ctx.fillStyle = '#ffffff'
        this.ctx.globalAlpha = 0.05
        this.ctx.fillRect(0, 0, s, s)
      }
      this.ctx.globalCompositeOperation = 'source-over'
      this.ctx.globalAlpha = 1
      this.ctx.restore()
    }
  }

  private drawEmptyCell(row: number, col: number, fill: string): void {
    const pad = 1.8
    const x = col * this.cellSize + pad
    const y = row * this.cellSize + pad
    const size = this.cellSize - pad * 2
    if (size <= 0) return

    this.ctx.fillStyle = fill
    this.ctx.fillRect(x, y, size, size)
  }

  private drawGhostCell(row: number, col: number, valid: boolean): void {
    const pad = 1
    const x = col * this.cellSize + pad
    const y = row * this.cellSize + pad
    const size = this.cellSize - pad * 2
    if (size <= 0) return

    if (valid) {
      const accent = this.tier?.accent ?? '#8cff3c'
      const r = parseInt(accent.slice(1, 3), 16)
      const g = parseInt(accent.slice(3, 5), 16)
      const b = parseInt(accent.slice(5, 7), 16)
      this.ctx.fillStyle = `rgba(${r},${g},${b},0.45)`
      this.ctx.fillRect(x, y, size, size)
      this.ctx.strokeStyle = `rgba(${r},${g},${b},0.95)`
      this.ctx.lineWidth = 2
      this.ctx.setLineDash([])
      this.ctx.strokeRect(x + 1, y + 1, size - 2, size - 2)
    } else {
      this.ctx.fillStyle = 'rgba(255, 55, 55, 0.32)'
      this.ctx.fillRect(x, y, size, size)
      this.ctx.strokeStyle = 'rgba(220, 30, 30, 0.75)'
      this.ctx.lineWidth = 2
      this.ctx.setLineDash([4, 3])
      this.ctx.strokeRect(x, y, size, size)
      this.ctx.setLineDash([])
    }
  }

  getCellSize(): number {
    return this.cellSize
  }

  resize(gridSize: number): void {
    this.gridSize = gridSize
    this.cellSize = gridSize / 9
  }

  get currentGridSize(): number {
    return this.gridSize
  }

  screenToGrid(x: number, y: number): { row: number; col: number } | null {
    const rect = this.canvas.getBoundingClientRect()
    const scaleX = this.canvas.width / rect.width
    const scaleY = this.canvas.height / rect.height
    const canvasX = (x - rect.left) * scaleX
    const canvasY = (y - rect.top) * scaleY
    if (
      canvasX < 0 ||
      canvasX >= this.gridSize ||
      canvasY < 0 ||
      canvasY >= this.gridSize
    ) {
      return null
    }
    return {
      row: Math.floor(canvasY / this.cellSize),
      col: Math.floor(canvasX / this.cellSize),
    }
  }
}
