// Rasterizes public/icons/icon.svg into PWA PNG icons (any + maskable).
// Usage: node scripts/make-icons.mjs  (requires the devDependency `sharp`)
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const svgPath = join(root, 'public', 'icons', 'icon.svg')
const outDir = join(root, 'public', 'icons')

const svg = readFileSync(svgPath)

async function renderAny(size) {
  await sharp(svg, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(join(outDir, `icon-${size}.png`))
    .then(() => console.log(`✓ icon-${size}.png`))
}

async function renderMaskable(size) {
  // maskable icons need the artwork inside the 80% safe zone →
  // render the full-bleed rounded rect background, then overlay a
  // scaled-down version of the logo art on a square background.
  const bg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1e1b4b"/><stop offset="1" stop-color="#0b0f1a"/></linearGradient></defs><rect width="512" height="512" fill="url(#bg)"/></svg>`
  )
  const art = await sharp(svg, { density: 384 })
    .resize(Math.round(size * 0.78), Math.round(size * 0.78))
    .png()
    .toBuffer()
  const pos = Math.floor((size - Math.round(size * 0.78)) / 2)
  await sharp(bg)
    .resize(size, size)
    .composite([{ input: art, left: pos, top: pos }])
    .png()
    .toFile(join(outDir, `icon-maskable-${size}.png`))
    .then(() => console.log(`✓ icon-maskable-${size}.png`))
}

await Promise.all([renderAny(192), renderAny(512), renderMaskable(192), renderMaskable(512)])
console.log('PWA icons generated.')
