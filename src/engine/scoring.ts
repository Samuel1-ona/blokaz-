import type { ShapeDefinition } from './shapes'

// ─────────────────────────────────────────────────────────────
// SCORE TIER SYSTEM
// 8 tiers unlocked every 5,000 points, each with a distinct
// visual look and (eventually) a gameplay mechanic modifier.
// ─────────────────────────────────────────────────────────────

export interface TierInfo {
  /** 0-indexed tier id (0 = PAPER … 7 = GLITCH) */
  id: number
  name: string
  /** Point range string e.g. "0 – 5,000" */
  range: string
  /** Primary accent color for this tier */
  accent: string
  /** Flavour text shown on tier-up */
  flavor: string
  /** Optional gameplay mechanic description */
  mechanic: string | null
}

// ─────────────────────────────────────────────────────────────
// TIER THRESHOLDS — exponential spacing, psychology-first
//
// T1  0 – 500      First achievement arrives in <3 min (~3 clears or 1 combo).
//                  Keeps the default look familiar for new players.
//
// T2  500 – 1,500  Flow channel — widest visual window (1,000 pts) so players
//                  stay in STICKER without constant tier-up interruption.
//                  Csikszentmihalyi: don't break flow at peak engagement.
//
// T3  1,500 – 4,000  The critical "mastery" gate (×2.7 from T2 top).
//                  Requires consistent combo chaining, not just lucky clears.
//
// T4  4,000 – 9,000  Elite territory (×2.25). PIXEL faces signal you've earned
//                  your way into the top ~20% of sessions.
//
// T5  9,000 – 20,000  Dark shift — the most psychologically impactful moment.
//                  Light → NEON is a rupture. Most casual players never reach
//                  here, making it aspirational and elite-signalling.
//
// T6  20,000 – 45,000  COSMIC. Double-digit-thousand club. ~×2.25.
//
// T7  45,000 – 100,000  LIQUID. Near-impossible for most. ×2.2.
//
// T8  100,000+      GLITCH. Legendary. Seen by <1% of players.
// ─────────────────────────────────────────────────────────────

export const TIERS: TierInfo[] = [
  {
    id: 0,
    name: 'PAPER',
    range: '0 – 500',
    accent: '#ffd51f',
    flavor: 'The original. Flat ink, hard borders. Like the manual says.',
    mechanic: null,
  },
  {
    id: 1,
    name: 'STICKER',
    range: '500 – 1,500',
    accent: '#ff3bbd',
    flavor: 'Vinyl gloss. Looks like it should peel off the board.',
    mechanic: '+1 combo grace — one no-clear move keeps your streak alive',
  },
  {
    id: 2,
    name: 'STRIPED',
    range: '1,500 – 4,000',
    accent: '#ff7a1a',
    flavor: 'Loud diagonals. Reads at a glance even mid-combo.',
    mechanic: 'Near-complete rows glow — ghost-preview combo potential',
  },
  {
    id: 3,
    name: 'PIXEL',
    range: '4,000 – 9,000',
    accent: '#b7ff3b',
    flavor: '8-bit personalities. Each piece has a face. They have opinions.',
    mechanic: '2× base points on any line clear containing a PIXEL cell',
  },
  {
    id: 4,
    name: 'NEON',
    range: '9,000 – 20,000',
    accent: '#29e6e6',
    flavor: 'Late-night arcade. Pulses with whatever the soundtrack is doing.',
    mechanic: 'Combo bonus +50% while any NEON piece is on the board',
  },
  {
    id: 5,
    name: 'COSMIC',
    range: '20,000 – 45,000',
    accent: '#8a3dff',
    flavor: 'You broke 20k. Reality bends. The squares are stars now.',
    mechanic: 'COSMIC pieces clear DIAGONALS too — both directions',
  },
  {
    id: 6,
    name: 'LIQUID',
    range: '45,000 – 100,000',
    accent: '#29e6e6',
    flavor: "Pieces slosh. The board feels wet. Don't drop your phone.",
    mechanic: 'LIQUID pieces auto-settle one row down into any gap below them',
  },
  {
    id: 7,
    name: 'GLITCH',
    range: '100,000+',
    accent: '#ff3bbd',
    flavor: 'Reality stutters. RGB peels apart. Something is watching.',
    mechanic: 'Rare GLITCH piece may morph into a different shape on placement',
  },
]

export function getScoreTier(score: number): TierInfo {
  if (score < 500)     return TIERS[0]  // PAPER
  if (score < 1500)    return TIERS[1]  // STICKER
  if (score < 4000)    return TIERS[2]  // STRIPED  — mastery gate
  if (score < 9000)    return TIERS[3]  // PIXEL    — elite territory
  if (score < 20000)   return TIERS[4]  // NEON     — dark rupture
  if (score < 45000)   return TIERS[5]  // COSMIC
  if (score < 100000)  return TIERS[6]  // LIQUID
  return TIERS[7]                        // GLITCH   — legendary
}

export interface ScoreEvent {
  basePoints: number // piece.cellCount
  linePoints: number // linesCleared * 90
  comboBonus: number // linesCleared * newCombo * 50
  totalPoints: number // sum of above
  linesCleared: number
  newComboStreak: number // updated streak value
}

export function calculateScore(
  piece: ShapeDefinition,
  linesCleared: number,
  currentComboStreak: number
): ScoreEvent {
  const basePoints = piece.cellCount
  const linePoints = linesCleared * 10 * 9 // 90 per line

  let newComboStreak = 0
  let comboBonus = 0

  if (linesCleared > 0) {
    newComboStreak = currentComboStreak + 1
    comboBonus = linesCleared * newComboStreak * 50
  } else {
    newComboStreak = 0
    comboBonus = 0
  }

  const totalPoints = basePoints + linePoints + comboBonus

  return {
    basePoints,
    linePoints,
    comboBonus,
    totalPoints,
    linesCleared,
    newComboStreak,
  }
}
