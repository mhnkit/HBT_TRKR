import { useEffect, useRef } from 'react'
import { MATERIALS, PALETTES, PIVOTS } from '../lib/looks.js'

function Segmented({ label, options, value, onChange }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.key} type="button" role="radio" aria-checked={value === o.key} onClick={() => onChange(o.key)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export default function StudioPanel({
  open, onClose, look, setLook, webgl, canZoom, onZoom, onReset, inspect, onInspect, shape, setShape,
}) {
  const panel = useRef()
  useEffect(() => {
    if (!open) return undefined
    panel.current?.querySelector('button')?.focus({ preventScroll: true })
    const onKey = (e) => { if (e.key === 'Escape' && !inspect) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, inspect, onClose])

  return (
    <aside ref={panel} className={`studio${open ? ' is-open' : ''}`} aria-label="Studio" aria-hidden={!open}>
      <div className="studio-head">
        <h2>Studio</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close studio">×</button>
      </div>

      {!webgl && <p className="hint">3D isn’t available on this device, so these settings only change the colors on the week page.</p>}

      <fieldset className="studio-group">
        <legend>Material</legend>
        <div className="mat-grid">
          {MATERIALS.map((m) => (
            <button key={m.key} type="button" className="mat" aria-pressed={look.material === m.key} onClick={() => setLook({ material: m.key })} disabled={!webgl}>
              <span className={`mat-swatch sw-${m.key}`} aria-hidden="true" />
              {m.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="studio-group">
        <legend>Heat color</legend>
        <div className="pal-grid">
          {PALETTES.map((p) => (
            <button
              key={p.key}
              type="button"
              className="pal"
              aria-pressed={look.palette === p.key}
              style={{ '--a': p.cold, '--b': p.mid, '--c': p.hot }}
              onClick={() => setLook({ palette: p.key })}
            >
              <span className="pal-bar" aria-hidden="true" />
              {p.label}
            </button>
          ))}
          <label className="pal pal-custom" data-on={look.palette === 'custom'}>
            <input type="color" value={look.custom} onChange={(e) => setLook({ palette: 'custom', custom: e.target.value })} />
            Custom
          </label>
        </div>
      </fieldset>

      {webgl && (
        <fieldset className="studio-group">
          <legend>View</legend>
          <div className="view-row">
            <div className="zoom" role="group" aria-label="Zoom">
              <button type="button" onClick={() => onZoom(0.85)} disabled={!canZoom} aria-label="Zoom in">+</button>
              <button type="button" onClick={() => onZoom(1.18)} disabled={!canZoom} aria-label="Zoom out">−</button>
            </div>
            <button type="button" className="btn" onClick={onReset}>Reset view</button>
            <label className="switch">
              <input type="checkbox" checked={look.autoRotate} onChange={(e) => setLook({ autoRotate: e.target.checked })} />
              <span>Idle motion</span>
            </label>
          </div>
          {!canZoom && <p className="hint">Zoom works on the heatmap view. Scroll to the top or inspect it.</p>}
          <p className="studio-label" id="pivot-label">Rolling centre</p>
          <Segmented label="Rolling centre" options={PIVOTS} value={look.pivot} onChange={(pivot) => setLook({ pivot })} />
        </fieldset>
      )}

      {webgl && (
        <div className="studio-group">
          {inspect && (
            <>
              <p className="studio-label">Shape</p>
              <Segmented label="Shape" options={[{ key: 'flat', label: 'Flat' }, { key: 'rolled', label: 'Rolled' }]} value={shape} onChange={setShape} />
            </>
          )}
          <button type="button" className="btn btn-solid btn-wide" onClick={onInspect}>
            {inspect ? 'Done inspecting' : 'Inspect in 3D'}
          </button>
        </div>
      )}
    </aside>
  )
}
