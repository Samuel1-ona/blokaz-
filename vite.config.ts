import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Required for @web3auth/modal and its dependencies which use Node.js
    // globals (Buffer, process, global) in the browser bundle.
    // protocolImports: false prevents the plugin from stubbing node: imports
    // that MetaMask/injected wallets also touch, avoiding the
    // "Cannot redefine property: ethereum" conflict.
    nodePolyfills({
      globals: { Buffer: true, global: true, process: true },
      protocolImports: false,
    }),
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
      'all',
    ],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Web3Auth + toruslabs: large social-login SDK — split out so the main
          // entry stays small and these heavy modules load in parallel.
          if (id.includes('node_modules/@web3auth') || id.includes('node_modules/@toruslabs')) {
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
