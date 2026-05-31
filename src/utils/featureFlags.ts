// ── Feature gate: shop + lottery only for these addresses ──────
const SHOP_LOTTERY_WHITELIST = new Set([
  '0xa09dc4b3ac1a2835eb14bc975e2d220b0c63c171',
  '0xcf6864d109724621cb94486ff2859977ab7efa5f',
  '0x9d089d7f439d458a787178b7f14312881c3bb443',
])

export const isShopLotteryEnabled = (addr?: string): boolean =>
  !!addr && SHOP_LOTTERY_WHITELIST.has(addr.toLowerCase())
