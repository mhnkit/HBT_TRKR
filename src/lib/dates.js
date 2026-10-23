import { useEffect, useState } from 'react'

const DAY_MS = 86_400_000
export const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
/** Monday = 0 … Sunday = 6 */
export const weekdayIndex = (d) => (d.getDay() + 6) % 7
export const startOfWeek = (d) => addDays(startOfDay(d), -weekdayIndex(d))
export const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / DAY_MS)
export const dayKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const fromKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d) }

const fShort = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
const fLong = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
const fDay = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })
const fWeekday = new Intl.DateTimeFormat(undefined, { weekday: 'narrow' })
const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

export const formatShort = (d) => fShort.format(d)
export const formatLong = (d) => fLong.format(d)
export const formatDay = (d) => fDay.format(d)
export const formatWeekdayLetter = (d) => fWeekday.format(d)
export const formatRange = (a, b) => `${fDay.format(a)} – ${fDay.format(b)}`

export function dayLabel(date, today) {
  const diff = daysBetween(today, date)
  if (diff === 0) return 'today'
  if (diff === -1) return 'yesterday'
  return fShort.format(date)
}

export function timeAgo(ts, now = Date.now()) {
  const s = Math.round((ts - now) / 1000)
  if (Math.abs(s) < 45) return 'just now'
  if (Math.abs(s) < 3600) return rtf.format(Math.round(s / 60), 'minute')
  if (Math.abs(s) < 86400) return rtf.format(Math.round(s / 3600), 'hour')
  return rtf.format(Math.round(s / 86400), 'day')
}

/** Local midnight-aware "today" that rolls over while the tab stays open. */
export function useToday() {
  const [today, setToday] = useState(() => startOfDay(new Date()))
  useEffect(() => {
    const wait = addDays(today, 1) - Date.now() + 500
    const id = setTimeout(() => setToday(startOfDay(new Date())), Math.max(1000, wait))
    return () => clearTimeout(id)
  }, [today])
  return today
}
