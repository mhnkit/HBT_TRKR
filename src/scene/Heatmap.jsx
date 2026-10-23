import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { story, segments } from '../lib/story.js'
import { TAU, damp, lerp, smoothstep, wrapAngle } from '../lib/util.js'
import { findMaterial, pivotColumn, resolvePalette } from '../lib/looks.js'
import { createHeatMaterial, createHeatUniforms, stepLook, useLazyTexture } from './heatMaterial.js'

export const TILE_URL = '/models/habit-tile.glb'
useGLTF.preload(TILE_URL)

export const SPACING = 1.12
const MIN_BAR = 0.14
const MAX_BAR = 2.3

/** Takes the first mesh of any GLB and normalises it into a 0.92 × 1 × 0.92 tile sitting on y = 0. */
function extractTile(root) {
  let mesh = null
  root.updateMatrixWorld(true)
  root.traverse((o) => { if (!mesh && o.isMesh) mesh = o })
  if (!mesh) throw new Error(`${TILE_URL} has no mesh`)
  const g = mesh.geometry.clone()
  g.applyMatrix4(mesh.matrixWorld)
  g.computeBoundingBox()
  const box = g.boundingBox
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  g.translate(-center.x, -box.min.y, -center.z)
  g.scale(0.92 / (size.x || 1), 1 / (size.y || 1), 0.92 / (size.z || 1))
  if (!g.attributes.normal) g.computeVertexNormals()
  return g
}

function useTileGeometry(count) {
  const { scene } = useGLTF(TILE_URL)
  const geometry = useMemo(() => {
    const g = extractTile(scene)
    const heat = new THREE.InstancedBufferAttribute(new Float32Array(count), 1)
    heat.setUsage(THREE.DynamicDrawUsage)
    const index = new THREE.InstancedBufferAttribute(Float32Array.from({ length: count }, (_, i) => i), 1)
    g.setAttribute('aHeat', heat)
    g.setAttribute('aIndex', index)
    return g
  }, [scene, count])
  useEffect(() => () => geometry.dispose(), [geometry])
  return geometry
}

