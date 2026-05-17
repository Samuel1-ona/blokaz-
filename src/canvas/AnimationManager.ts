export type AnimationType = 'LINE_CLEAR' | 'COMBO' | 'SCORE' | 'SNAP' | 'DROP_FLASH'

interface Animation {
  type: AnimationType
  progress: number // 0 to 1
  duration: number
  params: any
}

const getThemeColor = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()

const withAlpha = (color: string, alpha: number) => {
  if (color.startsWith('#')) {
    const normalized = color.slice(1)
    const r = Number.parseInt(normalized.slice(0, 2), 16)
    const g = Number.parseInt(normalized.slice(2, 4), 16)
    const b = Number.parseInt(normalized.slice(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  return color
}

export class AnimationManager {
  private animations: Animation[] = []

  trigger(type: AnimationType, params: any): void {
    const duration = type === 'COMBO' ? 800 : type === 'LINE_CLEAR' ? 500 : type === 'DROP_FLASH' ? 220 : 300
    this.animations.push({ type, progress: 0, duration, params })
  }

  update(deltaTime: number): void {
    this.animations.forEach((anim) => {
      anim.progress += deltaTime / anim.duration
    })
    this.animations = this.animations.filter((anim) => anim.progress < 1)
  }

  draw(
    ctx: CanvasRenderingContext2D,
    cellSize: number,
    isTournament: boolean = false
  ): void {
    this.animations.forEach((anim) => {
      ctx.save()
      if (anim.type === 'LINE_CLEAR') {
        const { rows, cols } = anim.params
        ctx.fillStyle = isTournament
          ? `rgba(255, 184, 214, ${0.45 * (1 - anim.progress)})`
          : `rgba(183, 255, 59, ${0.45 * (1 - anim.progress)})`

        rows?.forEach((r: number) => {
          ctx.fillRect(0, r * cellSize, 9 * cellSize, cellSize)
          
          // Draw "CLEAR!" sticker at the start of each row
          if (anim.progress < 0.6) {
            const inkColor = getThemeColor('--ink')
            const limeColor = getThemeColor('--accent-lime')
            ctx.save()
            ctx.translate(cellSize * 1.5, r * cellSize + cellSize / 2)
            ctx.rotate(-0.1)
            ctx.fillStyle = inkColor
            ctx.fillRect(-45, -18, 90, 36)
            ctx.strokeStyle = limeColor
            ctx.lineWidth = 3
            ctx.strokeRect(-45, -18, 90, 36)
            ctx.fillStyle = limeColor
            ctx.font = 'bold 16px "Archivo Black"'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText('CLEAR!', 0, 0)
            ctx.restore()
          }
        })
        cols?.forEach((c: number) => {
          ctx.fillRect(c * cellSize, 0, cellSize, 9 * cellSize)
        })
      } else if (anim.type === 'DROP_FLASH') {
        const { cells } = anim.params as { cells: { row: number; col: number }[] }
        // Bright white flash that fades out quickly — confirms the drop landed
        const alpha = Math.max(0, 0.55 * (1 - anim.progress * 1.6))
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
        for (const { row, col } of cells) {
          ctx.fillRect(col * cellSize + 1, row * cellSize + 1, cellSize - 2, cellSize - 2)
        }
        // Lime outline that lingers slightly longer
        const outlineAlpha = Math.max(0, 0.8 * (1 - anim.progress))
        ctx.strokeStyle = `rgba(140, 255, 60, ${outlineAlpha})`
        ctx.lineWidth = 2.5
        ctx.setLineDash([])
        for (const { row, col } of cells) {
          ctx.strokeRect(col * cellSize + 1.5, row * cellSize + 1.5, cellSize - 3, cellSize - 3)
        }
      } else if (anim.type === 'SCORE') {
        const { x, y, score } = anim.params
        const inkColor = getThemeColor('--ink')
        ctx.fillStyle = isTournament ? getThemeColor('--accent-cyan') : inkColor
        ctx.globalAlpha = 1 - anim.progress
        ctx.font = '22px "Archivo Black"'
        ctx.shadowColor = 'rgba(0,0,0,0.3)'
        ctx.shadowBlur = 4
        ctx.fillText(`+${score}`, x, y - anim.progress * 60)
      } else if (anim.type === 'COMBO') {
        const { streak } = anim.params
        const center = ctx.canvas.width / 2
        const accentColor = getThemeColor('--accent')
        
        // Sunburst/Flash effect
        if (anim.progress < 0.5) {
          ctx.fillStyle = withAlpha(accentColor, Math.max(0, 0.2 - anim.progress * 0.4))
          ctx.beginPath()
          ctx.arc(center, ctx.canvas.height / 2, anim.progress * 800, 0, Math.PI * 2)
          ctx.fill()
        }

        ctx.textAlign = 'center'
        const pinkColor = getThemeColor('--accent-pink')
        const redColor = getThemeColor('--danger')
        const inkColor = getThemeColor('--ink')

        ctx.fillStyle = isTournament ? pinkColor : redColor
        ctx.strokeStyle = inkColor
        ctx.lineWidth = 8
        const scale = 1 + Math.sin(anim.progress * Math.PI) * 0.2
        ctx.font = `${Math.floor(48 * scale)}px "Archivo Black"`
        
        const yPos = ctx.canvas.height / 2 - anim.progress * 150
        const text = `COMBO!`
        ctx.strokeText(text, center, yPos)
        ctx.fillText(text, center, yPos)
        
        // Subtext xN
        ctx.font = `${Math.floor(28 * scale)}px "Archivo Black"`
        ctx.fillStyle = isTournament ? getThemeColor('--accent-lime') : getThemeColor('--accent-yellow')
        ctx.strokeText(`x${streak}`, center, yPos + 40)
        ctx.fillText(`x${streak}`, center, yPos + 40)
      }
      ctx.restore()
    })
  }
}
