# BLOKAZ — Stack. Smash. Stake.

Blokaz is an on-chain block-stacking puzzle game built on the [Celo](https://celo.org) blockchain. Players stack blocks in a classic Tetris-style grid, compete on weekly leaderboards, enter paid tournaments for USDC prize pools, and earn [GoodDollar](https://www.gooddollar.org) UBI rewards — all from a mobile-first interface that runs natively inside [MiniPay](https://minipay.opera.com).

**Live:** [blokaz.xyz](https://www.blokaz.xyz)  
**Studio:** [Cracked Studios](https://crackedstudios.xyz)

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Smart Contracts](#smart-contracts)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Game Mechanics](#game-mechanics)
- [Tournament System](#tournament-system)
- [GoodDollar Integration](#gooddollar-integration)
- [Wallet Support](#wallet-support)
- [App Structure](#app-structure)
- [Scripts](#scripts)
- [Deployment](#deployment)

---

## Features

### Classic Mode
- Free-to-play block stacking with weekly leaderboard competition
- On-chain score submission with anti-cheat verification
- Daily streak system with up to 2× score multiplier
- Epoch-based seasons — weekly leaderboards with full historical navigation

### Tournament Mode
- Paid-entry tournaments with USDC prize pools
- Configurable entry fees, reward distributions (top N finishers), and duration
- Signature-based game submission (EIP-712) to prevent replay attacks
- Automatic settlement and prize distribution on finalization

### Mobile-First
- Runs as a MiniPay mini-app (Opera's Celo wallet)
- Social login via Web3Auth (Google, Twitter, email)
- RainbowKit for MetaMask / browser wallet users
- Static HTML splash renders before any JavaScript executes — near-instant first paint

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Build Tool | Vite 5 |
| Styling | Tailwind CSS |
| Web3 Primitives | Wagmi 2 + Viem 2 |
| Wallet UI | RainbowKit 2 |
| Social Login | Web3Auth Modal 9 |
| State | Zustand |
| Data Fetching | TanStack React Query 5 |
| Testing | Vitest + jsdom |
| Node Polyfills | `vite-plugin-node-polyfills` |

---

## Smart Contracts

All contracts are deployed on **Celo Mainnet** (chain ID `42220`).

| Contract | Address |
|----------|---------|
| Game | [`0x16C3A18FDcb6905f58311C5b8a6e91e447Fefe43`](https://explorer.celo.org/mainnet/address/0x16C3A18FDcb6905f58311C5b8a6e91e447Fefe43) |
| Tournament | [`0xaf3cb90f8002b4f08ba7f7c4fb5d9bde698236a7`](https://explorer.celo.org/mainnet/address/0xaf3cb90f8002b4f08ba7f7c4fb5d9bde698236a7) |
| USDC (prize token) | `0xcebA9300f2b948710d2653dD7B07f33A8B32118C` |

### Key Contract Functions

**Game**

| Function | Description |
|----------|-------------|
| `startGame(seedHash)` | Initialise a new classic game on-chain |
| `submitScore(gameId, seed, packedMoves, score, moveCount)` | Settle a game and record the score |
| `setUsername(name)` | Register or update a player's display name |
| `getCurrentEpoch()` | Current weekly epoch number |
| `getLeaderboard(epoch)` | Ranked entries for a given epoch |

**Tournament**

| Function | Description |
|----------|-------------|
| `joinTournament(tournamentId)` | Pay entry fee (USDC) and register |
| `startTournamentGame(id, seedHash, nonce, deadline, sig)` | Begin a tournament game with backend signature |
| `submitTournamentScore(id, gameId, score, deadline, sig)` | Submit score with EIP-712 proof |
| `finalizeTournament(tournamentId)` | Settle rewards after end time |
| `createTournament(fee, start, end, maxPlayers, rewardBps)` | Admin: create a new tournament |

---

## Getting Started

### Prerequisites

- Node.js ≥ 18
- A Celo-compatible wallet or the MiniPay app

### Installation

```bash
git clone https://github.com/your-org/blokaz.git
cd blokaz
npm install
```

### Running Locally

```bash
# Copy and fill in the environment variables
cp .env.example .env

# Start the dev server
npm run dev

# Or start the dev server + backend signer together
npm run dev:all
```

The app will be available at `http://localhost:5173`.

> **MiniPay testing:** Use [ngrok](https://ngrok.com) to expose your local server over HTTPS, then open the URL inside the MiniPay app. Add your ngrok hostname to `server.allowedHosts` in `vite.config.ts`.

---

## Environment Variables

Create a `.env` file at the project root (copy from `.env.example`):

```env
# WalletConnect — required for browser wallet UI (RainbowKit)
# Get a project ID at https://cloud.reown.com
VITE_WALLETCONNECT_PROJECT_ID=

# Celo RPC endpoint (defaults to https://forno.celo.org if omitted)
VITE_RPC=https://forno.celo.org

# Backend signer URL — issues EIP-712 signatures for tournament games
VITE_SIGNER_URL=http://localhost:3001

# Web3Auth — social login (Google / Twitter / email)
# Get credentials at https://dashboard.web3auth.io
VITE_WEB3AUTH_CLIENT_ID=
# sapphire_devnet for local dev (permissive), sapphire_mainnet for production
VITE_WEB3AUTH_NETWORK=sapphire_devnet
```

> **Web3Auth production setup:** Set `VITE_WEB3AUTH_NETWORK=sapphire_mainnet` and whitelist your domain at [dashboard.web3auth.io](https://dashboard.web3auth.io) → your project → Whitelist URLs.

---

## Game Mechanics

### Classic Mode Flow

1. Player clicks **PLAY CLASSIC** from the lobby
2. A random seed is generated client-side; its hash is committed on-chain via `startGame`
3. The player stacks blocks — moves are recorded locally
4. On game over, `submitScore` sends the seed, packed moves, score, and move count to the contract
5. The contract performs a spot-check replay of a random subset of moves to verify integrity
6. The verified score is recorded against the player's address for the current epoch

### Epochs & Leaderboard

- Each epoch lasts one week (measured in Celo blocks)
- Scores are scoped per epoch — fresh competition every week
- Historical epochs remain readable on-chain; the in-app leaderboard lets players navigate any past week using the `‹` / `›` buttons
- Season number is derived from epoch: `Season = Math.floor(epoch / 12) + 1`

### Daily Streak

- A streak counter is stored in `localStorage`
- Playing on consecutive days earns a score multiplier bonus up to **2×**
- The lobby shows a 7-day progress bar; completing a full week resets to a new streak

### Anti-Cheat

- Moves are packed into `uint256` arrays and submitted alongside the original random seed
- The contract replays a spot-check of a random subset of submitted moves against the seed
- A failed spot-check voids the submission

---

## Tournament System

### Entering a Tournament

1. Browse open tournaments in the **Tournament Hall** (`#/tournaments`)
2. Approve USDC spending allowance for the tournament contract
3. Call `joinTournament` — the entry fee is transferred immediately
4. The backend signer issues an EIP-712 `startGame` signature valid for this player and tournament
5. Use the signature to call `startTournamentGame` and begin playing

### Score Submission

- On game over, the frontend requests a `submitScore` signature from the backend signer
- The EIP-712 signature includes a deadline to prevent replay attacks
- `submitTournamentScore` is called with the score and signature; the contract verifies and records it

### Settlement

- Once the tournament `endTime` passes, anyone can call `finalizeTournament` to distribute prizes
- Prize pool = total entry fees minus protocol fee (configurable in basis points)
- Rewards are split according to the `rewardBps` array — e.g. `[5000, 3000, 2000]` for 50 / 30 / 20% top 3

---

## Wallet Support

### MiniPay (Mobile)

- Detected via `window.ethereum.isMiniPay === true`
- Auto-connects on mount — no wallet selection UI is shown
- Requires **type-0 (legacy) transactions** only — MiniPay's sandbox blocks EIP-1559 and rejects the `feeCurrency` field (CIP-64). All write calls use `{ type: 'legacy' }` overrides
- Gas is abstracted natively by MiniPay (sub-cent cost in the user's stablecoin)

### Web3Auth (Social Login)

- Google, Twitter, and email passwordless login
- Uses `@web3auth/modal` v9 with `EthereumPrivateKeyProvider` configured for Celo Mainnet
- Activated when the user clicks **SOCIAL** in the header
- Configured via `VITE_WEB3AUTH_CLIENT_ID` and `VITE_WEB3AUTH_NETWORK`

### MetaMask / Browser Wallets

- Powered by RainbowKit + WalletConnect
- A custom Viem transport falls back to direct Celo HTTP RPC for non-MiniPay providers — this prevents MetaMask (connected to a non-Celo chain) from silently returning empty `eth_call` results instead of throwing

### Nonce Management

Celo's forno RPC does not reliably support the `pending` block tag, so wagmi's cached nonce can become stale on rapid consecutive writes. The app uses a `useFreshNonce` hook that fetches the pending nonce explicitly before each write. MiniPay handles sequencing natively, so this hook is skipped on that path.

---

## App Structure

```
blokaz/
├── public/                         Static assets (logos, PDFs)
├── src/
│   ├── components/
│   │   ├── LobbyScreen.tsx         Home: stats, leaderboard preview, mode picker
│   │   ├── GameScreen.tsx          Classic gameplay UI
│   │   ├── TournamentHall.tsx      Tournament browser and join flow
│   │   ├── TournamentGameScreen.tsx  In-tournament gameplay
│   │   ├── Leaderboard.tsx         Modal overlay with epoch navigation
│   │   ├── AdminDashboard.tsx      Create tournaments, withdraw revenue
│   │   ├── Header.tsx              Nav bar with wallet connect and leaderboard trigger
│   │   ├── AppFooter.tsx           ToS, Privacy, Support links (MiniPay requirement)
│   │   └── SplashScreen.tsx        React splash (skipped if static HTML splash already ran)
│   ├── hooks/
│   │   ├── useBlokzGame.ts         Game contract reads + writes
│   │   ├── useLeaderboard.ts       Epoch-scoped leaderboard fetching
│   │   ├── useStablecoinRevive.ts  USDC allowance + approval helpers
│   │   └── useFreshNonce.ts        Explicit pending-nonce fetcher for write sequencing
│   ├── config/
│   │   ├── wagmi.ts                Wagmi config: MiniPay / Web3Auth / RainbowKit connectors
│   │   └── web3auth.ts             Web3Auth instance and connector factory
│   ├── providers/
│   │   └── Web3Provider.tsx        WagmiProvider + QueryClient + MiniPay auto-connect
│   ├── stores/
│   │   ├── gameStore.ts            Zustand: active game session, tournament ID, streak
│   │   └── themeStore.ts           Per-view theme mode (lobby / classic / tournaments)
│   ├── constants/
│   │   ├── abi.ts                  BLOKZ_GAME_ABI + BLOKZ_TOURNAMENT_ABI
│   │   └── contracts.ts            GoodDollar contract addresses and ABIs
│   ├── utils/
│   │   └── miniPay.ts              IS_MINIPAY constant + isMiniPay() live check
│   ├── contract.json               Game + tournament addresses, chain ID, explorer URL
│   └── App.tsx                     Route orchestration (lobby / classic / tournaments / admin)
├── contracts/                      Foundry scripts for contract deployment
├── index.html                      Shell with inline static splash, preloads, and theme init
└── vite.config.ts                  Vite config: chunk splitting, CSS deferral plugin, polyfills
```

### Routing

| View | Route | Notes |
|------|-------|-------|
| Lobby | `/` (default) | State-only; refresh always returns here |
| Classic Game | State-based | No URL change; refresh returns to lobby |
| Tournament Hall | `#/tournaments` | Deep-linkable hash route |
| Tournament Game | `#/tournaments/play` | Deep-linkable hash route |
| Leaderboard | Modal overlay | Accessible from any view |
| Admin Dashboard | `#/admin` | Deep-linkable hash route |

---

## Scripts

```bash
npm run dev          # Vite dev server (http://localhost:5173)
npm run dev:all      # Dev server + backend signer server in parallel
npm run setup        # First-time project setup
npm run build        # TypeScript check + Vite production build → dist/
npm run preview      # Serve the production build locally
npm run lint         # ESLint across all .ts / .tsx files
npm run test         # Vitest unit tests
```

---

## Deployment

### Build

```bash
npm run build
```

Output goes to `dist/`. Deploy to any static host (Vercel, Netlify, Cloudflare Pages, etc.).

### Hosting Requirements

- **Enable gzip or brotli compression.** The web3auth vendor chunk is ~1.5 MB raw but only ~450 KB gzip. Serving it uncompressed will cause resource timeouts on mobile networks and drop your PageSpeed score significantly.
- **SPA rewrite rule.** Route all requests to `index.html` (the app uses hash-based routing, so this primarily matters for the root path).
- **HTTPS is required.** MiniPay and Web3Auth both enforce a secure origin.

### MiniPay Listing Requirements

The app ships ready for MiniPay listing:
- `/blokaz-terms.pdf` and `/blokaz-privacy.pdf` linked in the footer (§7 Legal Links)
- Telegram support channel linked in the footer (§6 Dedicated Support)
- `AppFooter` is visible on all non-gameplay views

---

## License

© 2025 Cracked Studios. All rights reserved.
