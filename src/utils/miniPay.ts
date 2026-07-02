declare global {
  interface Window {
    ethereum?: {
      isMiniPay?: boolean
      isMetaMask?: boolean
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
      [key: string]: unknown
    }
  }
}

// Static constant — may be false if MiniPay hasn't injected yet at module load
export const IS_MINIPAY: boolean =
  typeof window !== 'undefined' && window.ethereum?.isMiniPay === true

// Live check — always accurate, evaluated at call time
export const isMiniPay = (): boolean =>
  typeof window !== 'undefined' && !!(window.ethereum as any)?.isMiniPay

// Web browser = not running inside MiniPay
export const isWebBrowser = (): boolean => !isMiniPay()

// ─── Free-trial gate (web-only) ───────────────────────────────────────────────
const TRIAL_KEY = 'blokaz:web_trials_used'
const MAX_TRIALS = 1

function getTrialsUsed(): number {
  try { return parseInt(localStorage.getItem(TRIAL_KEY) ?? '0', 10) || 0 } catch { return 0 }
}

export function getTrialsRemaining(): number {
  return Math.max(0, MAX_TRIALS - getTrialsUsed())
}

export function markTrialUsed(): void {
  try {
    const used = getTrialsUsed()
    localStorage.setItem(TRIAL_KEY, String(used + 1))
  } catch {}
}

/** Returns true when the web user has used all free trials */
export function isWebTrialGated(): boolean {
  return isWebBrowser() && getTrialsUsed() >= MAX_TRIALS
}
