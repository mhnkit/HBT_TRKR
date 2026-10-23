import { forwardRef, useState } from 'react'
import { daysBetween, dayLabel, formatLong, formatRange, formatWeekdayLetter, fromKey, timeAgo } from '../lib/dates.js'
import { EMOJI_CHOICES } from '../lib/habits.js'

function ScoreRing({ value }) {
  const r = 30
  const c = 2 * Math.PI * r
  return (
    <svg className="score-ring" viewBox="0 0 72 72" aria-hidden="true">
      <circle cx="36" cy="36" r={r} className="score-track" />
      <circle cx="36" cy="36" r={r} className="score-fill" strokeDasharray={c} strokeDashoffset={c * (1 - value)} />
    </svg>
  )
}

function HabitRow({ row, days, keys, today, streak, onToggle, onGoal, onRemove }) {
  const { habit, marks, count } = row
  const [confirm, setConfirm] = useState(false)
  const met = count >= habit.goal
  return (
    <div className="row" role="row">
      <div className="row-name" role="rowheader">
        <span className="row-emoji" aria-hidden="true">{habit.emoji}</span>
        <span>
          <span className="row-title">{habit.name}</span>
          <span className="row-meta">{streak > 0 ? `${streak}-day streak` : 'No streak yet'}</span>
        </span>
      </div>
      {days.map((date, d) => {
        const future = daysBetween(today, date) > 0
        return (
          <div key={keys[d]} className="row-cell" role="gridcell">
            <button
              type="button"
              className="day"
              aria-pressed={marks[d]}
              disabled={future}
              aria-label={`${habit.name}, ${formatLong(date)}${marks[d] ? ', done' : ''}`}
              onClick={() => onToggle(habit.id, keys[d])}
            />
          </div>
        )
      })}
      <div className="row-goal" role="gridcell">
        <span className={`goal-count${met ? ' is-met' : ''}`}>
          {count}<span className="goal-of"> of {habit.goal}</span>
        </span>
        <span className="stepper">
          <button type="button" aria-label={`Lower weekly goal for ${habit.name}`} disabled={habit.goal <= 1} onClick={() => onGoal(habit.id, habit.goal - 1)}>−</button>
          <button type="button" aria-label={`Raise weekly goal for ${habit.name}`} disabled={habit.goal >= 7} onClick={() => onGoal(habit.id, habit.goal + 1)}>+</button>
        </span>
        <button
          type="button"
          className={`remove${confirm ? ' is-armed' : ''}`}
          onClick={() => (confirm ? onRemove(habit.id) : setConfirm(true))}
          onBlur={() => setConfirm(false)}
          aria-label={confirm ? `Confirm: delete ${habit.name} and its history` : `Delete ${habit.name}`}
        >
          {confirm ? 'Delete' : '×'}
        </button>
      </div>
    </div>
  )
}

function AddHabit({ onAdd }) {
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState(EMOJI_CHOICES[0])
  const [goal, setGoal] = useState(4)
  const submit = (e) => {
    e.preventDefault()
    const clean = name.trim()
    if (!clean) return
    onAdd({ name: clean, emoji, goal })
    setName('')
  }
  return (
    <form className="add" onSubmit={submit}>
      <label className="add-emoji">
        <span className="sr-only">Icon</span>
        <select value={emoji} onChange={(e) => setEmoji(e.target.value)}>
          {EMOJI_CHOICES.map((em) => <option key={em} value={em}>{em}</option>)}
        </select>
      </label>
      <label className="add-name">
        <span className="sr-only">Habit name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New habit, e.g. Stretch for 10 minutes" maxLength={48} />
      </label>
      <label className="add-goal">
        <span>Goal</span>
        <select value={goal} onChange={(e) => setGoal(Number(e.target.value))}>
          {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n}× a week</option>)}
        </select>
      </label>
      <button type="submit" className="btn btn-solid" disabled={!name.trim()}>Add habit</button>
    </form>
  )
}

const WeekPage = forwardRef(function WeekPage({ state, week, today, streaks, actions }, ref) {
  const byId = Object.fromEntries(state.habits.map((h) => [h.id, h]))
  const events = state.events.filter((e) => byId[e.habitId]).slice(0, 7)
  const [clearArmed, setClearArmed] = useState(false)

  return (
    <section ref={ref} id="week" className="week" aria-labelledby="week-title">
      <div className="week-inner">
        <header className="week-head">
          <div>
            <h2 id="week-title" className="week-title">This week</h2>
            <p className="week-range">{formatRange(week.start, week.end)}</p>
          </div>
          <div className="week-score">
            <ScoreRing value={week.score} />
            <p><strong>{Math.round(week.score * 100)}%</strong> of weekly goals met</p>
          </div>
          <label className="focus">
            <span>Focus for this week</span>
            <input
              value={state.focus[week.weekKey] ?? ''}
              onChange={(e) => actions.setFocus(week.weekKey, e.target.value)}
              placeholder="One intention, e.g. no phone before 9"
              maxLength={80}
            />
          </label>
        </header>

        <div className="board" role="grid" aria-label="Habits this week">
          <div className="row row-labels" role="row">
            <div role="columnheader" className="row-name">Habit</div>
            {week.days.map((d, i) => (
              <div key={week.keys[i]} role="columnheader" className={`col-day${daysBetween(today, d) === 0 ? ' is-today' : ''}`}>
                <span>{formatWeekdayLetter(d)}</span>
                <span className="col-date">{d.getDate()}</span>
              </div>
            ))}
            <div role="columnheader" className="row-goal">This week</div>
          </div>
          {week.rows.map((row) => (
            <HabitRow
              key={row.habit.id}
              row={row}
              days={week.days}
              keys={week.keys}
              today={today}
              streak={streaks[row.habit.id] ?? 0}
              onToggle={actions.toggle}
              onGoal={actions.setGoal}
              onRemove={actions.remove}
            />
          ))}
          {!week.rows.length && <p className="empty">No habits yet. Add one below and its first tile lights up today.</p>}
          <AddHabit onAdd={actions.add} />
        </div>

        <aside className="recent" aria-labelledby="recent-title">
          <h3 id="recent-title">Recent</h3>
          {events.length ? (
            <ol>
              {events.map((e) => (
                <li key={e.id}>
                  <span>
                    {byId[e.habitId].emoji} {byId[e.habitId].name} {e.done ? 'marked done' : 'unmarked'} for {dayLabel(fromKey(e.key), today)}
                  </span>
                  <time dateTime={new Date(e.at).toISOString()}>{timeAgo(e.at)}</time>
                </li>
              ))}
            </ol>
          ) : (
            <p className="hint">Marks you make show up here.</p>
          )}
          <div className="data-actions">
            <button type="button" className="text-btn" onClick={actions.loadDemo}>Load demo history</button>
            <button
              type="button"
              className="text-btn"
              onClick={() => (clearArmed ? (actions.clear(), setClearArmed(false)) : setClearArmed(true))}
              onBlur={() => setClearArmed(false)}
            >
              {clearArmed ? 'Confirm: clear all history' : 'Clear history'}
            </button>
          </div>
        </aside>
        <p className="week-foot">Your habits are saved in this browser.</p>
      </div>
    </section>
  )
})

export default WeekPage
