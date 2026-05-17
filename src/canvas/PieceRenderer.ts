import type { ShapeDefinition } from '../engine/shapes'
import { COLOR_PALETTE, TOURNAMENT_PALETTE } from './GridRenderer'

const getThemeColor = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()

export class PieceRenderer {
  private ctx: CanvasRenderingContext2D
  private trayY: number
  private cellSize: number
  private canvasWidth: number

  constructor(canvas: HTMLCanvasElement, trayY: number, cellSize: number) {
    this.ctx = canvas.getContext('2d')!
    this.trayY = trayY
    this.cellSize = cellSize
    this.canvasWidth = canvas.width
  }

  drawTray(
    pieces: (ShapeDefinition | null)[],
    activeIndex?: number,
    isTournament: boolean = false,
    hoveredIndex?: number,
    selectedIndex?: number
  ): void {
    const slotWidth = this.canvasWidth / 3
    const palette = isTournament ? TOURNAMENT_PALETTE : COLOR_PALETTE

    pieces.forEach((shape, index) => {
      // Draw slot divider (except before the first slot).
      // Use a dark semi-transparent line so it stays subtle on both the
      // yellow light-theme tray and the coloured dark-theme tray (where
      // --ink is light and would appear as a harsh white stripe).
      if (index > 0) {
        this.ctx.strokeStyle = 'rgba(0,0,0,0.28)'
        this.ctx.lineWidth = 3
        this.ctx.beginPath()
        this.ctx.moveTo(index * slotWidth, this.trayY)
        this.ctx.lineTo(index * slotWidth, this.trayY + slotWidth)
        this.ctx.stroke()
      }

      const isSelected = index === selectedIndex
      const isDragging = index === activeIndex

      // Draw selection highlight behind the piece
      if (isSelected) {
        const pad = 6
        this.ctx.fillStyle = 'rgba(180, 255, 60, 0.18)'
        this.ctx.fillRect(
          index * slotWidth + pad,
          this.trayY + pad,
          slotWidth - pad * 2,
          slotWidth - pad * 2
        )
        this.ctx.strokeStyle = 'rgba(120, 230, 40, 0.95)'
        this.ctx.lineWidth = 3
        this.ctx.setLineDash([])
        this.ctx.strokeRect(
          index * slotWidth + pad,
          this.trayY + pad,
          slotWidth - pad * 2,
          slotWidth - pad * 2
        )
      }

      if (!shape || isDragging) {
        // Empty slot or actively dragging — transparent so tray bg shows through
        return
      }

      const color = palette[shape.colorId as keyof typeof palette]
      const baseScale = isSelected ? 0.65 : 0.6
      const scale = baseScale * (hoveredIndex === index ? 1.05 : 1)
      const displayCellSize = this.cellSize * scale
      const pieceWidth = shape.width * displayCellSize
      const pieceHeight = shape.height * displayCellSize
      const x = index * slotWidth + (slotWidth - pieceWidth) / 2
      const y = this.trayY + (slotWidth - pieceHeight) / 2

      this.ctx.save()
      this.ctx.shadowColor = isSelected ? 'rgba(100,220,30,0.4)' : 'rgba(0,0,0,0.15)'
      this.ctx.shadowOffsetX = isSelected ? 0 : 2
      this.ctx.shadowOffsetY = isSelected ? 0 : 2
      this.ctx.shadowBlur = isSelected ? 8 : 0
      this.drawShape(shape, x, y, displayCellSize, color)
      this.ctx.restore()
    })
  }

  drawDragging(shape: ShapeDefinition, x: number, y: number, cellSize: number, isTournament: boolean = false): void {
    const palette = isTournament ? TOURNAMENT_PALETTE : COLOR_PALETTE
    const color = palette[shape.colorId as keyof typeof palette]
    const dragY = y - 40
    this.drawShape(shape, x - (shape.width * cellSize) / 2, dragY - (shape.height * cellSize) / 2, cellSize, color)
  }

  resize(trayY: number, cellSize: number, canvasWidth: number): void {
    this.trayY = trayY
    this.cellSize = cellSize
    this.canvasWidth = canvasWidth
  }

  hitTestTray(x: number, y: number, pieces: (ShapeDefinition | null)[]): number | null {
    const slotWidth = this.canvasWidth / 3
    if (y < this.trayY || y > this.trayY + slotWidth) return null
    const index = Math.floor(x / slotWidth)
    if (index >= 0 && index < 3 && pieces[index]) return index
    return null
  }

  private drawShape(shape: ShapeDefinition, x: number, y: number, cellSize: number, color: string): void {
    for (const [dr, dc] of shape.cells) {
      const cx = x + dc * cellSize + 1.2
      const cy = y + dr * cellSize + 1.2
      const size = cellSize - 2.4
      if (size <= 0) continue

      // Fill
      this.ctx.fillStyle = color
      this.ctx.fillRect(cx, cy, size, size)

      // Top highlight — subtle shimmer, not a glaring white band
      this.ctx.fillStyle = 'rgba(255,255,255,0.18)'
      this.ctx.fillRect(cx, cy, size, Math.floor(size * 0.26))

      // Bottom shadow
      const sh = Math.floor(size * 0.26)
      this.ctx.fillStyle = 'rgba(0,0,0,0.14)'
      this.ctx.fillRect(cx, cy + size - sh, size, sh)

      // Border: always dark semi-transparent so it contrasts with the piece
      // colour in every theme (--ink is light in dark themes = white outlines)
      this.ctx.strokeStyle = 'rgba(0,0,0,0.4)'
      this.ctx.lineWidth = 2
      this.ctx.strokeRect(cx, cy, size, size)
    }
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, _r: number) {
    ctx.moveTo(x, y)
    ctx.lineTo(x + w, y)
    ctx.lineTo(x + w, y + h)
    ctx.lineTo(x, y + h)
    ctx.closePath()
  }
}
