import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { segments, story } from '../lib/story.js'
import { clamp, damp, smoothstep } from '../lib/util.js'
import { resolvePalette } from '../lib/looks.js'
import Heatmap from './Heatmap.jsx'

const HDRI_URL = '/hdri/studio-soft.hdr'
const ORIGIN = new THREE.Vector3()

/** Poses for each part of the scroll story. `tall` is used for portrait phones. */
const POSES = {
  wide: {
    hero: { x: 0, y: -0.3, rx: 0.34, ry0: -0.42, ry1: 0.32 },
    roll: { x: 0, y: 0.25, rx: 0.16, ry: 0.55 },
    back: { x: 4.2, y: 1.4, z: -9, rx: 0.42, ry: 0.95, s: 0.92 },
    shadowY: -1.9,
  },
  tall: {
    hero: { x: 0, y: -0.6, rx: 0.42, ry0: -1.05, ry1: -0.55 },
    roll: { x: 0, y: -0.2, rx: 0.16, ry: 0.5 },
    back: { x: 0.8, y: 2.2, z: -10, rx: 0.42, ry: 0.95, s: 0.92 },
    shadowY: -3.2,
  },
}

function useLayout() {
  const size = useThree((s) => s.size)
  return useMemo(() => {
    const aspect = size.width / Math.max(1, size.height)
    const tall = aspect <= 0.8
    const fov = tall ? 46 : 34
    const home = tall ? new THREE.Vector3(0, 7.2, 23) : new THREE.Vector3(0, 6.4, 21)
    const visH = 2 * home.length() * Math.tan(THREE.MathUtils.degToRad(fov) / 2)
    return { tall, fov, home, visH, visW: visH * aspect, poses: tall ? POSES.tall : POSES.wide }
  }, [size.width, size.height])
}

/** Eases what the scene renders toward the scroll story (or the inspect-mode override). */
function StoryClock({ reducedMotion }) {
  useFrame((_, dt) => {
    const goal = story.override ?? story.t
    const gap = Math.abs(goal - story.scene)
    story.scene = reducedMotion ? goal : damp(story.scene, goal, story.override != null || gap > 0.15 ? 3.5 : 14, Math.min(dt, 0.05))
  }, -2)
  return null
}

function Backdrop({ glow }) {
  const material = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      uTop: { value: new THREE.Color('#121a33') },
      uBottom: { value: new THREE.Color('#05070f') },
      uGlow: { value: new THREE.Color(glow) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop; uniform vec3 uBottom; uniform vec3 uGlow;
      varying vec3 vDir;
      float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      void main() {
        vec3 dir = normalize(vDir);
        vec3 col = mix(uBottom, uTop, smoothstep(-0.35, 0.85, dir.y));
        float g = max(dot(dir, normalize(vec3(0.0, 0.1, -1.0))), 0.0);
        col += uGlow * (pow(g, 5.0) * 0.16 + pow(g, 40.0) * 0.1);
        col += (hash(dir * 400.0) - 0.5) * 0.012; // grain against banding
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  }), []) // eslint-disable-line react-hooks/exhaustive-deps
  const target = useMemo(() => new THREE.Color(glow), [glow])
  useFrame((_, dt) => material.uniforms.uGlow.value.lerp(target, 1 - Math.exp(-dt * 4)))
  useEffect(() => () => material.dispose(), [material])
  return (
    <mesh material={material} frustumCulled={false} renderOrder={-1}>
      <sphereGeometry args={[90, 48, 24]} />
    </mesh>
  )
}

/** HDRI is requested only once the browser is idle, so it never delays first paint. */
function LazyEnvironment() {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((cb) => setTimeout(cb, 400))
    const cancel = window.cancelIdleCallback ?? clearTimeout
    const id = idle(() => setOn(true), { timeout: 1500 })
    return () => cancel(id)
  }, [])
  return on ? <Suspense fallback={null}><Environment files={HDRI_URL} /></Suspense> : null
}

