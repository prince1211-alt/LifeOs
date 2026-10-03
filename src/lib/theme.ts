import type { Settings } from './types'

export function applyTheme(theme: Settings['theme']) {
  try {
    localStorage.setItem('lifeos-theme', theme)
  } catch {
    /* storage blocked */
  }
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0f172a' : '#f8fafc')
}
