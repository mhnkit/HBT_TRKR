import { useEffect, useMemo, useReducer } from 'react'
import { addDays, dayKey, startOfDay, startOfWeek, weekdayIndex } from './dates.js'
import { clamp, readJSON, writeJSON } from './util.js'

const STORAGE_KEY = 'kiln:habits:v1'
export const HISTORY_WEEKS = 26
export const EMOJI_CHOICES = ['🌿', '🧘', '📖', '🏃', '💧', '✍️', '🥗', '😴', '🎸', '💪', '📵', '🧠']

const DEMO = [
  { id: 'meditate', name: 'Meditate', emoji: '🧘', goal: 5, affinity: 0.95 },
  { id: 'read', name: 'Read 20 pages', emoji: '📖', goal: 4, affinity: 0.8 },
  { id: 'run', name: 'Run', emoji: '🏃', goal: 3, affinity: 0.6 },
  { id: 'water', name: 'Drink 2 L of water', emoji: '💧', goal: 7, affinity: 1.05 },
  { id: 'journal', name: 'Journal', emoji: '✍️', goal: 5, affinity: 0.75 },
]

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Six months of believable history: improving trend, a few slumps, quieter weekends. */
export function createDemoState(now = new Date()) {
  const rand = mulberry32(20261022)
  const today = startOfDay(now)
  const start = addDays(startOfWeek(today), -7 * (HISTORY_WEEKS - 1))
  const total = Math.round((today - start) / 86_400_000)
  const logs = {}
  for (let i = 0; i < total; i++) {
    const date = addDays(start, i)
    const wd = weekdayIndex(date)
    const slump = Math.floor(i / 7) % 8 === 5 ? 0.35 : 0
    const mood = 0.3 + 0.45 * (i / total) + 0.12 * Math.sin(i / 9) - slump
    const done = []
    for (const h of DEMO) {
      let p = mood * h.affinity
      if (h.id === 'run') p *= wd === 1 || wd === 3 || wd === 5 ? 1.5 : 0.45
      else if (wd >= 5) p *= 0.82
      if (rand() < p) done.push(h.id)
    }
    if (done.length) logs[dayKey(date)] = done
  }
  logs[dayKey(today)] = ['water']
  const habits = DEMO.map(({ affinity, ...h }) => ({ ...h, createdAt: start.getTime() }))
  return { version: 1, habits, logs, events: [], focus: {} }
}

function reducer(state, a) {
  switch (a.type) {
    case 'toggle': {
      const list = state.logs[a.key] ?? []
      const done = !list.includes(a.habitId)
      const next = done ? [...list, a.habitId] : list.filter((id) => id !== a.habitId)
      const logs = { ...state.logs }
      if (next.length) logs[a.key] = next
      else delete logs[a.key]
      const event = { id: a.id, habitId: a.habitId, key: a.key, done, at: a.at }
      return { ...state, logs, events: [event, ...state.events].slice(0, 40) }
    }
    case 'setGoal':
      return { ...state, habits: state.habits.map((h) => (h.id === a.habitId ? { ...h, goal: clamp(a.goal, 1, 7) } : h)) }
    case 'add':
      return { ...state, habits: [...state.habits, { id: a.id, name: a.name, emoji: a.emoji, goal: clamp(a.goal, 1, 7), createdAt: a.at }] }
    case 'remove': {
      const logs = {}
      for (const [k, ids] of Object.entries(state.logs)) {
        const next = ids.filter((id) => id !== a.habitId)
        if (next.length) logs[k] = next
      }
      return {
        ...state,
        logs,
        habits: state.habits.filter((h) => h.id !== a.habitId),
        events: state.events.filter((e) => e.habitId !== a.habitId),
      }
    }
    case 'focus':
      return { ...state, focus: { ...state.focus, [a.weekKey]: a.text } }
    case 'demo':
      return createDemoState()
    case 'clear':
      return { ...state, logs: {}, events: [], focus: {} }
    default:
      return state
  }
}

function load() {
  const saved = readJSON(STORAGE_KEY, null)
  if (saved?.version === 1 && Array.isArray(saved.habits) && saved.logs) return { events: [], focus: {}, ...saved }
  return createDemoState()
}

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

export function useHabitStore() {
  const [state, dispatch] = useReducer(reducer, undefined, load)
  useEffect(() => {
    const id = setTimeout(() => writeJSON(STORAGE_KEY, state), 250)
    return () => clearTimeout(id)
  }, [state])
  const actions = useMemo(() => ({
    toggle: (habitId, key) => dispatch({ type: 'toggle', habitId, key, id: uid(), at: Date.now() }),
    setGoal: (habitId, goal) => dispatch({ type: 'setGoal', habitId, goal }),
    add: ({ name, emoji, goal }) => dispatch({ type: 'add', name, emoji, goal, id: `h-${uid()}`, at: Date.now() }),
    remove: (habitId) => dispatch({ type: 'remove', habitId }),
    setFocus: (weekKey, text) => dispatch({ type: 'focus', weekKey, text }),
    loadDemo: () => dispatch({ type: 'demo' }),
    clear: () => dispatch({ type: 'clear' }),
  }), [])
  return [state, actions]
}

const doneOn = (state, key) => state.logs[key] ?? []

/** Cells for the 3D heatmap: columns are weeks (oldest → current), rows are Mon → Sun. */
export function buildGrid(state, weeks, today) {
  const start = addDays(startOfWeek(today), -7 * (weeks - 1))
  const ids = new Set(state.habits.map((h) => h.id))
  const total = Math.max(1, ids.size)
  const todayKey = dayKey(today)
  const cells = []
  let todayIndex = -1
  let sum = 0
  let counted = 0
  for (let i = 0; i < weeks * 7; i++) {
    const date = addDays(start, i)
    const key = dayKey(date)
    const future = date > today
    const done = future ? [] : doneOn(state, key).filter((id) => ids.has(id))
    const heat = future ? -1 : Math.min(1, done.length / total)
    if (key === todayKey) todayIndex = i
    if (!future) { sum += heat; counted++ }
    cells.push({ i, key, date, done, heat, future })
  }
  return { cells, todayIndex, average: counted ? sum / counted : 0 }
}

export function weekSummary(state, today) {
  const start = startOfWeek(today)
  const days = Array.from({ length: 7 }, (_, d) => addDays(start, d))
  const keys = days.map(dayKey)
  const rows = state.habits.map((habit) => {
    const marks = keys.map((k) => doneOn(state, k).includes(habit.id))
    return { habit, marks, count: marks.filter(Boolean).length }
  })
  const goalTotal = rows.reduce((s, r) => s + r.habit.goal, 0)
  const hit = rows.reduce((s, r) => s + Math.min(r.count, r.habit.goal), 0)
  return { start, end: days[6], days, keys, rows, score: goalTotal ? hit / goalTotal : 0, weekKey: keys[0] }
}

/** Consecutive days ending today (or yesterday, if today isn't marked yet). */
export function streak(state, today, habitId = null) {
  const hit = (d) => {
    const list = doneOn(state, dayKey(d))
    return habitId ? list.includes(habitId) : list.length > 0
  }
  let d = startOfDay(today)
  if (!hit(d)) d = addDays(d, -1)
  let n = 0
  while (hit(d) && n < 400) { n++; d = addDays(d, -1) }
  return n
}
