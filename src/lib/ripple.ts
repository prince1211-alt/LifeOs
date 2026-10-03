// Material ripple: on press, any element with the `state-layer` class gets an
// expanding circle from the touch point (event delegation, one listener).
export function installRipple() {
  if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  document.addEventListener(
    'pointerdown',
    (e) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>('.state-layer')
      if (!el || el.matches(':disabled,[aria-disabled="true"]')) return
      const r = el.getBoundingClientRect()
      const size = Math.hypot(Math.max(e.clientX - r.left, r.right - e.clientX), Math.max(e.clientY - r.top, r.bottom - e.clientY)) * 2
      const span = document.createElement('span')
      span.className = 'md-ripple'
      span.style.width = span.style.height = `${size}px`
      span.style.left = `${e.clientX - r.left - size / 2}px`
      span.style.top = `${e.clientY - r.top - size / 2}px`
      el.appendChild(span)
      span.addEventListener('animationend', () => span.remove(), { once: true })
    },
    { passive: true },
  )
}
