#!/usr/bin/env node
/**
 * Рисует иконки PWA и OG-картинку кодом, без внешних ассетов и лицензий.
 * Мотив — асық на фоне цветов флага (голубой + золото) с орнаментом.
 *
 *   node scripts/make-assets.mjs
 */
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'public')

const GOLD = '#f2c14e'
const SKY = '#2a7fc1'
const NIGHT = '#0d1017'

/** Один «рог» орнамента қошқар мүйіз. */
function horn(cx, cy, r, flip = 1) {
  return `M ${cx} ${cy} c ${flip * r * 0.9} ${-r * 0.1} ${flip * r * 1.1} ${-r * 0.75} ${flip * r * 0.2} ${-r * 0.95} c ${flip * -r * 0.55} ${-r * 0.12} ${flip * -r * 0.75} ${r * 0.35} ${flip * -r * 0.2} ${r * 0.5}`
}

function asyk(cx, cy, s, light = '#f6ead2', dark = '#c9ab74') {
  return `
    <ellipse cx="${cx}" cy="${cy}" rx="${s}" ry="${s * 0.78}" fill="${light}"/>
    <ellipse cx="${cx}" cy="${cy - s * 0.2}" rx="${s * 0.5}" ry="${s * 0.3}" fill="${dark}" opacity="0.55"/>
    <ellipse cx="${cx - s * 0.32}" cy="${cy + s * 0.22}" rx="${s * 0.2}" ry="${s * 0.14}" fill="${dark}" opacity="0.35"/>`
}

function icon(size) {
  const c = size / 2
  const r = size * 0.3
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="34%" r="78%">
      <stop offset="0%" stop-color="#1d3a58"/>
      <stop offset="100%" stop-color="${NIGHT}"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="url(#bg)"/>
  <circle cx="${c}" cy="${c}" r="${r * 1.32}" fill="none" stroke="${GOLD}" stroke-opacity="0.45"
          stroke-width="${size * 0.018}" stroke-dasharray="${size * 0.05} ${size * 0.035}"/>
  ${asyk(c, c + size * 0.02, r * 0.86)}
  <circle cx="${c + r * 0.72}" cy="${c - r * 0.66}" r="${size * 0.075}" fill="${SKY}"/>
</svg>`
}

function og() {
  const W = 1200
  const H = 630
  // Кон справа, текст слева: полосы не должны пересекаться, иначе в превью
  // Telegram подпись уезжает под асыки.
  const KX = 900
  const KY = 330
  const KR = 168
  // углы и радиусы подобраны так, чтобы асыки не перекрывали друг друга
  const ring = [
    { a: -1.15, r: 0.66 },
    { a: -0.42, r: 0.76 },
    { a: 0.32, r: 0.74 },
    { a: 1.15, r: 0.62 },
    { a: 2.35, r: 0.62 },
  ]
  const asyks = ring
    .map(({ a, r }) => asyk(KX + Math.cos(a) * KR * r, KY + Math.sin(a) * KR * r, 40))
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1d3a58"/>
      <stop offset="58%" stop-color="${NIGHT}"/>
    </linearGradient>
    <linearGradient id="sand" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#c4a678"/>
      <stop offset="100%" stop-color="#7d6746"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <ellipse cx="${W / 2}" cy="${H + 120}" rx="${W * 0.86}" ry="300" fill="url(#sand)"/>

  <g opacity="0.55" fill="none" stroke="${GOLD}" stroke-width="5" stroke-linecap="round">
    <path d="${horn(74, 84, 42, 1)}"/>
    <path d="${horn(1126, 84, 42, -1)}"/>
  </g>

  <g font-family="Noto Sans, DejaVu Sans, Arial, sans-serif">
    <text x="78" y="248" font-size="86" font-weight="800" fill="#f3efe6">Asyq League</text>
    <text x="80" y="312" font-size="38" font-weight="700" fill="${GOLD}">Прицелься. Бросай. Выбивай.</text>
    <text x="82" y="372" font-size="27" fill="#b9c2cf">Асық ату · қазақша · русский · English</text>
    <text x="82" y="418" font-size="24" fill="#8d97a6">Narxoz Incubator 2026</text>
  </g>

  <circle cx="${KX}" cy="${KY}" r="${KR}" fill="none" stroke="${GOLD}" stroke-opacity="0.75"
          stroke-width="6" stroke-dasharray="20 15"/>
  ${asyks}

  <path d="M 214 556 Q ${KX - 330} ${KY + 150} ${KX - KR - 46} ${KY + 52}"
        stroke="${GOLD}" stroke-opacity="0.8" stroke-width="7" fill="none"
        stroke-dasharray="16 13" stroke-linecap="round"/>
  <ellipse cx="${KX - KR - 22}" cy="${KY + 46}" rx="30" ry="24" fill="#c33a25"/>
  <ellipse cx="${KX - KR - 30}" cy="${KY + 38}" rx="10" ry="7" fill="#e8705c" opacity="0.7"/>
  <ellipse cx="220" cy="566" rx="26" ry="9" fill="${SKY}" opacity="0.5"/>
</svg>`
}

mkdirSync(join(out, 'icons'), { recursive: true })
for (const size of [192, 512]) {
  writeFileSync(join(out, 'icons', `icon-${size}.svg`), icon(size))
}
writeFileSync(join(out, 'icons', 'maskable.svg'), icon(512))
writeFileSync(join(out, 'og.svg'), og())
console.log('иконки и OG-картинка нарисованы')

// ── Растеризация ───────────────────────────────────────────────────────────
// Telegram и WhatsApp не показывают SVG в превью ссылки, а иконки PWA по
// спецификации тоже надёжнее отдавать растром. Рисуем headless-браузером:
// отдельная библиотека ради этого в зависимостях не нужна.
// Playwright в зависимости проекта не добавлен: он нужен один раз, а
// готовые PNG лежат в репозитории. Если его нет — просто пропускаем шаг.
let chromium
try {
  ;({ chromium } = await import('playwright'))
} catch {
  console.log('playwright не найден — PNG не перерисовываю (в репозитории уже есть)')
  process.exit(0)
}
const browser = await chromium.launch()

async function raster(svgPath, pngPath, width, height) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
  const svg = readFileSync(svgPath, 'utf8')
  await page.setContent(
    `<style>html,body{margin:0;padding:0;background:transparent}svg{display:block}</style>${svg}`,
  )
  await page.screenshot({ path: pngPath, omitBackground: true })
  await page.close()
}

for (const size of [192, 512]) {
  await raster(join(out, 'icons', `icon-${size}.svg`), join(out, 'icons', `icon-${size}.png`), size, size)
}
await raster(join(out, 'icons', 'maskable.svg'), join(out, 'icons', 'maskable.png'), 512, 512)
await raster(join(out, 'og.svg'), join(out, 'og.png'), 1200, 630)
await browser.close()
console.log('растровые версии готовы')
