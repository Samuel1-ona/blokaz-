// Procedural sound engine for Blokaz — all sounds synthesized with Web Audio API.
// No external assets; context is lazily created on first user interaction.

const KEY_ENABLED = 'blokaz-sfx-on'
const KEY_VOLUME  = 'blokaz-sfx-vol'

class BlokAudioEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private _enabled: boolean
  private _volume: number

  constructor() {
    this._enabled = typeof localStorage !== 'undefined'
      ? localStorage.getItem(KEY_ENABLED) !== 'false'
      : true
    this._volume = typeof localStorage !== 'undefined'
      ? (parseFloat(localStorage.getItem(KEY_VOLUME) ?? '0.65') || 0.65)
      : 0.65
  }

  get enabled() { return this._enabled }
  get volume()  { return this._volume  }

  setEnabled(v: boolean) {
    this._enabled = v
    try { localStorage.setItem(KEY_ENABLED, String(v)) } catch {}
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(v ? this._volume : 0, this.ctx.currentTime, 0.05)
    }
  }

  setVolume(v: number) {
    this._volume = v
    try { localStorage.setItem(KEY_VOLUME, String(v)) } catch {}
    if (this.master && this.ctx && this._enabled) {
      this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05)
    }
  }

  // Returns a live AudioContext, lazily creating it on first call.
  // Returns null if audio is disabled or the API is unavailable.
  private g(): AudioContext | null {
    if (!this._enabled) return null
    try {
      if (!this.ctx) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Ctx = window.AudioContext || (window as any).webkitAudioContext
        if (!Ctx) return null
        this.ctx    = new Ctx()
        this.master = this.ctx.createGain()
        this.master.gain.value = this._volume
        this.master.connect(this.ctx.destination)
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return this.ctx
    } catch { return null }
  }

  // Single oscillator with optional frequency sweep.
  private tone(
    freq: number, type: OscillatorType, dur: number,
    vol = 1, at = 0, freqEnd?: number,
  ) {
    const ctx = this.g(); if (!ctx || !this.master) return
    const now  = ctx.currentTime + at
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, now)
    if (freqEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), now + dur * 0.85)
    }
    gain.gain.setValueAtTime(0.001, now)
    gain.gain.linearRampToValueAtTime(vol, now + 0.007)
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur)
    osc.connect(gain)
    gain.connect(this.master)
    osc.start(now)
    osc.stop(now + dur + 0.01)
  }

  // White-noise burst through a filter.
  private noise(
    dur: number, filterFreq: number, vol = 1, at = 0,
    filterType: BiquadFilterType = 'bandpass',
  ) {
    const ctx = this.g(); if (!ctx || !this.master) return
    const now = ctx.currentTime + at
    const len = Math.ceil(ctx.sampleRate * (dur + 0.06))
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d   = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    const src    = ctx.createBufferSource()
    src.buffer   = buf
    const filter = ctx.createBiquadFilter()
    filter.type  = filterType
    filter.frequency.value = filterFreq
    filter.Q.value = filterType === 'bandpass' ? 2.2 : 0.7
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(vol, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur)
    src.connect(filter)
    filter.connect(gain)
    gain.connect(this.master)
    src.start(now)
    src.stop(now + dur + 0.06)
  }

  // ── Game events ────────────────────────────────────────────────────────────

  piecePlaced() {
    this.noise(0.065, 270, 0.52)
    this.tone(125, 'sine', 0.095, 0.32, 0.004)
  }

  lineClear(count = 1) {
    // Rising arpeggio — higher count = more notes = more dramatic
    const base  = 392 // G4
    const steps = [1, 1.26, 1.498, 2, 2.52]
    const n = Math.min(count + 1, steps.length)
    for (let i = 0; i < n; i++) {
      this.tone(base * steps[i], 'triangle', 0.33, 0.42 - i * 0.04, i * 0.074)
    }
    this.noise(0.11, 4800, 0.16, n * 0.074, 'bandpass')
    if (count >= 2) this.tone(base * 3, 'sine', 0.22, 0.28, n * 0.074 + 0.05)
  }

  combo(streak: number) {
    const SCALE = [261, 294, 330, 370, 415, 466, 523, 587, 659, 740, 880]
    const freq  = SCALE[Math.min(streak - 2, SCALE.length - 1)]
    this.tone(freq, 'triangle', 0.28, 0.46)
    this.tone(freq * 1.5, 'sine', 0.18, 0.24, 0.065)
    if (streak >= 5) this.noise(0.09, 2400, 0.14, 0.09)
  }

  gameOver() {
    this.tone(235, 'sawtooth', 0.45, 0.40)
    this.tone(176, 'sawtooth', 0.52, 0.38, 0.12)
    this.tone(132, 'sawtooth', 0.58, 0.40, 0.26)
    this.tone(99,  'sine',     0.68, 0.45, 0.42)
    this.noise(0.68, 105, 0.55, 0.40, 'lowpass')
  }

  tierUp() {
    const arp = [261, 329, 392, 523, 659, 784]
    arp.forEach((f, i) => {
      this.tone(f, 'triangle', 0.50 - i * 0.03, 0.50, i * 0.088)
      if (i >= 3) this.tone(f * 2, 'sine', 0.28, 0.22, i * 0.088)
    })
    this.noise(0.2, 3200, 0.18, 0.44)
  }

  // ── Power-ups ──────────────────────────────────────────────────────────────

  scoreBoost() {
    // Electric charge-up: sawtooth frequency sweep + bright burst
    const ctx = this.g(); if (!ctx || !this.master) return
    const now  = ctx.currentTime
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(110, now)
    osc.frequency.exponentialRampToValueAtTime(1600, now + 0.23)
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.28, now + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28)
    osc.connect(gain)
    gain.connect(this.master)
    osc.start(now)
    osc.stop(now + 0.30)
    // Burst on peak
    this.noise(0.13, 4200, 0.22, 0.22)
    this.tone(1760, 'sine', 0.28, 0.38, 0.24)
    this.tone(2200, 'sine', 0.18, 0.26, 0.28)
  }

  shield() {
    // Low whomp sweep + metallic ring
    const ctx = this.g(); if (!ctx || !this.master) return
    const now  = ctx.currentTime
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(72, now)
    osc.frequency.exponentialRampToValueAtTime(360, now + 0.18)
    osc.frequency.exponentialRampToValueAtTime(185, now + 0.50)
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.52, now + 0.020)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55)
    osc.connect(gain)
    gain.connect(this.master)
    osc.start(now)
    osc.stop(now + 0.58)
    this.noise(0.18, 680, 0.20, 0.065)
    this.tone(880,  'triangle', 0.52, 0.35, 0.17)
    this.tone(1320, 'sine',     0.34, 0.20, 0.22)
  }

  bomb() {
    // Two mechanical arm-clicks
    this.noise(0.022, 2900, 0.58)
    this.noise(0.022, 2900, 0.44, 0.065)
    this.tone(78, 'sawtooth', 0.10, 0.28, 0.065)
  }

  bombBlast() {
    // Sub-bass thud + noise burst + high crack
    this.noise(0.58, 135, 0.92, 0, 'lowpass')
    this.noise(0.08, 5800, 0.56, 0, 'bandpass')
    this.tone(50, 'sine', 0.44, 0.72)
    this.tone(75, 'sine', 0.34, 0.54, 0.025)
    this.noise(0.30, 950, 0.32, 0.10, 'bandpass')
  }

  rotatePass() {
    // Square-wave mechanical whirr + three clicks
    const ctx = this.g(); if (!ctx || !this.master) return
    const now  = ctx.currentTime
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(265, now)
    osc.frequency.exponentialRampToValueAtTime(640, now + 0.22)
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.18, now + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26)
    osc.connect(gain)
    gain.connect(this.master)
    osc.start(now)
    osc.stop(now + 0.28)
    ;([0.065, 0.13, 0.20] as const).forEach(t => this.noise(0.022, 1950, 0.34, t))
  }

  shieldSave() {
    const freqs = [220, 330, 440, 660, 880, 1320]
    freqs.forEach((f, i) => {
      this.tone(f, 'sine', 0.42 - i * 0.025, 0.44 + i * 0.05, i * 0.068)
    })
    this.noise(0.32, 1700, 0.22, 0.38)
  }

  // Dispatch the right sound for a named power-up type.
  powerUp(type: string) {
    switch (type) {
      case 'scoreBoost': this.scoreBoost(); break
      case 'shield':     this.shield();     break
      case 'bomb':       this.bomb();       break
      case 'rotatePass': this.rotatePass(); break
    }
  }
}

export const audioEngine = new BlokAudioEngine()
