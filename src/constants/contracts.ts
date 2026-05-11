// ── Treasury ──────────────────────────────────────────────────────────────────

export const GAME_TREASURY = '0x3E325B45F72dFCc3875f75b5933A5da183Ec4225' as `0x${string}`

// ── Stablecoin Retrieve ───────────────────────────────────────────────────────

export const STABLECOIN_TOKENS = {
  USDC: {
    address: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C' as `0x${string}`,
    decimals: 6,
    symbol: 'USDC',
    reviveCost: 1_000n,             // $0.001 in 6-decimal units
  },
  USDT: {
    address: '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e' as `0x${string}`,
    decimals: 6,
    symbol: 'USDT',
    reviveCost: 1_000n,             // $0.001 in 6-decimal units
  },
  USDm: {
    address: '0x765DE816845861e75A25fCA122bb6898B8B1282a' as `0x${string}`,
    decimals: 18,
    symbol: 'USDm',
    reviveCost: 1_000_000_000_000_000n, // $0.001 in 18-decimal units
  },
} as const

export type StablecoinSymbol = keyof typeof STABLECOIN_TOKENS
