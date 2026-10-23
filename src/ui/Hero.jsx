import { formatShort } from '../lib/dates.js'

export default function Hero({
  habits, selectedDate, isToday, doneIds, onToggle, onBackToToday, stats, weeks, webgl, onSeeWeek,
}) {
  const pct = (v) => `${Math.round(v * 100)}%`
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-top">
        <h1 id="hero-title" className="hero-title">Every habit you keep warms the glass.</h1>
        <p className="hero-lede">
          Each tile is one day of your last {weeks} weeks. The more habits you keep, the taller and warmer it glows.
          {webgl ? ' Drag it to look around, or click a day to edit it.' : ''}
        </p>
      </div>

      <div className="hero-bottom">
        <div className="mark">
          <div className="mark-head">
            <h2 className="mark-title">
              {isToday ? 'Today' : 'Editing'}, {formatShort(selectedDate)}
            </h2>
            {!isToday && (
              <button type="button" className="text-btn" onClick={onBackToToday}>Back to today</button>
            )}
          </div>
          {habits.length ? (
            <div className="pills" role="group" aria-label="Habits for this day">
              {habits.map((h) => {
                const done = doneIds.includes(h.id)
                return (
                  <button key={h.id} type="button" className="pill" aria-pressed={done} onClick={() => onToggle(h.id)}>
                    <span className="pill-emoji" aria-hidden="true">{h.emoji}</span>
                    {h.name}
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="hint">Add your first habit on the week page to start lighting tiles.</p>
          )}
        </div>

        <p className="hero-stats">
          <span><strong>{stats.streak}</strong>-day streak.</span>{' '}
          <span><strong>{pct(stats.score)}</strong> of this week’s goals.</span>{' '}
          <span><strong>{pct(stats.average)}</strong> average over {weeks} weeks.</span>
        </p>
      </div>

      <button type="button" className="scroll-cue" onClick={onSeeWeek}>
        Scroll to roll it away
        <span className="scroll-cue-line" aria-hidden="true" />
      </button>
    </section>
  )
}
