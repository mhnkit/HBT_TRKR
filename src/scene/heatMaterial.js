import { useEffect, useState } from 'react'
import * as THREE from 'three'
import { damp } from '../lib/util.js'

export function createHeatUniforms() {
  return {
    uCold: { value: new THREE.Color('#2b2142') },
    uMid: { value: new THREE.Color('#ff6b4a') },
    uHot: { value: new THREE.Color('#ffd89a') },
    uGhost: { value: new THREE.Color('#2a2e3a') },
    uGlow: { value: 1 },
    uTint: { value: 1 },
    uDim: { value: 1 },
    uHover: { value: -1 },
    uToday: { value: -1 },
    uSelected: { value: -1 },
    uTime: { value: 0 },
  }
}

const VERT_PARS = /* glsl */ `
attribute float aHeat;
attribute float aIndex;
varying float vHeat;
varying float vIndex;`

const FRAG_PARS = /* glsl */ `
uniform vec3 uCold;
uniform vec3 uMid;
uniform vec3 uHot;
uniform vec3 uGhost;
uniform float uGlow;
uniform float uTint;
uniform float uDim;
uniform float uHover;
uniform float uToday;
uniform float uSelected;
uniform float uTime;
varying float vHeat;
varying float vIndex;
vec3 kilnRamp(float h) {
  return h < 0.5 ? mix(uCold, uMid, h * 2.0) : mix(uMid, uHot, (h - 0.5) * 2.0);
}`

// Heat tints the surface (and therefore the light passing through glass)...
const FRAG_COLOR = /* glsl */ `
float kHeat = clamp(vHeat, 0.0, 1.0);
float kGhost = step(vHeat, -0.5);
vec3 kRamp = mix(kilnRamp(kHeat), uGhost, kGhost);
diffuseColor.rgb *= mix(vec3(1.0), kRamp, uTint);`

// ...and hot days emit light. Hover, today and the selected day get a lift.
const FRAG_EMISSIVE = /* glsl */ `
float kGlow = (1.0 - kGhost) * kHeat * kHeat;
totalEmissiveRadiance += kRamp * uGlow * kGlow * uDim;
float kHover = 1.0 - step(0.5, abs(vIndex - uHover));
float kToday = 1.0 - step(0.5, abs(vIndex - uToday));
float kSel = 1.0 - step(0.5, abs(vIndex - uSelected));
float kPulse = 0.55 + 0.45 * sin(uTime * 3.2);
totalEmissiveRadiance += (uHot + 0.15) * (kHover * 0.55 + kToday * kPulse * 0.35 + kSel * 0.45) * uDim;`

export function createHeatMaterial(uniforms) {
  const material = new THREE.MeshPhysicalMaterial({ color: 0xffffff })
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_PARS}`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHeat = aHeat;\nvIndex = aIndex;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_PARS}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${FRAG_COLOR}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${FRAG_EMISSIVE}`)
  }
  material.customProgramCacheKey = () => 'kiln-heat-cell-v1'
  return material
}

// Turning these on or off recompiles the shader, so they switch instantly instead of tweening.
const PROGRAM_KEYS = new Set(['transmission', 'iridescence', 'clearcoat', 'dispersion'])

/** Eases the material toward a preset every frame. */
export function stepLook(material, uniforms, preset, dt, instant = false) {
  for (const [key, target] of Object.entries(preset.props)) {
    const cur = material[key]
    if (typeof cur !== 'number' || instant || (PROGRAM_KEYS.has(key) && (cur === 0) !== (target === 0))) {
      if (cur !== target) material[key] = target
      continue
    }
    const next = damp(cur, target, 7, dt)
    material[key] = Math.abs(next - target) < 1e-3 ? target : next
  }
  uniforms.uGlow.value = instant ? preset.glow : damp(uniforms.uGlow.value, preset.glow, 6, dt)
  uniforms.uTint.value = instant ? preset.tint : damp(uniforms.uTint.value, preset.tint, 6, dt)
}

const textureCache = new Map()

/** Loads a texture only when `url` is set (e.g. when the Frosted preset is picked). */
export function useLazyTexture(url) {
  const [tex, setTex] = useState(() => (url ? textureCache.get(url) ?? null : null))
  useEffect(() => {
    if (!url) return undefined
    if (textureCache.has(url)) { setTex(textureCache.get(url)); return undefined }
    let alive = true
    new THREE.TextureLoader().load(
      url,
      (t) => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping
        t.repeat.set(2, 2)
        t.anisotropy = 4
        textureCache.set(url, t)
        if (alive) setTex(t)
      },
      undefined,
      (err) => console.warn('[kiln] texture failed to load', url, err),
    )
    return () => { alive = false }
  }, [url])
  return url ? tex : null
}
