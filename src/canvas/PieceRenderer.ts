import type { ShapeDefinition } from '../engine/shapes'
import { COLOR_PALETTE, TOURNAMENT_PALETTE } from './GridRenderer'
import type { TierInfo } from '../engine/scoring'

const PIXEL_FACES: [number, number][][] = [
  [[2,2],[2,3],[5,2],[5,3],[2,5],[5,5],[3,6],[4,6]],
  [[2,3],[5,2],[5,3],[2,5],[3,6],[4,6],[5,5]],
  [[2,2],[2,3],[5,2],[5,3],[3,5],[4,5],[3,6],[4,6]],
  [[2,3],[5,3],[2,5],[3,5],[4,5]],
  [[2,3],[3,3],[4,3],[5,3],[3,5],[4,5]],
]

export class PieceRenderer {
  private ctx: CanvasRenderingContext2D
  private trayY: number
  private cellSize: number
  private canvasWidth: number
  private tier: TierInfo | null = null
  private t: number = 0

  constructor(canvas: HTMLCanvasElement, trayY: number, cellSize: number) {
    this.ctx = canvas.getContext('2d')!
    this.trayY = trayY
    this.cellSize = cellSize
    this.canvasWidth = canvas.width
  }

  setTier(tier: TierInfo | null): void {
    this.tier = tier
  }

  setTime(t: number): void {
    this.t = t
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
    const tierId = this.tier?.id ?? 0

    pieces.forEach((shape, index) => {
      // Draw slot divider
      if (index > 0) {
        this.ctx.strokeStyle = 'rgba(0,0,0,0.28)'
        this.ctx.lineWidth = 3
        this.ctx.setLineDash([])
        this.ctx.beginPath()
        this.ctx.moveTo(index * slotWidth, this.trayY)
        this.ctx.lineTo(index * slotWidth, this.trayY + slotWidth)
        this.ctx.stroke()
      }

      const isSelected = index === selectedIndex
      const isDragging = index === activeIndex

      // Draw selection highlight behind the piece
      if (isSelected) {
        const accent = this.tier?.accent ?? '#b7ff3b'
        const r = parseInt(accent.slice(1, 3), 16)
        const g = parseInt(accent.slice(3, 5), 16)
        const b = parseInt(accent.slice(5, 7), 16)
        const pad = 6
        this.ctx.fillStyle = `rgba(${r},${g},${b},0.18)`
        this.ctx.fillRect(
          index * slotWidth + pad,
          this.trayY + pad,
          slotWidth - pad * 2,
          slotWidth - pad * 2
        )
        this.ctx.strokeStyle = `rgba(${r},${g},${b},0.95)`
        this.ctx.lineWidth = 3
        this.ctx.setLineDash([])
        this.ctx.strokeRect(
          index * slotWidth + pad,
          this.trayY + pad,
          slotWidth - pad * 2,
          slotWidth - pad * 2
        )
      }

      if (!shape || isDragging) return

      const color = palette[shape.colorId as keyof typeof palette]
      const baseScale = isSelected ? 0.65 : 0.6
      const scale = baseScale * (hoveredIndex === index ? 1.05 : 1)
      const displayCellSize = this.cellSize * scale
      const pieceWidth = shape.width * displayCellSize
      const pieceHeight = shape.height * displayCellSize
      const x = index * slotWidth + (slotWidth - pieceWidth) / 2
      const y = this.trayY + (slotWidth - pieceHeight) / 2

      this.ctx.save()
      const accent = this.tier?.accent ?? '#b7ff3b'
      this.ctx.shadowColor = isSelected ? `${accent}66` : 'rgba(0,0,0,0.15)'
      this.ctx.shadowOffsetX = isSelected ? 0 : 2
      this.ctx.shadowOffsetY = isSelected ? 0 : 2
      this.ctx.shadowBlur = isSelected ? 10 : 0
      this.drawShapeForTier(shape, x, y, displayCellSize, color, tierId)
      this.ctx.restore()
    })
  }