export default function Heatmap({
  cells, weeks, look, layout, interactive, todayIndex, selectedIndex,
  onHover, onSelect, onReady, reducedMotion,
}) {
  const count = weeks * 7
  const geometry = useTileGeometry(count)
  const uniforms = useMemo(createHeatUniforms, [])
  const material = useMemo(() => createHeatMaterial(uniforms), [uniforms])
  useEffect(() => () => material.dispose(), [material])

  const preset = findMaterial(look.material)
  const palette = resolvePalette(look)
  const target = useMemo(
    () => ({ cold: new THREE.Color(palette.cold), mid: new THREE.Color(palette.mid), hot: new THREE.Color(palette.hot) }),
    [palette.cold, palette.mid, palette.hot],
  )

  // Lazy texture: only fetched when a preset that needs it is chosen.
  const normalMap = useLazyTexture(preset.normalMap ?? null)
  useEffect(() => {
    const want = preset.normalMap ? normalMap : null
    if (material.normalMap === want) return
    material.normalMap = want
    if (want) material.normalScale.setScalar(preset.normalScale ?? 0.4)
    material.needsUpdate = true
  }, [material, normalMap, preset])

  const pose = useRef()
  const spin = useRef()
  const mesh = useRef()
  const ring = useRef()
  const ringMat = useRef()
  const live = useRef({})
  live.current = { cells, look, layout, todayIndex, reducedMotion, onReady }

  const rt = useMemo(() => ({
    first: true,
    ready: false,
    intro: 0,
    introDone: reducedMotion,
    spin: 0,
    pivot: pivotColumn(look.pivot, weeks),
    hover: -1,
    heights: new Float32Array(count),
    colX: new Float32Array(weeks),
    colY: new Float32Array(weeks),
    colT: new Float32Array(weeks),
    dummy: new THREE.Object3D(),
  }), [count, weeks]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    uniforms.uToday.value = todayIndex
    uniforms.uSelected.value = selectedIndex === todayIndex ? -1 : selectedIndex
  }, [uniforms, todayIndex, selectedIndex])

  useEffect(() => {
    if (interactive) return
    rt.hover = -1
    uniforms.uHover.value = -1
    document.body.style.cursor = ''
    onHover?.(null)
  }, [interactive, rt, uniforms, onHover])

  useFrame((state, delta) => {
    const m = mesh.current
    if (!m || !pose.current || !spin.current) return
    const dt = Math.min(delta, 0.05)
    const { cells: data, look: lk, layout: L, todayIndex: today, reducedMotion: still } = live.current
    const seg = segments(story.scene)
    const P = L.poses
    const time = state.clock.elapsedTime
    const motion = !still
    const k1 = rt.first ? 1 : 1 - Math.exp(-dt * 5)

    // Look: material preset + palette ease in; the whole map dims as it moves to the background.
    stepLook(material, uniforms, preset, dt, rt.first)
    uniforms.uCold.value.lerp(target.cold, k1)
    uniforms.uMid.value.lerp(target.mid, k1)
    uniforms.uHot.value.lerp(target.hot, k1)
    uniforms.uDim.value = lerp(1, 0.45, seg.back)
    uniforms.uTime.value = time

    // Pose: hero (rotates with scroll) → roll → background.
    const sway = motion && lk.autoRotate ? Math.sin(time * 0.35) * 0.07 * (1 - seg.curl) : 0
    const heroYaw = lerp(P.hero.ry0, P.hero.ry1, seg.hero) + sway
    const x = lerp(lerp(P.hero.x, P.roll.x, seg.curl), P.back.x, seg.back)
    const y = lerp(lerp(P.hero.y, P.roll.y, seg.curl), P.back.y, seg.back)
    const z = lerp(0, P.back.z, seg.back)
    const rx = lerp(lerp(P.hero.rx, P.roll.rx, seg.curl), P.back.rx, seg.back)
    const ry = lerp(lerp(heroYaw, P.roll.ry, seg.curl), P.back.ry, seg.back)
    pose.current.position.set(x, y + (motion ? Math.sin(time * 0.8) * 0.06 : 0), z)
    pose.current.rotation.set(rx, ry, 0)

    // Fit to the viewport: wide strip while flat, round roll once curled.
    const W = weeks * SPACING
    const D = 7 * SPACING
    const span = Math.abs(Math.cos(heroYaw)) * W + Math.abs(Math.sin(heroYaw)) * D
    const fitFlat = Math.min(1, (L.visW * 0.92) / span)
    const diameter = 2 * (W / TAU + MIN_BAR + MAX_BAR + 0.3)
    const fitRoll = Math.min(1, (L.visH * 0.78) / diameter, (L.visW * 0.86) / (diameter + D * 0.5))
    pose.current.scale.setScalar(lerp(fitFlat, fitRoll, seg.curl) * lerp(1, P.back.s, seg.back))

    // Roll: scroll-driven turn plus a slow idle turn once fully rolled.
    if (motion && seg.curl > 0.92) rt.spin -= dt * (lk.autoRotate ? 0.12 : 0.04)
    else rt.spin = damp(rt.spin, 0, 2.5, dt)
    rt.spin = wrapAngle(rt.spin)
    spin.current.rotation.z = -1.3 * Math.PI * seg.curl * seg.curl + rt.spin

    // Curl: bend the strip around its rolling centre. curl = 1 closes it into a full roll.
    rt.pivot = damp(rt.pivot, pivotColumn(lk.pivot, weeks), 4, dt)
    const k = (seg.curl * TAU) / W
    let mx = 0
    let my = 0
    for (let w = 0; w < weeks; w++) {
      const s = (w - rt.pivot) * SPACING
      const th = k * s
      let cx = s
      let cy = 0
      if (k > 1e-6) {
        const half = Math.sin(th * 0.5)
        cx = Math.sin(th) / k
        cy = (-2 * half * half) / k
      }
      rt.colX[w] = cx
      rt.colY[w] = cy
      rt.colT[w] = th
      mx += cx
      my += cy
    }
    mx /= weeks
    my /= weeks

    // Instances: ease bar heights + heat, rise in a wave on first load.
    if (!rt.introDone) { rt.intro += dt; if (rt.intro > 2.4) rt.introDone = true }
    const heat = geometry.attributes.aHeat
    let heatDirty = rt.first
    const { dummy } = rt
    for (let i = 0; i < count; i++) {
      const cell = data[i]
      const w = (i / 7) | 0
      const d = i - w * 7
      const goal = cell.future ? 0.06 : MIN_BAR + Math.max(0, cell.heat) * MAX_BAR + (i === rt.hover ? 0.2 : 0)
      rt.heights[i] = rt.first ? goal : damp(rt.heights[i], goal, 9, dt)
      const grow = rt.introDone ? 1 : smoothstep(0, 1, rt.intro * 1.5 - (w / weeks) * 0.9 - d * 0.03)
      const prev = heat.array[i]
      const next = cell.future ? -1 : rt.first ? cell.heat : damp(Math.max(0, prev), cell.heat, 7, dt)
      if (Math.abs(next - prev) > 1e-4) { heat.array[i] = next; heatDirty = true }
      dummy.position.set(rt.colX[w] - mx, rt.colY[w] - my, (d - 3) * SPACING)
      dummy.rotation.set(0, 0, -rt.colT[w])
      dummy.scale.set(1, Math.max(0.002, rt.heights[i] * grow), 1)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    }
    m.instanceMatrix.needsUpdate = true
    if (heatDirty) heat.needsUpdate = true
    m.boundingSphere = null // instances move every frame; let picking recompute bounds lazily

    // Today ring floats above today's tile and follows the curl.
    if (ring.current) {
      const show = today >= 0 && rt.introDone ? 1 - seg.back : 0
      ring.current.visible = show > 0.01
      if (show > 0.01) {
        const w = (today / 7) | 0
        const lift = rt.heights[today] + 0.3
        const th = rt.colT[w]
        ring.current.position.set(rt.colX[w] - mx + Math.sin(th) * lift, rt.colY[w] - my + Math.cos(th) * lift, (today - w * 7 - 3) * SPACING)
        ring.current.rotation.set(0, 0, -th)
        ring.current.scale.setScalar(show * (1 + (motion ? 0.08 * Math.sin(time * 3.2) : 0)))
        ringMat.current.color.copy(uniforms.uHot.value).multiplyScalar(1.6)
      }
    }

    rt.first = false
    if (!rt.ready) { rt.ready = true; live.current.onReady?.() }
  })

  const handlers = interactive
    ? {
        onPointerMove: (e) => {
          e.stopPropagation()
          const cell = e.instanceId != null ? live.current.cells[e.instanceId] : null
          const i = cell && !cell.future ? e.instanceId : -1
          rt.hover = i
          uniforms.uHover.value = i
          document.body.style.cursor = i >= 0 ? 'pointer' : ''
          onHover?.(i >= 0 ? i : null, e.nativeEvent.clientX, e.nativeEvent.clientY)
        },
        onPointerOut: () => {
          rt.hover = -1
          uniforms.uHover.value = -1
          document.body.style.cursor = ''
          onHover?.(null)
        },
        onClick: (e) => {
          e.stopPropagation()
          if (e.delta > 6) return // that was a drag-to-rotate
          const cell = e.instanceId != null ? live.current.cells[e.instanceId] : null
          if (cell && !cell.future) onSelect?.(cell.key)
        },
      }
    : {}

  return (
    <group ref={pose}>
      <group ref={spin}>
        <instancedMesh ref={mesh} args={[geometry, material, count]} frustumCulled={false} {...handlers} />
        <group ref={ring} visible={false}>
          <mesh rotation-x={-Math.PI / 2}>
            <ringGeometry args={[0.36, 0.44, 48]} />
            <meshBasicMaterial ref={ringMat} toneMapped={false} transparent opacity={0.9} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        </group>
      </group>
    </group>
  )
}
