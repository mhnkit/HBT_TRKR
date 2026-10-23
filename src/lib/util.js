import { useEffect, useState } from 'react'

export const TAU = Math.PI * 2
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
export const lerp = (a, b, t) => a + (b - a) * t
export const smoothstep = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t) }
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)
/** Frame-rate independent exponential smoothing. */
export const damp = (cur, target, lambda, dt) => lerp(cur, target, 1 - Math.exp(-lambda * dt))
export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a))

const toRgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
const toHex = (rgb) => `#${rgb.map((c) => Math.round(clamp(c, 0, 255)).toString(16).padStart(2, '0')).join('')}`
export const mixHex = (a, b, t) => { const x = toRgb(a), y = toRgb(b); return toHex(x.map((c, i) => lerp(c, y[i], t))) }

/** WebGL probe. Add ?nowebgl to the URL to preview the static fallback. */
export function detectWebGL() {
  if (typeof window === 'undefined') return false
  if (new URLSearchParams(window.location.search).has('nowebgl')) return false
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return Boolean(gl)
  } catch {
    return false
  }
}

export function useMediaQuery(query) {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setMatch(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return match
}

export function readJSON(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback } catch { return fallback }
}

export function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* storage full or blocked */ }
}
