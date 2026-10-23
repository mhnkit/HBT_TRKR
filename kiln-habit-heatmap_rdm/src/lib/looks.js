import { mixHex } from './util.js'

/**
 * Material presets for the heatmap tiles (MeshPhysicalMaterial values).
 * Every preset lists every key so switching never leaves a stale value behind.
 * `glow` scales the per-cell heat emission, `tint` how strongly the heat colour tints the surface.
 */
const BASE = {
  transmission: 0, roughness: 0.2, metalness: 0, thickness: 1, ior: 1.5,
  clearcoat: 0, clearcoatRoughness: 0.1, iridescence: 0, iridescenceIOR: 1.3,
  dispersion: 0, envMapIntensity: 1, specularIntensity: 1,
}

export const MATERIALS = [
  { key: 'glass', label: 'Glass', glow: 1.0, tint: 1, props: { ...BASE, transmission: 1, roughness: 0.06, thickness: 1.1, dispersion: 0.25, envMapIntensity: 1.2 } },
  { key: 'frosted', label: 'Frosted', glow: 1.15, tint: 1, normalMap: '/textures/frost-normal.png', normalScale: 0.4, props: { ...BASE, transmission: 1, roughness: 0.42, thickness: 1.4, ior: 1.45 } },
  { key: 'holo', label: 'Holo', glow: 0.8, tint: 0.85, props: { ...BASE, transmission: 0.9, roughness: 0.12, thickness: 0.8, ior: 1.6, iridescence: 1, iridescenceIOR: 1.5 } },
  { key: 'chrome', label: 'Chrome', glow: 0.35, tint: 1, props: { ...BASE, roughness: 0.14, metalness: 1, envMapIntensity: 1.4 } },
  { key: 'ceramic', label: 'Ceramic', glow: 0.3, tint: 1, props: { ...BASE, roughness: 0.55, clearcoat: 0.8, clearcoatRoughness: 0.25, envMapIntensity: 0.9 } },
  { key: 'neon', label: 'Neon', glow: 2.6, tint: 0.6, props: { ...BASE, transmission: 0.35, roughness: 0.25, thickness: 0.6, envMapIntensity: 0.6 } },
]

/** Heat ramps: empty day → partly done → everything done. */
export const PALETTES = [
  { key: 'ember', label: 'Ember', cold: '#2b2142', mid: '#ff6b4a', hot: '#ffd89a' },
  { key: 'aurora', label: 'Aurora', cold: '#14283a', mid: '#16c79a', hot: '#e2ff9a' },
  { key: 'violet', label: 'Violet', cold: '#1e1739', mid: '#7a5cff', hot: '#ff9ae4' },
  { key: 'glacier', label: 'Glacier', cold: '#172333', mid: '#3aa0ff', hot: '#e8f7ff' },
  { key: 'mono', label: 'Mono', cold: '#1f222b', mid: '#8b93a7', hot: '#ffffff' },
]

export const DEFAULT_LOOK = { material: 'glass', palette: 'ember', custom: '#5ee0c1', autoRotate: true, pivot: 'middle' }

export function resolvePalette(look) {
  if (look.palette === 'custom') {
    const cold = '#1d2030'
    return { key: 'custom', cold, mid: mixHex(cold, look.custom, 0.85), hot: mixHex(look.custom, '#ffffff', 0.55) }
  }
  return PALETTES.find((p) => p.key === look.palette) ?? PALETTES[0]
}

export const findMaterial = (key) => MATERIALS.find((m) => m.key === key) ?? MATERIALS[0]

/** Where the heatmap rolls from. The brief left this open, so it's a setting. */
export const PIVOTS = [
  { key: 'middle', label: 'Middle' },
  { key: 'oldest', label: 'Oldest week' },
  { key: 'newest', label: 'This week' },
]
export const pivotColumn = (pivot, weeks) => (pivot === 'oldest' ? 0 : pivot === 'newest' ? weeks - 1 : (weeks - 1) / 2)
