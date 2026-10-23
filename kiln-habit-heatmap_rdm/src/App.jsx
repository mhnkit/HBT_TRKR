import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildGrid, streak, useHabitStore, weekSummary } from './lib/habits.js'
import { dayKey, daysBetween, formatLong, fromKey, useToday } from './lib/dates.js'
import { story, useScrollStory } from './lib/story.js'
import { DEFAULT_LOOK, resolvePalette } from './lib/looks.js'
import { detectWebGL, readJSON, useMediaQuery, writeJSON } from './lib/util.js'
import Hero from './ui/Hero.jsx'
import WeekPage from './ui/WeekPage.jsx'
import StudioPanel from './ui/StudioPanel.jsx'

// three.js + R3F + drei load in their own chunk, after the page is usable.
const HeatmapStage = lazy(() => import('./scene/HeatmapStage.jsx'))
const POSTER = '/fallback/heatmap-poster.svg'
const LOOK_KEY = 'kiln:look:v1'

export default function App() {
  const [state, actions] = useHabitStore()
  const today = useToday()
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const finePointer = useMediaQuery('(pointer: fine)')
  const tall = useMediaQuery('(max-aspect-ratio: 4/5)')
  const weeks = tall ? 16 : 26

  const [webgl] = useState(detectWebGL)
  const [stageFailed, setStageFailed] = useState(false)
  const [stageReady, setStageReady] = useState(false)
  const show3D = webgl && !stageFailed

  const [look, setLookState] = useState(() => ({ ...DEFAULT_LOOK, ...readJSON(LOOK_KEY, {}) }))
  const setLook = useCallback((patch) => setLookState((l) => ({ ...l, ...patch })), [])
  useEffect(() => writeJSON(LOOK_KEY, look), [look])
  const palette = resolvePalette(look)

  const [phase, setPhase] = useState('hero')
  const [studioOpen, setStudioOpen] = useState(false)
  const [inspect, setInspect] = useState(false)
  const [shape, setShape] = useState('flat')
  const apiRef = useRef(null)
  const weekRef = useRef(null)
  useScrollStory(weekRef, { reducedMotion, onPhase: setPhase })

  // Selected day for the hero pills (click a tile to pick another day).
  const todayKey = dayKey(today)
  const [selectedKey, setSelectedKey] = useState(todayKey)
  const prevToday = useRef(todayKey)
  useEffect(() => {
    if (selectedKey === prevToday.current) setSelectedKey(todayKey)
    prevToday.current = todayKey
  }, [todayKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const grid = useMemo(() => buildGrid(state, weeks, today), [state, weeks, today])
  const week = useMemo(() => weekSummary(state, today), [state, today])
  const streaks = useMemo(() => Object.fromEntries(state.habits.map((h) => [h.id, streak(state, today, h.id)])), [state, today])
  const stats = useMemo(() => ({ streak: streak(state, today), score: week.score, average: grid.average }), [state, today, week.score, grid.average])
  const selectedIndex = grid.cells.findIndex((c) => c.key === selectedKey)

  // Palette drives the 2D UI too, so the week board matches the glass.
  useEffect(() => {
    const root = document.documentElement.style
    root.setProperty('--heat-cold', palette.cold)
    root.setProperty('--heat-mid', palette.mid)
    root.setProperty('--heat-hot', palette.hot)
  }, [palette.cold, palette.mid, palette.hot])

  // Inspect mode: freeze page scroll, bring the map forward, enable zoom.
  useEffect(() => {
    story.override = inspect ? (shape === 'rolled' ? 0.62 : 0) : null
    if (!inspect) return undefined
    const html = document.documentElement
    const prev = html.style.overflow
    html.style.overflow = 'hidden'
    const onKey = (e) => { if (e.key === 'Escape') setInspect(false) }
    window.addEventListener('keydown', onKey)
    return () => { html.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [inspect, shape])

  // Tooltip: position via ref (no re-render per mouse move), content via state.
  const tipRef = useRef(null)
  const [hoverIndex, setHoverIndex] = useState(null)
  const onHover = useCallback((i, x, y) => {
    setHoverIndex(i)
    if (i != null && tipRef.current) {
      const flip = x > window.innerWidth - 240
      tipRef.current.style.transform = `translate3d(${flip ? x - 232 : x + 18}px, ${y + 18}px, 0)`
    }
  }, [])
  const hoverCell = hoverIndex != null ? grid.cells[hoverIndex] : null
  const byId = useMemo(() => Object.fromEntries(state.habits.map((h) => [h.id, h])), [state.habits])

  const onSelect = useCallback((key) => setSelectedKey(key), [])
  const onReady = useCallback(() => setStageReady(true), [])
  const scrollToWeek = () => weekRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' })
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' })

  const selectedDate = fromKey(selectedKey)
  const isToday = daysBetween(today, selectedDate) === 0

  return (
    <div className={`app phase-${phase}${inspect ? ' is-inspecting' : ''}`}>
      <div className="stage" aria-hidden="true">
        <img className={`poster${show3D && stageReady ? ' is-hidden' : ''}`} src={POSTER} alt="" decoding="async" />
        {show3D && (
          <Suspense fallback={null}>
            <HeatmapStage
              cells={grid.cells}
              weeks={weeks}
              look={look}
              phase={phase}
              inspect={inspect}
              inspectShape={shape}
              finePointer={finePointer}
              reducedMotion={reducedMotion}
              todayIndex={grid.todayIndex}
              selectedIndex={selectedIndex}
              onHover={onHover}
              onSelect={onSelect}
              onReady={onReady}
              onFail={() => setStageFailed(true)}
              apiRef={apiRef}
            />
          </Suspense>
        )}
      </div>

      <header className="topbar">
        <button type="button" className="brand" onClick={scrollToTop} aria-label="Kiln, back to the heatmap">Kiln</button>
        <nav className="topnav" aria-label="Sections">
          <button type="button" aria-current={phase !== 'week' ? 'true' : undefined} onClick={scrollToTop}>Heatmap</button>
          <button type="button" aria-current={phase === 'week' ? 'true' : undefined} onClick={scrollToWeek}>This week</button>
        </nav>
        <button type="button" className="btn" aria-expanded={studioOpen} onClick={() => setStudioOpen((o) => !o)}>Studio</button>
        <span className="progress" aria-hidden="true" />
      </header>

      <main className="story">
        <Hero
          habits={state.habits}
          selectedDate={selectedDate}
          isToday={isToday}
          doneIds={state.logs[selectedKey] ?? []}
          onToggle={(id) => actions.toggle(id, selectedKey)}
          onBackToToday={() => setSelectedKey(todayKey)}
          stats={stats}
          weeks={weeks}
          webgl={show3D}
          onSeeWeek={scrollToWeek}
        />
        <div className="runway" aria-hidden="true" />
        <WeekPage ref={weekRef} state={state} week={week} today={today} streaks={streaks} actions={actions} />
      </main>

      <StudioPanel
        open={studioOpen}
        onClose={() => setStudioOpen(false)}
        look={look}
        setLook={setLook}
        webgl={show3D}
        canZoom={inspect || phase === 'hero'}
        onZoom={(f) => apiRef.current?.zoomBy(f)}
        onReset={() => apiRef.current?.reset()}
        inspect={inspect}
        onInspect={() => setInspect((v) => !v)}
        shape={shape}
        setShape={setShape}
      />

      {inspect && (
        <div className="inspect-hud" role="status">
          <span>Drag to orbit. Scroll or pinch to zoom.</span>
          <button type="button" className="btn btn-solid" onClick={() => setInspect(false)}>Done</button>
        </div>
      )}

      <div ref={tipRef} className={`tip${hoverCell ? ' is-on' : ''}`} aria-hidden="true">
        {hoverCell && (
          <>
            <strong>{formatLong(hoverCell.date)}</strong>
            <span>{hoverCell.done.length} of {state.habits.length} habits</span>
            {hoverCell.done.length > 0 && <span className="tip-emoji">{hoverCell.done.map((id) => byId[id]?.emoji).join(' ')}</span>}
            <em>Click to edit this day</em>
          </>
        )}
      </div>
    </div>
  )
}
