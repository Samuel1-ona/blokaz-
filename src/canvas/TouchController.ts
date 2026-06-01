import { GridRenderer } from './GridRenderer'
import { PieceRenderer } from './PieceRenderer'
import type { ShapeDefinition } from '../engine/shapes'
import { hapticSelection } from '../miniapp/haptics'

export class TouchController {
  private canvas: HTMLCanvasElement
  private gridRenderer: GridRenderer
  private pieceRenderer: PieceRenderer
  private onPlace: (pieceIndex: number, row: number, col: number) => void
  private canPlace: (shape: ShapeDefinition, row: number, col: number) => boolean

  private isDragging: boolean = false
  private dragIndex: number | null = null
  private dragPos: { x: number; y: number } = { x: 0, y: 0 }
  private ghostPos: { row: number; col: number } | null = null
  private destroyed: boolean = false
  private hoverIndex: number | null = null
  private lastGhostValid: boolean | null = null
  private isTouch: boolean = false

  // Tap-to-select state
  private selectedIndex: number | null = null
  private placingViaTap: boolean = false

  // Tap detection
  private tapStartTime: number = 0
  private tapStartClientX: number = 0
  private tapStartClientY: number = 0

  private onHoverChange?: (index: number | null) => void

  constructor(
    canvas: HTMLCanvasElement,
    gridRenderer: GridRenderer,
    pieceRenderer: PieceRenderer,
    onPlace: (pieceIndex: number, row: number, col: number) => void,
    canPlace: (shape: ShapeDefinition, row: number, col: number) => boolean,
    onHoverChange?: (index: number | null) => void
  ) {
    this.canvas = canvas
    this.gridRenderer = gridRenderer
    this.pieceRenderer = pieceRenderer
    this.onPlace = onPlace
    this.canPlace = canPlace
    this.onHoverChange = onHoverChange
    this.initEvents()
  }

  // Bound handler references — kept so we can removeEventListener later
  private _onMouseDown  = (e: MouseEvent) => { this.isTouch = false; this.handleStart(e) }
  private _onMouseMove  = (e: MouseEvent) => this.handleMove(e)
  private _onMouseLeave = () => {
    if (!this.isDragging && this.hoverIndex !== null) {
      this.hoverIndex = null
      this.onHoverChange?.(null)
    }
  }
  private _onMouseUp   = (e: MouseEvent) => this.handleEnd(e)

  private _onTouchStart = (e: TouchEvent) => {
    e.preventDefault()
    this.isTouch = true
    this.handleStart(e.touches[0] as any)
  }
  private _onTouchMove = (e: TouchEvent) => {
    e.preventDefault()
    this.handleMove(e.touches[0] as any)
  }
  private _onTouchEnd = (e: TouchEvent) => {
    this.handleEnd(e.changedTouches[0] as any)
  }
  // Reset all drag/select state when OS cancels the touch
  private _onTouchCancel = () => {
    this.isDragging      = false
    this.dragIndex       = null
    this.selectedIndex   = null
    this.placingViaTap   = false
    this.ghostPos        = null
    this.lastGhostValid  = null
    this.hoverIndex      = null
    this.isTouch         = false
    this.onHoverChange?.(null)
    ;(window as any).activeGhost = null
  }

  private initEvents() {
    this.canvas.addEventListener('mousedown',  this._onMouseDown)
    this.canvas.addEventListener('mousemove',  this._onMouseMove)
    this.canvas.addEventListener('mouseleave', this._onMouseLeave)
    window.addEventListener('mouseup', this._onMouseUp)

    this.canvas.addEventListener('touchstart',  this._onTouchStart,  { passive: false })
    this.canvas.addEventListener('touchmove',   this._onTouchMove,   { passive: false })
    this.canvas.addEventListener('touchcancel', this._onTouchCancel)
    window.addEventListener('touchend', this._onTouchEnd)
  }

