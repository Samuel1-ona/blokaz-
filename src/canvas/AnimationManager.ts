export type AnimationType = 'LINE_CLEAR' | 'COMBO' | 'SCORE' | 'SNAP' | 'DROP_FLASH' | 'TIER_UP'

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
    const duration =
      type === 'COMBO'      ? 800  :
      type === 'LINE_CLEAR' ? 500  :
      type === 'DROP_FLASH' ? 220  :
      type === 'TIER_UP'    ? 2400 :
      300
    // Only one TIER_UP at a time
    if (type === 'TIER_UP') {
      this.animations = this.animations.filter((a) => a.type !== 'TIER_UP')
    }
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
    const boardW = 9 * cellSize

    this.animations.forEach((anim) => {
      ctx.save()

      if (anim.type === 'LINE_CLEAR') {
        const { rows, cols, accent } = anim.params
        const clearColor = accent
          ? withAlpha(accent, 0.45 * (1 - anim.progress))
          : isTournament
            ? `rgba(255, 184, 214, ${0.45 * (1 - anim.progress)})`
            : `rgba(183, 255, 59, ${0.45 * (1 - anim.progress)})`

        ctx.fillStyle = clearColor

        rows?.forEach((r: number) => {
          ctx.fillRect(0, r * cellSize, boardW, cellSize)

          // CLEAR! sticker
          if (anim.progress < 0.6) {
            const inkColor = getThemeColor('--ink')
            const limeColor = accent ?? getThemeColor('--accent-lime')
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
          ctx.fillRect(c * cellSize, 0, cellSize, boardW)
        })

      } else if (anim.type === 'DROP_FLASH') {
        const { cells } = anim.params as { cells: { row: number; col: number }[] }
        const alpha = Math.max(0, 0.55 * (1 - anim.progress * 1.6))
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
        for (const { row, col } of cells) {
          ctx.fillRect(col * cellSize + 1, row * cellSize + 1, cellSize - 2, cellSize - 2)
        }
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
        const center = boardW / 2
        const accentColor = getThemeColor('--accent')

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
        ctx.strokeText('COMBO!', center, yPos)
        ctx.fillText('COMBO!', center, yPos)

        ctx.font = `${Math.floor(28 * scale)}px "Archivo Black"`
        ctx.fillStyle = isTournament ? getThemeColor('--accent-lime') : getThemeColor('--accent-yellow')
        ctx.strokeText(`x${streak}`, center, yPos + 40)
        ctx.fillText(`x${streak}`, center, yPos + 40)

      } else if (anim.type === 'TIER_UP') {
        // ─── TIER UP REVEAL ───────────────────────────────────────
        // 3 phases: 0-0.25 sunburst in, 0.25-0.75 hold, 0.75-1 fade out
        const { tierName, accent } = anim.params as { tierName: string; accent: string }
        const p = anim.progress

        const inP   = Math.min(1, p / 0.25)
        const outP  = Math.max(0, (p - 0.75) / 0.25)
        const alpha = 1 - outP

        if (alpha <= 0) { ctx.restore(); return }

        const center = boardW / 2
        const midY   = 9 * cellSize / 2

        // Dark overlay with blur-like feel
        ctx.globalAlpha = alpha * 0.82
        ctx.fillStyle = '#0c0c10'
        ctx.fillRect(0, 0, boardW, 9 * cellSize)

        // Sunburst conic rays
        ctx.globalAlpha = alpha * 0.55
        ctx.save()
        ctx.translate(center, midY)
        ctx.rotate(p * Math.PI * 0.5)
        const rays = 18
        for (let i = 0; i < rays; i++) {
          const a1 = (i / rays) * Math.PI * 2
          const a2 = ((i + 0.5) / rays) * Math.PI * 2
          const R = boardW * 0.9
          ctx.beginPath()
          ctx.moveTo(0, 0)
          ctx.arc(0, 0, R, a1, a2)
          ctx.closePath()
          if (i % 2 === 0) {
            const r2 = parseInt(accent.slice(1, 3), 16)
            const g2 = parseInt(accent.slice(3, 5), 16)
            const b2 = parseInt(accent.slice(5, 7), 16)
            ctx.fillStyle = `rgba(${r2},${g2},${b2},0.55)`
          } else {
            ctx.fillStyle = 'transparent'
          }
          ctx.fill()
        }
        ctx.restore()

        // Pill badge
        const scale2 = Math.min(1, inP * 1.15) * (1 - outP * 0.2)
        const badgeW = 280
        const badgeH = 80
        const bx = center - badgeW / 2
        const by = midY - badgeH / 2

        ctx.globalAlpha = alpha
        ctx.save()
        ctx.translate(center, midY)
        ctx.scale(scale2, scale2)
        ctx.translate(-center, -midY)

        // Shadow
        ctx.fillStyle = '#0c0c10'
        ctx.fillRect(bx + 7, by + 7, badgeW, badgeH)

        // Accent bg
        const ra = parseInt(accent.slice(1, 3), 16)
        const ga = parseInt(accent.slice(3, 5), 16)
        const ba = parseInt(accent.slice(5, 7), 16)
        ctx.fillStyle = accent
        ctx.fillRect(bx, by, badgeW, badgeH)
        ctx.strokeStyle = '#0c0c10'
        ctx.lineWidth = 4
        ctx.strokeRect(bx, by, badgeW, badgeH)

        // "TIER UP" label
        ctx.fillStyle = '#0c0c10'
        ctx.font = '13px "Archivo Black"'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('TIER UP', center, by + 22)

        // Tier name
        ctx.font = '34px "Archivo Black"'
        ctx.fillText(tierName, center, by + 54)

        ctx.restore()
      }

      ctx.restore()
    })
  }
}
