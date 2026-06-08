import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { writeFileSync } from 'fs'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// Vite plugin: make the generated CSS bundle non-blocking.
// Safe here because the inline static splash covers all app content until
// React mounts, so deferring the Tailwind bundle causes zero FOUC.
const deferCssPlugin = {
  name: 'defer-css',
  transformIndexHtml(html: string) {
    // Replace blocking <link rel="stylesheet" … href="/assets/…css">
    // with a preload + onload swap (standard non-blocking CSS pattern).
    return html.replace(
      /<link rel="stylesheet" crossorigin href="(\/assets\/[^"]+\.css)">/g,
      (_: string, href: string) =>
        `<link rel="preload" as="style" onload="this.onload=null;this.rel='stylesheet'" href="${href}" crossorigin>` +
        `<noscript><link rel="stylesheet" href="${href}" crossorigin></noscript>`
    )
  },
}

// Writes public/version.json with the build timestamp on every production
// build. The app polls this file every 2 minutes and reloads when it detects
// a new version — auto-updating players in the lobby, notifying mid-game.
const versionPlugin = {
  name: 'version',
  buildStart() {
    writeFileSync('public/version.json', JSON.stringify({ v: Date.now() }))
  },
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    versionPlugin,
    // Required for @web3auth/modal and its dependencies which use Node.js
    // globals (Buffer, process, global) in the browser bundle.
    // protocolImports: false prevents the plugin from stubbing node: imports
    // that MetaMask/injected wallets also touch, avoiding the
    // "Cannot redefine property: ethereum" conflict.
    nodePolyfills({
      globals: { Buffer: true, global: true, process: true },
      protocolImports: false,
    }),
    deferCssPlugin,
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    allowedHosts: [
      'aptly-letter-rocklike.ngrok-free.dev',
      'd6c4-102-91-103-49.ngrok-free.app',
      '8d70-102-91-96-170.ngrok-free.app',
      'all',
    ],
  },
  build: {
    // Remove vendor-web3auth from the HTML modulepreload list.
    // The main entry only loads it via a conditional dynamic import
    // (Web3Provider, non-MiniPay path). Preloading it for every visitor
    // would waste 450+ KiB for MiniPay users who never execute it.
    modulePreload: {
      resolveDependencies: (_filename, deps) =>
        deps.filter((d) => !d.includes('vendor-web3auth')),
    },
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Web3Auth + toruslabs: large social-login SDK — split out so the main
          // entry stays small and these heavy modules load in parallel.
          if (
            id.includes('node_modules/@web3auth') ||
            id.includes('node_modules/@toruslabs')
          ) {
            return 'vendor-web3auth'
          }
          // wagmi + viem: separate from main so the JS execution graph parallelises
          // downloading web3auth and wagmi simultaneously.
          if (
            id.includes('node_modules/wagmi') ||
            id.includes('node_modules/viem') ||
            id.includes('node_modules/@wagmi')
          ) {
            return 'vendor-wagmi'
          }
        },
      },
    },
  },
  // @ts-ignore - vitest types
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['contracts/**', 'node_modules/**'],
  },
})
