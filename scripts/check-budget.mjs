// Fails the build if shipped assets exceed the 5 MB budget.
import { readdirSync, statSync, existsSync } from 'node:fs'
import { join, extname } from 'node:path'

const BUDGET = 5 * 1024 * 1024
const root = existsSync('dist') ? 'dist' : 'public'
const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f)
  return statSync(p).isDirectory() ? walk(p) : [{ p, size: statSync(p).size }]
})
const files = walk(root).sort((a, b) => b.size - a.size)
const total = files.reduce((s, f) => s + f.size, 0)
const kb = (n) => `${(n / 1024).toFixed(1)} KB`.padStart(10)
console.log(`\nAsset budget (${root}/)`)
for (const f of files.slice(0, 12)) console.log(kb(f.size), f.p, extname(f.p) === '.js' ? '' : '')
console.log(`${kb(total)}  total of ${kb(BUDGET).trim()} budget\n`)
if (total > BUDGET) { console.error('Over budget.'); process.exit(1) }
