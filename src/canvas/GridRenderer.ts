import { Grid } from '../engine/grid'

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

export class GridRenderer {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private gridSize: number
  private cellSize: number

  constructor(canvas: HTMLCanvasElement, gridSize: number) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.gridSize = gridSize
    this.cellSize = gridSize / 9
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

    // Board background
    this.ctx.fillStyle = bg
    this.ctx.fillRect(0, 0, this.gridSize, this.gridSize)

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
          this.drawCell(
            r,
            c,
            palette[val as keyof typeof palette],
            ink
          )
        }
      }
    }

    // Gridlines
    this.ctx.strokeStyle = rule
    this.ctx.lineWidth = 1
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
      this.ctx.fillStyle = 'rgba(180, 255, 80, 0.15)'
      for (let r = 0; r < 9; r++) {
        let willComplete = true
        for (let c = 0; c < 9; c++) {
          if (Grid.getCell(grid, r, c) === 0 && !ghostSet.has(`${r},${c}`)) {
            willComplete = false
            break
          }
        }
        if (willComplete) {
          this.ctx.fillRect(3, r * this.cellSize + 3, this.gridSize - 6, this.cellSize - 6)
        }
      }
      for (let c = 0; c < 9; c++) {
        let willComplete = true
        for (let r = 0; r < 9; r++) {
          if (Grid.getCell(grid, r, c) === 0 && !ghostSet.has(`${r},${c}`)) {
            willComplete = false
            break
          }
        }
        if (willComplete) {
          this.ctx.fillRect(c * this.cellSize + 3, 3, this.cellSize - 6, this.gridSize - 6)
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

  private drawEmptyCell(row: number, col: number, fill: string): void {
    const pad = 1.8
    const x = col * this.cellSize + pad
    const y = row * this.cellSize + pad
    const size = this.cellSize - pad * 2
    if (size <= 0) return

    this.ctx.fillStyle = fill
    this.ctx.fillRect(x, y, size, size)
  }

  private drawCell(row: number, col: number, color: string, _ink: string): void {
    const pad = 1.8
    const x = col * this.cellSize + pad
    const y = row * this.cellSize + pad
    const size = this.cellSize - pad * 2
    if (size <= 0) return

    this.ctx.beginPath()
    this.ctx.rect(x, y, size, size)
    this.ctx.fillStyle = color
    this.ctx.fill()

    // Border: always a dark semi-transparent overlay so it contrasts with the
    // piece colour in every theme (--ink goes light in dark themes which
    // creates white outlines on coloured cells — bad).
    this.ctx.strokeStyle = 'rgba(0,0,0,0.45)'
    this.ctx.lineWidth = 2.5
    this.ctx.stroke()

    // Top highlight — kept subtle so it reads as depth, not a white band
    this.ctx.fillStyle = 'rgba(255,255,255,0.18)'
    this.ctx.fillRect(x + 1, y + 1, size - 2, Math.floor(size * 0.26))

    // Inner shadow for depth
    const shadowH = Math.floor(size * 0.26)
    this.ctx.fillStyle = 'rgba(0,0,0,0.14)'
    this.ctx.fillRect(x + 1, y + size - shadowH - 1, size - 2, shadowH)
  }

  private drawGhostCell(row: number, col: number, valid: boolean): void {
    const pad = 1
    const x = col * this.cellSize + pad
    const y = row * this.cellSize + pad
    const size = this.cellSize - pad * 2
    if (size <= 0) return

    if (valid) {
      this.ctx.fillStyle = 'rgba(140, 255, 60, 0.48)'
      this.ctx.fillRect(x, y, size, size)
      this.ctx.strokeStyle = 'rgba(80, 220, 30, 0.95)'
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

  // kept for internal usage with square cells
  private roundRect(
    _ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    _r: number
  ) {
    this.ctx.moveTo(x, y)
    this.ctx.lineTo(x + w, y)
    this.ctx.lineTo(x + w, y + h)
    this.ctx.lineTo(x, y + h)
    this.ctx.closePath()
  }
}
