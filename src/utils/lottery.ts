/**
 * Blokaz Lottery — prize pool, random draw, and daily threshold tracking.
 *
 * Rules:
 *  - Max 3 spins per calendar day (resets at midnight local time)
 *  - Each threshold can only trigger once per day
 *  - Tracking is in localStorage so it survives page reloads within a day
 */

export interface Prize {
  id: 'multi' | 'revival' | 'bonus' | 'cosmetic' | 'nothing'
  name: string
  sub: string
  bg: string
  fg: string
  accent: string
  glyph: string
  hype: string
  rarity: 'rare' | 'uncommon' | 'common'
  body: string
}

export const PRIZES: Prize[] = [
  {
    id: 'multi',
    name: 'MULTIPLIER',
    sub: '×2 ON NEXT 3',
    bg: '#FFD51F',
    fg: '#0C0C10',
    accent: '#FF7A1A',
    glyph: '×2',
    hype: 'TOP REWARD',
    rarity: 'rare',
    body: 'Next 3 placements score double points.',
  },
  {
    id: 'revival',
    name: 'REVIVAL',
    sub: '1 SAVE STORED',
    bg: '#FF3D3D',
    fg: '#ffffff',
    accent: '#FFD51F',
    glyph: '↻',
    hype: 'SAVED!',
    rarity: 'uncommon',
    body: 'Use in this session — skip a $0.001 revive fee.',
  },
  {
    id: 'bonus',
    name: 'BONUS PTS',
    sub: '+500 ADDED',
    bg: '#B7FF3B',
    fg: '#0C0C10',
    accent: '#0C0C10',
    glyph: '+500',
    hype: 'BONUS!',
    rarity: 'common',
    body: 'Flat bonus dropped onto your score right now.',
  },
  {
    id: 'cosmetic',
    name: 'COSMETIC',
    sub: 'BOARD SKIN',
    bg: '#FF3BBD',
    fg: '#0C0C10',
    accent: '#8A3DFF',
    glyph: '◆',
    hype: 'UNLOCKED!',
    rarity: 'rare',
    body: 'New piece-colour pack unlocked in your Shop.',
  },
  {
    id: 'nothing',
    name: 'NEXT TIME',
    sub: 'BETTER LUCK',
    bg: '#F5EFE3',
    fg: '#0C0C10',
    accent: '#0C0C10',
    glyph: '—',
    hype: 'NOT TODAY',
    rarity: 'common',
    body: 'No reward this spin. Keep stacking blocks.',
  },
]

// Weighted draw — rare=1, uncommon=2, common=4
const WEIGHTS: Record<Prize['id'], number> = {
  multi: 1,
  revival: 2,
  bonus: 4,
  cosmetic: 1,
  nothing: 4,
}

export function getRandomPrize(): Prize {
  const total = PRIZES.reduce((s, p) => s + WEIGHTS[p.id], 0)
  let r = Math.random() * total
  for (const p of PRIZES) {
    r -= WEIGHTS[p.id]
    if (r <= 0) return p
  }
  return PRIZES[PRIZES.length - 1]
}

// ─── Score thresholds that trigger the lottery ─────────────────────────────
export const LOTTERY_THRESHOLDS = [500, 1500, 4000, 9000, 20000, 45000, 100000]

/** Maximum lottery spins allowed per calendar day */
export const MAX_DAILY_SPINS = 3

// ─── Daily tracking (localStorage, resets at midnight) ────────────────────
const DAILY_KEY = 'blokaz:lottery_daily'

interface DailyRecord {
  date: string        // 'YYYY-MM-DD'
  thresholds: number[] // which thresholds have already triggered today
  spinsUsed: number   // how many spins have been consumed today
}

function today(): string {
  return new Date().toISOString().slice(0, 10) // 'YYYY-MM-DD'
}

function readDaily(): DailyRecord {
  try {
    const raw = localStorage.getItem(DAILY_KEY)
    if (!raw) return { date: today(), thresholds: [], spinsUsed: 0 }
    const parsed: DailyRecord = JSON.parse(raw)
    // New day → reset
    if (parsed.date !== today()) return { date: today(), thresholds: [], spinsUsed: 0 }
    return parsed
  } catch {
    return { date: today(), thresholds: [], spinsUsed: 0 }
  }
}

function writeDaily(record: DailyRecord): void {
  try { localStorage.setItem(DAILY_KEY, JSON.stringify(record)) } catch {}
}

/**
 * Returns the threshold that was just crossed and is eligible for a lottery
 * spin, or null if:
 *  - no threshold was crossed
 *  - today's daily spin limit (3) is reached
 *  - that threshold already triggered today
 */
export function checkLotteryTrigger(score: number, prevScore: number): number | null {
  const record = readDaily()
  if (record.spinsUsed >= MAX_DAILY_SPINS) return null

  for (const t of LOTTERY_THRESHOLDS) {
    if (prevScore < t && score >= t && !record.thresholds.includes(t)) {
      return t
    }
  }
  return null
}

/** Record that a threshold was used today and consume one daily spin. */
export function markLotteryThreshold(threshold: number): void {
  const record = readDaily()
  writeDaily({
    ...record,
    thresholds: record.thresholds.includes(threshold)
      ? record.thresholds
      : [...record.thresholds, threshold],
    spinsUsed: record.spinsUsed + 1,
  })
}

/** How many spins remain today (0-3). */
export function getDailySpinsRemaining(): number {
  return Math.max(0, MAX_DAILY_SPINS - readDaily().spinsUsed)
}

/**
 * Per-session ref reset — called on new game start so threshold detection
 * starts fresh for prevScore tracking (daily limits still apply).
 */
export function resetLotterySession(): void {
  // No-op now that tracking is daily; kept for API compatibility.
}
