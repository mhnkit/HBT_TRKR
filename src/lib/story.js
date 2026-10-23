import { useEffect, useRef } from 'react'
import { clamp, damp, easeInOutCubic, easeOutCubic, smoothstep } from './util.js'

/**
 * One progress value runs the whole page:
 *   t = 0    hero: flat glass heatmap, rotates as you scroll
 *   t ≈ 0.3  only the heatmap is left on screen; it rolls up around its rolling centre
 *   t ≈ 0.66 the rolled heatmap sinks into the background while the next page rotates in
 *   t = 1    the habits page sits on top of the slowly turning heat-roll
 * It is a plain mutable object so the 3D frame loop can read it without React re-renders.
 */
export const story = {
  t: 0, // smoothed scroll progress
  target: 0, // raw scroll progress
  override: null, // set while inspecting: forces a pose regardless of scroll
  scene: 0, // value the 3D scene renders (eased toward override ?? t)
}

export const phaseOf = (t) => (t < 0.3 ? 'hero' : t < 0.72 ? 'roll' : 'week')

/** Per-segment eased progress for the 3D choreography. */
export function segments(t) {
  return {
    hero: smoothstep(0, 0.3, t),
    curl: easeInOutCubic(clamp((t - 0.3) / 0.36)),
    back: easeInOutCubic(clamp((t - 0.64) / 0.36)),
  }
}

/**
 * Tracks scroll from the top of the page to the top of `endRef` (the habits page),
 * eases it, and writes CSS custom properties used by the hero and the incoming page.
 */
export function useScrollStory(endRef, { reducedMotion, onPhase }) {
  const onPhaseRef = useRef(onPhase)
  onPhaseRef.current = onPhase

  useEffect(() => {
    const root = document.documentElement
    let end = 1
    let raf = 0
    let last = 0
    let phase = null

    const measure = () => {
      const el = endRef.current
      end = el ? Math.max(1, el.getBoundingClientRect().top + window.scrollY) : window.innerHeight * 2.7
    }
    const write = () => {
      const t = story.t
      root.style.setProperty('--story', clamp(t).toFixed(4))
      root.style.setProperty('--hero-out', smoothstep(0.02, 0.26, t).toFixed(4))
      root.style.setProperty('--page-in', easeOutCubic(clamp((t - 0.6) / 0.4)).toFixed(4))
      const p = phaseOf(t)
      if (p !== phase) { phase = p; onPhaseRef.current?.(p) }
    }
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016)
      last = now
      story.t = reducedMotion ? story.target : damp(story.t, story.target, 9, dt)
      if (Math.abs(story.t - story.target) < 0.0004) story.t = story.target
      write()
      raf = story.t !== story.target ? requestAnimationFrame(tick) : 0
    }
    const kick = () => {
      story.target = Math.max(0, window.scrollY / end)
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick) }
    }
    const onResize = () => { measure(); kick() }

    measure()
    story.target = story.t = Math.max(0, window.scrollY / end)
    write()
    window.addEventListener('scroll', kick, { passive: true })
    window.addEventListener('resize', onResize)
    const ro = new ResizeObserver(onResize)
    ro.observe(document.body)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', kick)
      window.removeEventListener('resize', onResize)
      ro.disconnect()
    }
  }, [endRef, reducedMotion])
}