  drawDragging(
    shape: ShapeDefinition,
    x: number,
    y: number,
    cellSize: number,
    isTournament: boolean = false
  ): void {
    const palette = isTournament ? TOURNAMENT_PALETTE : COLOR_PALETTE
    const color = palette[shape.colorId as keyof typeof palette]
    const dragY = y - 40
    const tierId = this.tier?.id ?? 0
    this.drawShapeForTier(
      shape,
      x - (shape.width * cellSize) / 2,
      dragY - (shape.height * cellSize) / 2,
      cellSize,
      color,
      tierId
    )
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

  // ─────────────────────────────────────────────────────────────
  // TIER-AWARE SHAPE DRAWING
  // ─────────────────────────────────────────────────────────────

  private drawShapeForTier(
    shape: ShapeDefinition,
    x: number,
    y: number,
    cellSize: number,
    color: string,
    tierId: number
  ): void {
    for (let i = 0; i < shape.cells.length; i++) {
      const [dr, dc] = shape.cells[i]
      const cx = x + dc * cellSize + 1.2
      const cy = y + dr * cellSize + 1.2
      const size = cellSize - 2.4
      if (size <= 0) continue

      switch (tierId) {
        case 1: this.drawCellSticker(cx, cy, size, color); break
        case 2: this.drawCellStriped(cx, cy, size, color); break
        case 3: this.drawCellPixel(cx, cy, size, color, i); break
        case 4: this.drawCellNeon(cx, cy, size, color, i, dr, dc); break
        case 5: this.drawCellCosmic(cx, cy, size, color, i); break
        case 6: this.drawCellLiquid(cx, cy, size, color, i, dr, dc); break
        case 7: this.drawCellGlitch(cx, cy, size, color, i); break
        default: this.drawCellPaper(cx, cy, size, color); break
      }
    }
  }

  private drawCellPaper(x: number, y: number, size: number, color: string): void {
    this.ctx.fillStyle = color
    this.ctx.fillRect(x, y, size, size)
    this.ctx.fillStyle = 'rgba(255,255,255,0.18)'
    this.ctx.fillRect(x, y, size, Math.floor(size * 0.26))
    const sh = Math.floor(size * 0.26)
    this.ctx.fillStyle = 'rgba(0,0,0,0.14)'
    this.ctx.fillRect(x, y + size - sh, size, sh)
    this.ctx.strokeStyle = 'rgba(0,0,0,0.4)'
    this.ctx.lineWidth = 2
    this.ctx.setLineDash([])
    this.ctx.strokeRect(x, y, size, size)
  }

  private drawCellSticker(x: number, y: number, size: number, color: string): void {
    this.ctx.fillStyle = color
    this.ctx.fillRect(x, y, size, size)
    this.ctx.strokeStyle = 'rgba(0,0,0,0.4)'
    this.ctx.lineWidth = 2
    this.ctx.setLineDash([])
    this.ctx.strokeRect(x, y, size, size)
    this.ctx.save()
    this.ctx.beginPath()
    this.ctx.rect(x, y, size, size)
    this.ctx.clip()
    this.ctx.fillStyle = 'rgba(255,255,255,0.55)'
    this.ctx.save()
    this.ctx.transform(1, 0, -0.32, 1, x + size * 0.08, y + size * 0.08)
    this.ctx.fillRect(0, 0, size * 0.32, size * 0.18)
    this.ctx.restore()
    this.ctx.fillStyle = 'rgba(255,255,255,0.35)'
    this.ctx.save()
    this.ctx.transform(1, 0, -0.32, 1, x + size * 0.08, y + size * 0.32)
    this.ctx.fillRect(0, 0, size * 0.16, size * 0.08)
    this.ctx.restore()
    this.ctx.restore()
  }

  private drawCellStriped(x: number, y: number, size: number, color: string): void {
    this.ctx.fillStyle = color
    this.ctx.fillRect(x, y, size, size)
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
    this.ctx.strokeStyle = 'rgba(0,0,0,0.4)'
    this.ctx.lineWidth = 2
    this.ctx.setLineDash([])
    this.ctx.strokeRect(x, y, size, size)
  }

  private drawCellPixel(x: number, y: number, size: number, color: string, idx: number): void {
    this.ctx.fillStyle = color
    this.ctx.fillRect(x, y, size, size)
    const px = size / 8
    const face = PIXEL_FACES[idx % 5]
    this.ctx.fillStyle = 'rgba(255,255,255,0.7)'
    this.ctx.fillRect(x + px, y + px, px, px)
    this.ctx.fillStyle = 'rgba(0,0,0,0.65)'
    for (const [fx, fy] of face) {
      this.ctx.fillRect(x + fx * px, y + fy * px, px, px)
    }
    this.ctx.strokeStyle = 'rgba(0,0,0,0.4)'
    this.ctx.lineWidth = 2
    this.ctx.setLineDash([])
    this.ctx.strokeRect(x, y, size, size)
  }

  private drawCellNeon(
    x: number, y: number, size: number, color: string,
    idx: number, dr: number, dc: number
  ): void {
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 3 + dr * 0.7 + dc * 0.5)
    this.ctx.fillStyle = '#0c0c10'
    this.ctx.fillRect(x, y, size, size)
    this.ctx.save()
    this.ctx.shadowColor = color
    this.ctx.shadowBlur = size * (0.18 + pulse * 0.18)
    this.ctx.strokeStyle = color
    this.ctx.lineWidth = Math.max(1.5, size * 0.06)
    this.ctx.setLineDash([])
    this.ctx.strokeRect(x + size * 0.15, y + size * 0.15, size * 0.7, size * 0.7)
    this.ctx.restore()
    const dotSize = size * (0.2 + pulse * 0.12)
    this.ctx.save()
    this.ctx.shadowColor = color
    this.ctx.shadowBlur = size * 0.25
    this.ctx.fillStyle = color
    this.ctx.globalAlpha = 0.7 + pulse * 0.25
    this.ctx.fillRect(x + (size - dotSize) / 2, y + (size - dotSize) / 2, dotSize, dotSize)
    this.ctx.restore()
    this.ctx.strokeStyle = 'rgba(0,0,0,0.4)'
    this.ctx.lineWidth = 2
    this.ctx.setLineDash([])
    this.ctx.strokeRect(x, y, size, size)
  }

