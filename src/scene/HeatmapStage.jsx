import { Component, Suspense, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import HeatmapScene from './HeatmapScene.jsx'

/** If anything in the 3D tree throws (driver issue, lost context, bad model), show the static image. */
class StageBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    console.warn('[kiln] 3D stage failed; showing the static fallback instead.', error)
    this.props.onFail?.()
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

const maxDpr = () => Math.min(2, window.devicePixelRatio || 1)

export default function HeatmapStage({ onFail, ...sceneProps }) {
  const [dpr, setDpr] = useState(maxDpr)
  return (
    <StageBoundary onFail={onFail}>
      <Canvas
        className="stage-canvas"
        dpr={dpr}
        camera={{ position: [0, 6.4, 21], fov: 34, near: 0.1, far: 220 }}
        gl={{ antialias: true, alpha: false, stencil: false, powerPreference: 'high-performance' }}
      >
        {/* Drops resolution on slow devices, restores it when frame rate recovers. */}
        <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(maxDpr())} onFallback={() => setDpr(1)} flipflops={3} />
        <Suspense fallback={null}>
          <HeatmapScene {...sceneProps} />
        </Suspense>
      </Canvas>
    </StageBoundary>
  )
}