  destroy(): void {
    this.destroyed = true

    // Remove all listeners so they don't accumulate across game sessions
    this.canvas.removeEventListener('mousedown',  this._onMouseDown)
    this.canvas.removeEventListener('mousemove',  this._onMouseMove)
    this.canvas.removeEventListener('mouseleave', this._onMouseLeave)
    window.removeEventListener('mouseup', this._onMouseUp)

    this.canvas.removeEventListener('touchstart',  this._onTouchStart)
    this.canvas.removeEventListener('touchmove',   this._onTouchMove)
    this.canvas.removeEventListener('touchcancel', this._onTouchCancel)
    window.removeEventListener('touchend', this._onTouchEnd)

    this.isDragging = false
    this.dragIndex = null
    this.hoverIndex = null
    this.selectedIndex = null
    this.placingViaTap = false
    this.lastGhostValid = null
    this.onHoverChange?.(null)
    ;(window as any).activeGhost = null
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private isTap(clientX: number, clientY: number): boolean {
    const elapsed = Date.now() - this.tapStartTime
    const dx = clientX - this.tapStartClientX
    const dy = clientY - this.tapStartClientY
    return elapsed < 220 && Math.sqrt(dx * dx + dy * dy) < 12
  }

  private snapToNearest(
    shape: ShapeDefinition,
    center: { row: number; col: number }
  ): { row: number; col: number } | null {
    // Check orthogonal neighbours first (distance 1), then diagonals (√2)
    const candidates = [
      { dr: 0, dc: -1 }, { dr: 0, dc: 1 }, { dr: -1, dc: 0 }, { dr: 1, dc: 0 },
      { dr: -1, dc: -1 }, { dr: -1, dc: 1 }, { dr: 1, dc: -1 }, { dr: 1, dc: 1 },
    ]
    for (const { dr, dc } of candidates) {
      const r = center.row + dr
      const c = center.col + dc
      if (r >= 0 && r < 9 && c >= 0 && c < 9 && this.canPlace(shape, r, c)) {
        return { row: r, col: c }
      }
    }
    return null
  }

  private updateGhost(
    shape: ShapeDefinition,
    clientX: number,
    clientY: number,
    useFingerOffset: boolean
  ): void {
    let lookupY = clientY
    if (useFingerOffset) {
      const cellSizeScreen = this.gridRenderer.getCellSizeInScreen()
      const maxRow = Math.max(...(shape.cells as [number, number][]).map(([r]) => r))
      lookupY = clientY - (maxRow + 1.5) * cellSizeScreen
    }

    const gridPos = this.gridRenderer.screenToGrid(clientX, lookupY)
    if (gridPos) {
      const isValid = this.canPlace(shape, gridPos.row, gridPos.col)
      if (isValid && this.lastGhostValid !== true) hapticSelection()
      this.lastGhostValid = isValid
      this.ghostPos = gridPos
      ;(window as any).activeGhost = { ...gridPos, valid: isValid }
    } else {
      this.ghostPos = null
      this.lastGhostValid = null
      ;(window as any).activeGhost = null
    }
  }

  private tryPlace(pieceIndex: number, pos: { row: number; col: number }, shape: ShapeDefinition): boolean {
    let placePos: { row: number; col: number } | null = pos
    if (!this.canPlace(shape, placePos.row, placePos.col)) {
      placePos = this.snapToNearest(shape, placePos)
    }
    if (placePos && this.canPlace(shape, placePos.row, placePos.col)) {
      this.onPlace(pieceIndex, placePos.row, placePos.col)
      return true
    }
    return false
  }

  // ── Event handlers ────────────────────────────────────────────────────────

  private handleStart(e: MouseEvent | Touch) {
    if (this.destroyed) return
    const rect = this.canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (this.canvas.width / rect.width)
    const y = (e.clientY - rect.top) * (this.canvas.height / rect.height)
    const pieces = (window as any).currentPieces || []

    this.tapStartTime = Date.now()
    this.tapStartClientX = e.clientX
    this.tapStartClientY = e.clientY

    if (this.selectedIndex !== null) {
      // A piece is already tap-selected — figure out what user tapped
      const trayHit = this.pieceRenderer.hitTestTray(x, y, pieces)
      if (trayHit !== null) {
        // Tapped a tray slot — start drag (tap-end will decide select vs drag)
        this.isDragging = true
        this.dragIndex = trayHit
        this.dragPos = { x, y }
        this.lastGhostValid = null
        this.onHoverChange?.(null)
      } else {
        // Tapped on board — start board-tap placement
        const gridPos = this.gridRenderer.screenToGrid(e.clientX, e.clientY)
        if (gridPos) {
          this.placingViaTap = true
          const shape = pieces[this.selectedIndex]
          if (shape) {
            const isValid = this.canPlace(shape, gridPos.row, gridPos.col)
            this.ghostPos = gridPos
            ;(window as any).activeGhost = { ...gridPos, valid: isValid }
          }
        } else {
          // Tapped completely outside — deselect
          this.selectedIndex = null
          this.ghostPos = null
          ;(window as any).activeGhost = null
        }
      }
    } else {
      // No selection — normal tray drag-start
      const index = this.pieceRenderer.hitTestTray(x, y, pieces)
      if (index !== null) {
        this.isDragging = true
        this.dragIndex = index
        this.dragPos = { x, y }
        this.hoverIndex = null
        this.lastGhostValid = null
        this.onHoverChange?.(null)
      }
    }
  }

  private handleMove(e: MouseEvent | Touch) {
    if (this.destroyed) return
    const rect = this.canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (this.canvas.width / rect.width)
    const y = (e.clientY - rect.top) * (this.canvas.height / rect.height)
    const pieces = (window as any).currentPieces || []

    // Board-tap placement — ghost follows finger on the board directly
    if (this.placingViaTap && this.selectedIndex !== null) {
      const shape = pieces[this.selectedIndex]
      if (shape) this.updateGhost(shape, e.clientX, e.clientY, false)
      return
    }

    // Active drag — on touch, offset the ghost above the finger so placement
    // is visible without the finger covering the landing zone
    if (this.isDragging && this.dragIndex !== null) {
      this.dragPos = { x, y }
      const shape = pieces[this.dragIndex]
      if (!shape) {
        this.ghostPos = null
        ;(window as any).activeGhost = null
        return
      }
      this.updateGhost(shape, e.clientX, e.clientY, this.isTouch)
      return
    }

    // Idle with selection — ghost tracks cursor/finger (desktop hover + mobile prep)
    if (this.selectedIndex !== null) {
      const shape = pieces[this.selectedIndex]
      if (shape) this.updateGhost(shape, e.clientX, e.clientY, false)
      return
    }

    // Idle without selection — tray hover highlight
    const hovered = this.pieceRenderer.hitTestTray(x, y, pieces)
    if (hovered !== this.hoverIndex) {
      this.hoverIndex = hovered
      this.onHoverChange?.(hovered)
    }
  }

  private handleEnd(e: MouseEvent | Touch) {
    if (this.destroyed) return

    // ── Board-tap placement ──────────────────────────────────────────────
    if (this.placingViaTap) {
      this.placingViaTap = false
      if (this.selectedIndex !== null && this.ghostPos) {
        const pieces = (window as any).currentPieces || []
        const shape = pieces[this.selectedIndex]
        if (shape && this.tryPlace(this.selectedIndex, this.ghostPos, shape)) {
          this.selectedIndex = null
        }
      }
      this.ghostPos = null
      this.lastGhostValid = null
      ;(window as any).activeGhost = null
      return
    }

    // ── Drag end ─────────────────────────────────────────────────────────
    if (!this.isDragging || this.dragIndex === null) return

    const pieces = (window as any).currentPieces || []
    const shape = pieces[this.dragIndex]
    const wasTap = this.isTap(e.clientX, e.clientY)

    if (wasTap) {
      // Quick tap — toggle selection
      if (this.selectedIndex === this.dragIndex) {
        // Tap same piece again → deselect
        this.selectedIndex = null
        this.ghostPos = null
        ;(window as any).activeGhost = null
      } else {
        // Select this piece (switch if another was selected)
        this.selectedIndex = this.dragIndex
      }
    } else {
      // Real drag — drop with snap
      if (shape && this.ghostPos) {
        if (this.tryPlace(this.dragIndex, this.ghostPos, shape)) {
          this.selectedIndex = null
        }
      }
      this.ghostPos = null
      ;(window as any).activeGhost = null
    }

    this.isDragging = false
    this.dragIndex = null
    this.hoverIndex = null
    this.lastGhostValid = null
    this.onHoverChange?.(null)
  }

  getDragState() {
    return {
      isDragging: this.isDragging,
      dragIndex: this.dragIndex,
      dragPos: this.dragPos,
      selectedIndex: this.selectedIndex,
      isTouch: this.isTouch,
    }
  }
}