/** Soft contact shadow under the flat map; fades out as it rolls up. */
function SoftShadow({ y }) {
  const ref = useRef()
  useFrame(() => {
    if (!ref.current) return
    const opacity = 0.6 * (1 - smoothstep(0.02, 0.35, segments(story.scene).curl))
    ref.current.visible = opacity > 0.01
    ref.current.traverse((o) => { if (o.material && 'opacity' in o.material) o.material.opacity = opacity })
  })
  return (
    <group ref={ref}>
      <ContactShadows position={[0, y, 0]} scale={44} blur={2.8} far={7} resolution={512} opacity={0.6} color="#000000" />
    </group>
  )
}

/** Eases the camera home when the story moves on, and runs the panel's zoom buttons. */
function CameraRig({ layout, controlsRef, apiRef, inspect }) {
  const camera = useThree((s) => s.camera)
  const st = useMemo(() => ({ returning: true, zoomTo: null, tmp: new THREE.Vector3() }), [])

  useEffect(() => {
    camera.fov = layout.fov
    camera.updateProjectionMatrix()
    st.returning = true
  }, [camera, layout, st])

  useEffect(() => {
    apiRef.current = {
      zoomBy(factor) {
        const target = controlsRef.current?.target ?? ORIGIN
        st.zoomTo = clamp(camera.position.distanceTo(target) * factor, 9, 42)
        st.returning = false
      },
      reset() { st.returning = true; st.zoomTo = null },
      interrupt() { st.returning = false; st.zoomTo = null },
    }
    return () => { apiRef.current = null }
  }, [apiRef, camera, controlsRef, st])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const target = controlsRef.current?.target ?? ORIGIN
    const away = !inspect && story.scene > 0.22
    if (st.returning || away) {
      const a = 1 - Math.exp(-dt * 2.8)
      camera.position.lerp(layout.home, a)
      if (target !== ORIGIN) target.lerp(ORIGIN, a)
      if (st.returning && camera.position.distanceToSquared(layout.home) < 1e-4) st.returning = false
    } else if (st.zoomTo != null) {
      st.tmp.copy(camera.position).sub(target)
      const d = st.tmp.length()
      const next = damp(d, st.zoomTo, 7, dt)
      camera.position.copy(target).add(st.tmp.multiplyScalar(next / d))
      if (Math.abs(next - st.zoomTo) < 0.01) st.zoomTo = null
    }
    camera.lookAt(target)
  })
  return null
}

export default function HeatmapScene({
  cells, weeks, look, phase, inspect, inspectShape, finePointer, reducedMotion,
  todayIndex, selectedIndex, onHover, onSelect, onReady, apiRef,
}) {
  const layout = useLayout()
  const controlsRef = useRef()
  const palette = resolvePalette(look)
  // Drag-to-rotate on desktop while on the hero; touch devices get full controls in inspect mode
  // so a swipe on the hero always scrolls the page.
  const showControls = inspect || (finePointer && phase === 'hero')
  const showShadow = inspect ? inspectShape === 'flat' : phase === 'hero'
  const interactive = inspect || phase === 'hero'

  return (
    <>
      <StoryClock reducedMotion={reducedMotion} />
      <color attach="background" args={['#070a14']} />
      <Backdrop glow={palette.mid} />
      <hemisphereLight args={['#cfd8ff', '#140d18', 0.45]} />
      <directionalLight position={[5, 9, 7]} intensity={1.6} color="#fff1e0" />
      <directionalLight position={[-7, 3, -6]} intensity={0.9} color="#9db4ff" />
      <LazyEnvironment />
      <Heatmap
        key={weeks}
        cells={cells}
        weeks={weeks}
        look={look}
        layout={layout}
        interactive={interactive}
        todayIndex={todayIndex}
        selectedIndex={selectedIndex}
        onHover={onHover}
        onSelect={onSelect}
        onReady={onReady}
        reducedMotion={reducedMotion}
      />
      {showShadow && <SoftShadow y={layout.poses.shadowY} />}
      {showControls && (
        <OrbitControls
          ref={controlsRef}
          enablePan={false}
          enableZoom={inspect}
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.55}
          zoomSpeed={0.8}
          minDistance={9}
          maxDistance={42}
          minPolarAngle={0.25}
          maxPolarAngle={1.5}
          onStart={() => apiRef.current?.interrupt()}
        />
      )}
      <CameraRig layout={layout} controlsRef={controlsRef} apiRef={apiRef} inspect={inspect} />
    </>
  )
}