  private drawCellCosmic(x: number, y: number, size: number, color: string, idx: number): void {
    const breath = 1 + 0.03 * Math.sin(this.t * 1.6 + idx)
    this.ctx.fillStyle = '#04040a'
    this.ctx.fillRect(x, y, size, size)
    const r = parseInt(color.slice(1, 3), 16)
    const g = parseInt(color.slice(3, 5), 16)
    const b = parseInt(color.slice(5, 7), 16)
    const gx = x + size * (0.4 + Math.sin(this.t * 0.5 + idx) * 0.2)
    const gy = y + size * (0.5 + Math.cos(this.t * 0.4 + idx) * 0.2)
    const grad = this.ctx.createRadialGradient(gx, gy, 0, gx, gy, size * 0.7)
    grad.addColorStop(0, `rgba(${r},${g},${b},0.55)`)
    grad.addColorStop(0.4, `rgba(${r},${g},${b},0.11)`)
    grad.addColorStop(1, 'transparent')
    this.ctx.fillStyle = grad
    this.ctx.fillRect(x, y, size, size)
    const seed = (idx + 1) * 9301
    const rand = (n: number) => {
      const v = Math.sin(seed + n * 12.9898) * 43758.5453
      return v - Math.floor(v)
    }
    for (let i = 0; i < 5; i++) {
      const sx = x + rand(i * 2) * size
      const sy = y + rand(i * 2 + 1) * size
      const tw = 0.4 + 0.6 * (Math.sin(this.t * 2.4 + rand(i * 5) * 6.28) * 0.5 + 0.5)
      const sp = Math.max(1, size * 0.04 * (0.5 + rand(i * 3) * 1.4))
      this.ctx.fillStyle = rand(i * 7) > 0.55 ? color : '#ffffff'
      this.ctx.globalAlpha = tw * 0.9
      this.ctx.fillRect(sx - sp / 2, sy - sp / 2, sp, sp)
    }
    this.ctx.globalAlpha = 1
    this.ctx.save()
    this.ctx.shadowColor = color
    this.ctx.shadowBlur = size * 0.18
    const starSz = size * 0.08 * breath
    this.ctx.fillStyle = '#ffffff'
    this.ctx.fillRect(x + (size - starSz) / 2, y + (size - starSz) / 2, starSz, starSz)
    this.ctx.restore()
    this.ctx.strokeStyle = 'rgba(0,0,0,0.4)'
    this.ctx.lineWidth = 2
    this.ctx.setLineDash([])
    this.ctx.strokeRect(x, y, size, size)
  }

