// Material You: build the whole colour scheme from one seed colour (dynamic colour),
// for light and dark, and expose every role as a CSS variable (--md-<role>).
import {
  Blend,
  DynamicScheme,
  Hct,
  MaterialDynamicColors as C,
  Variant,
  TonalPalette,
  argbFromHex,
  hexFromArgb,
} from '@material/material-color-utilities'
import type { Settings } from './types'
import { setSystemBarsForTheme } from './native/platform'

export const DEFAULT_SEED = '#0b57d0' // Google blue

/** Preset seeds offered in Settings (Material You style). */
export const THEME_SEEDS = [
  { name: 'Blue', hex: '#0b57d0' },
  { name: 'Teal', hex: '#00796b' },
  { name: 'Green', hex: '#146c2e' },
  { name: 'Purple', hex: '#6750a4' },
  { name: 'Pink', hex: '#b4235f' },
  { name: 'Red', hex: '#b3261e' },
  { name: 'Orange', hex: '#a04100' },
  { name: 'Brown', hex: '#7d5260' },
]

const ROLES = {
  primary: C.primary,
  'on-primary': C.onPrimary,
  'primary-container': C.primaryContainer,
  'on-primary-container': C.onPrimaryContainer,
  secondary: C.secondary,
  'on-secondary': C.onSecondary,
  'secondary-container': C.secondaryContainer,
  'on-secondary-container': C.onSecondaryContainer,
  tertiary: C.tertiary,
  'on-tertiary': C.onTertiary,
  'tertiary-container': C.tertiaryContainer,
  'on-tertiary-container': C.onTertiaryContainer,
  error: C.error,
  'on-error': C.onError,
  'error-container': C.errorContainer,
  'on-error-container': C.onErrorContainer,
  surface: C.surface,
  'surface-dim': C.surfaceDim,
  'surface-bright': C.surfaceBright,
  'surface-container-lowest': C.surfaceContainerLowest,
  'surface-container-low': C.surfaceContainerLow,
  'surface-container': C.surfaceContainer,
  'surface-container-high': C.surfaceContainerHigh,
  'surface-container-highest': C.surfaceContainerHighest,
  'on-surface': C.onSurface,
  'on-surface-variant': C.onSurfaceVariant,
  outline: C.outline,
  'outline-variant': C.outlineVariant,
  'inverse-surface': C.inverseSurface,
  'inverse-on-surface': C.inverseOnSurface,
  'inverse-primary': C.inversePrimary,
  scrim: C.scrim,
  shadow: C.shadow,
} as const

/** Custom "success" (Google green) and "warning" (Google yellow) roles, harmonised with the seed. */
function extended(seed: number, hex: string, dark: boolean, name: string) {
  const p = TonalPalette.fromInt(Blend.harmonize(argbFromHex(hex), seed))
  const t = (tone: number) => hexFromArgb(p.tone(tone))
  return dark
    ? { [name]: t(80), [`on-${name}`]: t(20), [`${name}-container`]: t(30), [`on-${name}-container`]: t(90) }
    : { [name]: t(40), [`on-${name}`]: t(100), [`${name}-container`]: t(90), [`on-${name}-container`]: t(10) }
}

/**
 * Google-style scheme: tonal-spot structure (light containers, near-neutral surfaces)
 * but the primary keeps the seed's full colourfulness, like Google's own web apps.
 */
function googleScheme(seed: number, dark: boolean): DynamicScheme {
  const hct = Hct.fromInt(seed)
  return new DynamicScheme({
    sourceColorHct: hct,
    variant: Variant.TONAL_SPOT,
    contrastLevel: 0,
    isDark: dark,
    primaryPalette: TonalPalette.fromHueAndChroma(hct.hue, Math.max(hct.chroma, 48)),
    secondaryPalette: TonalPalette.fromHueAndChroma(hct.hue, 24),
    tertiaryPalette: TonalPalette.fromHueAndChroma((hct.hue + 60) % 360, 32),
    neutralPalette: TonalPalette.fromHueAndChroma(hct.hue, 4),
    neutralVariantPalette: TonalPalette.fromHueAndChroma(hct.hue, 8),
  })
}

export function schemeVars(seedHex: string, dark: boolean): Record<string, string> {
  const seed = argbFromHex(/^#[0-9a-f]{6}$/i.test(seedHex) ? seedHex : DEFAULT_SEED)
  const scheme = googleScheme(seed, dark)
  const vars: Record<string, string> = {}
  for (const [role, color] of Object.entries(ROLES)) vars[role] = hexFromArgb(color.getArgb(scheme))
  Object.assign(vars, extended(seed, '#1e8e3e', dark, 'success'), extended(seed, '#f9ab00', dark, 'warning'))
  return vars
}

export function themeCss(seedHex: string): string {
  const block = (sel: string, dark: boolean) =>
    `${sel}{${Object.entries(schemeVars(seedHex, dark))
      .map(([k, v]) => `--md-${k}:${v}`)
      .join(';')}}`
  return block(':root', false) + block('.dark', true)
}

const STYLE_ID = 'md-theme'
const SEED_KEY = 'lifeos-seed'

/** Theme and seed saved by the last session, so the first paint already has the right colours. */
export function storedTheme(): { theme: Settings['theme']; seed: string } {
  try {
    return {
      theme: (localStorage.getItem('lifeos-theme') as Settings['theme']) || 'system',
      seed: localStorage.getItem(SEED_KEY) || DEFAULT_SEED,
    }
  } catch {
    return { theme: 'system', seed: DEFAULT_SEED }
  }
}

/** Apply light/dark mode and the dynamic colour scheme. */
export function applyTheme(theme: Settings['theme'], seed: string = DEFAULT_SEED) {
  const css = themeCss(seed)
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!el) {
    el = document.createElement('style')
    el.id = STYLE_ID
    document.head.appendChild(el)
  }
  if (el.textContent !== css) el.textContent = css
  try {
    localStorage.setItem('lifeos-theme', theme)
    localStorage.setItem(SEED_KEY, seed)
  } catch {
    /* storage blocked */
  }
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
  setSystemBarsForTheme(dark)
  const bar = getComputedStyle(document.documentElement).getPropertyValue('--md-surface-container').trim()
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bar || (dark ? '#111318' : '#f8f9ff'))
}
