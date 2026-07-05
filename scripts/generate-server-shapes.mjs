// Regenerates server/engine/shapesCatalog.js from src/engine/shapes.ts so the
// server-side score validator always deals from the exact same shape catalog
// (ids, cells, weights, catalog order) as the client engine.
//
// Run from the repo root:  node scripts/generate-server-shapes.mjs
import { build } from 'esbuild'
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = mkdtempSync(join(tmpdir(), 'blokaz-shapes-'))
const bundlePath = join(outDir, 'shapes.mjs')

await build({
  entryPoints: [join(root, 'src/engine/shapes.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: bundlePath,
})

const { SHAPES, TOTAL_WEIGHT } = await import(pathToFileURL(bundlePath).href)

const catalog = SHAPES.map(({ id, cells, cellCount, spawnWeight, colorId }) => ({
  id, cells, cellCount, spawnWeight, colorId,
}))

const header = `// GENERATED FILE — do not edit by hand.
// Source of truth: src/engine/shapes.ts
// Regenerate with: node scripts/generate-server-shapes.mjs
// Catalog order matters: the deterministic RNG walks it by cumulative spawnWeight.
`

const body =
  header +
  `export const SHAPES = ${JSON.stringify(catalog)}\n` +
  `export const TOTAL_WEIGHT = ${TOTAL_WEIGHT}\n` +
  `export const SHAPE_MAP = Object.fromEntries(SHAPES.map(s => [s.id, s]))\n`

writeFileSync(join(root, 'server/engine/shapesCatalog.js'), body)
rmSync(outDir, { recursive: true, force: true })
console.log(`Wrote server/engine/shapesCatalog.js (${catalog.length} shapes, TOTAL_WEIGHT=${TOTAL_WEIGHT})`)