  private drawCellLiquid(
    x: number, y: number, size: number, color: string,
    idx: number, dr: number, dc: number
  ): void {
    this.ctx.fillStyle = '#0c0c10'
    this.ctx.fillRect(x, y, size, size)
    this.ctx.save()
    this.ctx.beginPath()
    this.ctx.rect(x, y, size, size)
    this.ctx.clip()
    const phase = this.t * 2.2 + dr * 0.7 + dc * 0.5
    const waveH = size * (0.42 + Math.sin(phase) * 0.06)
    const waveTop = y + waveH
    const r = parseInt(color.slice(1, 3), 16)
    const g = parseInt(color.slice(3, 5), 16)
    const b = parseInt(color.slice(5, 7), 16)
    const fillGrad = this.ctx.createLinearGradient(x, waveTop, x, y + size)
    fillGrad.addColorStop(0, `rgba(${r},${g},${b},0.85)`)
    fillGrad.addColorStop(1, `rgba(${r},${g},${b},1)`)
    const waveX1 = size * 0.25
    const waveOff = Math.sin(this.t * 3 + dc * 0.8) * size * 0.05
    this.ctx.beginPath()
    this.ctx.moveTo(x, waveTop)
    this.ctx.quadraticCurveTo(x + waveX1, waveTop - waveOff, x + size / 2, waveTop)
    this.ctx.quadraticCurveTo(x + size * 0.75, waveTop + waveOff, x + size, waveTop)
    this.ctx.lineTo(x + size, y + size)
    this.ctx.lineTo(x, y + size)
    this.ctx.closePath()
    this.ctx.fillStyle = fillGrad
    this.ctx.fill()
    this.ctx.strokeStyle = 'rgba(255,255,255,0.55)'
    this.ctx.lineWidth = Math.max(1, size * 0.04)
    this.ctx.setLineDash([])
    this.ctx.beginPath()
    this.ctx.moveTo(x, waveTop + 3)
    this.ctx.quadraticCurveTo(x + waveX1, waveTop + 3 - waveOff * 0.8, x + size / 2, waveTop + 3)
    this.ctx.quadraticCurveTo(x + size * 0.75, waveTop + 3 + waveOff * 0.8, x + size, waveTop + 3)
    this.ctx.stroke()
    this.ctx.restore()
    this.ctx.strokeStyle = 'rgba(0,0,0,0.4)'
    this.ctx.lineWidth = 2
    this.ctx.setLineDash([])
    this.ctx.strokeRect(x, y, size, size)
  }

  private drawCellGlitch(x: number, y: number, size: number, color: string, idx: number): void {
    const slip = Math.sin(this.t * 11 + idx) > 0.85 ? size * 0.18 : 0
    this.ctx.fillStyle = '#0c0c10'
    this.ctx.fillRect(x, y, size, size)
    this.ctx.save()
    this.ctx.beginPath()
    this.ctx.rect(x, y, size, size)
    this.ctx.clip()
    this.ctx.fillStyle = color
    this.ctx.fillRect(x + slip * 0.3, y, size, size)
    this.ctx.globalCompositeOperation = 'difference'
    this.ctx.fillStyle = 'rgba(255,59,189,0.45)'
    this.ctx.fillRect(x - slip * 0.6, y, size, size)
    this.ctx.globalCompositeOperation = 'screen'
    this.ctx.fillStyle = 'rgba(41,230,230,0.35)'
    this.ctx.fillRect(x + slip * 0.6, y, size, size)
    this.ctx.globalCompositeOperation = 'source-over'
    const lineH = Math.max(1, size * 0.05)
    const stride = Math.max(2, size * 0.1)
    this.ctx.fillStyle = 'rgba(0,0,0,0.35)'
    for (let ly = y; ly < y + size; ly += stride) {
      this.ctx.fillRect(x, ly, size, lineH)
    }
    if (Math.sin(this.t * 9 + idx * 2) > 0.7) {
      this.ctx.globalCompositeOperation = 'difference'
      this.ctx.fillStyle = 'rgba(255,255,255,1)'
      this.ctx.fillRect(x, y + size * 0.4, size, size * 0.08)
    }
    this.ctx.globalCompositeOperation = 'source-over'
    this.ctx.restore()
    this.ctx.strokeStyle = 'rgba(0,0,0,0.4)'
    this.ctx.lineWidth = 2
    this.ctx.setLineDash([])
    this.ctx.strokeRect(x, y, size, size)
  }
}
