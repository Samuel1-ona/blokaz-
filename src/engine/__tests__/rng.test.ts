import { describe, it, expect } from 'vitest'
import { DeterministicRNG, selectShape, dealThree } from '../rng'
import { SHAPES } from '../shapes'

describe('Deterministic RNG', () => {
  it('should produce identical sequences for the same seed', () => {
    const seed = 12345n
    const rng1 = new DeterministicRNG(seed)
    const rng2 = new DeterministicRNG(seed)

    for (let i = 0; i < 1000; i++) {
      expect(rng1.next()).toBe(rng2.next())
    }
  })

  it('should produce different sequences for different seeds', () => {
    const rng1 = new DeterministicRNG(1n)
    const rng2 = new DeterministicRNG(2n)

    let matches = 0
    for (let i = 0; i < 100; i++) {
      if (rng1.next() === rng2.next()) matches++
    }
    // Very unlikely to have many matches
    expect(matches).toBeLessThan(5)
  })

  it('output should always be in [0, 1)', () => {
    const rng = new DeterministicRNG(Date.now() === 0 ? 1n : BigInt(Date.now()))
    for (let i = 0; i < 10000; i++) {
      const val = rng.next()
      expect(val).toBeGreaterThanOrEqual(0)
      expect(val).toBeLessThan(1)
    }
  })

  it('nextInt should be within range', () => {
    const rng = new DeterministicRNG(42n)
    for (let i = 0; i < 1000; i++) {
      const val = rng.nextInt(10)
      expect(val).toBeGreaterThanOrEqual(0)
      expect(val).toBeLessThan(10)
      expect(Number.isInteger(val)).toBe(true)
    }
  })

  it('selectShape distribution should roughly match weights', () => {
    const rng = new DeterministicRNG(99n)
    const counts: Record<string, number> = {}
    const samples = 10000

    for (let i = 0; i < samples; i++) {
      const shape = selectShape(rng, SHAPES)
      counts[shape.id] = (counts[shape.id] || 0) + 1
    }

    // TOTAL_WEIGHT = 230 (37 shapes).
    // O3 weight=3  → expected 3/230 * 10000 ≈ 130
    // I3H weight=10 → expected 10/230 * 10000 ≈ 435
    expect(counts['O3'] || 0).toBeGreaterThan(60)
    expect(counts['O3'] || 0).toBeLessThan(260)
    expect(counts['I3H'] || 0).toBeGreaterThan(220)
    expect(counts['I3H'] || 0).toBeLessThan(650)
  })

  it('dealThree should return exactly 3 shapes', () => {
    const rng = new DeterministicRNG(7n)
    const trio = dealThree(rng, SHAPES)
    expect(trio.length).toBe(3)
    trio.forEach((s) => {
      expect(SHAPES).toContain(s)
    })
  })
})
