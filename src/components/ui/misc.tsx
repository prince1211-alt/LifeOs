import * as React from 'react'
import { cn } from '@/lib/utils'
import { ChevronRight } from '@/components/icons'

type BadgeVariant = 'default' | 'outline' | 'success' | 'warning' | 'destructive' | 'primary' | 'secondary' | 'tertiary'

const BADGE: Record<BadgeVariant, string> = {
  default: 'bg-surface-container-highest text-on-surface-variant',
  outline: 'border border-outline-variant text-on-surface-variant',
  success: 'bg-success-container text-on-success-container',
  warning: 'bg-warning-container text-on-warning-container',
  destructive: 'bg-error-container text-on-error-container',
  primary: 'bg-primary-container text-on-primary-container',
  secondary: 'bg-secondary-container text-on-secondary-container',
  tertiary: 'bg-tertiary-container text-on-tertiary-container',
}

/** Small static chip for metadata (due date, tags, counts). */
export function Badge({ className, variant = 'default', ...props }: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn('inline-flex h-6 items-center gap-1 rounded-sm px-2 text-label-medium whitespace-nowrap [&_svg]:size-3.5', BADGE[variant], className)}
      {...props}
    />
  )
}

/** Material 3 linear progress indicator. */
export function Progress({ value, className, color }: { value: number; className?: string; color?: string }) {
  const v = Math.max(0, Math.min(1, value))
  return (
    <div className={cn('flex h-1 w-full gap-1', className)} role="progressbar" aria-valuenow={Math.round(v * 100)} aria-valuemin={0} aria-valuemax={100}>
      {v > 0 && <div className="h-full rounded-full bg-primary transition-all duration-500 ease-standard" style={{ width: `${v * 100}%`, background: color }} />}
      {v < 1 && <div className="h-full flex-1 rounded-full bg-secondary-container" />}
    </div>
  )
}

/** Material 3 circular progress (determinate). */
export function ProgressRing({
  value,
  size = 96,
  stroke = 8,
  color = 'var(--md-primary)',
  track = 'var(--md-secondary-container)',
  children,
}: {
  value: number
  size?: number
  stroke?: number
  color?: string
  track?: string
  children?: React.ReactNode
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value))
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        {v > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - v)}
            style={{ transition: 'stroke-dashoffset 0.6s var(--md-ease-standard)' }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  )
}

/** Google-style empty state: tonal icon disc, title, one line of help, optional action. */
export function EmptyState({
  icon,
  title,
  text,
  action,
  className,
}: {
  icon?: React.ReactNode
  title: string
  text?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-6 py-12 text-center', className)}>
      {icon && (
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container [&_svg]:size-10">
          {icon}
        </div>
      )}
      <p className="text-title-medium">{title}</p>
      {text && <p className="max-w-sm text-body-medium text-on-surface-variant">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export interface PageFab {
  icon: React.ReactNode
  label: string
  onClick: () => void
}

/**
 * Page title row. `fab` is the page's primary action: a tonal button in the header on
 * desktop and an extended FAB above the navigation bar on phones.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  fab,
}: {
  title: string
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  fab?: PageFab
}) {
  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-headline-small text-on-surface md:text-headline-medium">{title}</h1>
          {subtitle && <div className="mt-0.5 text-body-medium text-on-surface-variant">{subtitle}</div>}
        </div>
        {(actions || fab) && (
          <div className="flex flex-wrap items-center gap-2">
            {actions}
            {fab && (
              <button
                type="button"
                onClick={fab.onClick}
                className="state-layer hidden h-14 items-center gap-3 rounded-lg bg-primary-container pr-5 pl-4 text-label-large text-on-primary-container shadow-elevation-1 transition-shadow hover:shadow-elevation-2 md:inline-flex [&_svg]:size-6"
              >
                {fab.icon}
                {fab.label}
              </button>
            )}
          </div>
        )}
      </div>
      {fab && (
        <button
          type="button"
          onClick={fab.onClick}
          aria-label={fab.label}
          data-page-fab
          className="state-layer fixed right-4 bottom-[calc(96px+env(safe-area-inset-bottom))] z-30 inline-flex h-14 items-center gap-3 rounded-lg bg-primary-container pr-5 pl-4 text-label-large text-on-primary-container shadow-elevation-3 md:hidden [&_svg]:size-6"
        >
          {fab.icon}
          {fab.label}
        </button>
      )}
    </>
  )
}

/** Tonal stat tile: label, big value, optional supporting line. */
export function Stat({ label, value, sub, className }: { label: string; value: React.ReactNode; sub?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-md bg-surface-container p-4', className)}>
      <div className="text-label-medium text-on-surface-variant">{label}</div>
      <div className="tabular mt-1 text-title-large text-on-surface">{value}</div>
      {sub && <div className="text-body-small text-on-surface-variant">{sub}</div>}
    </div>
  )
}

/** Material 3 list item: leading icon/avatar, headline, supporting text, trailing content. */
export function ListItem({
  leading,
  headline,
  supporting,
  trailing,
  onClick,
  href,
  className,
  chevron = false,
}: {
  leading?: React.ReactNode
  headline: React.ReactNode
  supporting?: React.ReactNode
  trailing?: React.ReactNode
  onClick?: () => void
  href?: string
  className?: string
  chevron?: boolean
}) {
  const body = (
    <>
      {leading && <div className="flex shrink-0 items-center text-on-surface-variant [&_svg]:size-6">{leading}</div>}
      <div className="min-w-0 flex-1">
        <div className="text-body-large text-on-surface">{headline}</div>
        {supporting && <div className="text-body-medium text-on-surface-variant">{supporting}</div>}
      </div>
      {trailing && <div className="flex shrink-0 items-center gap-2 text-label-small text-on-surface-variant">{trailing}</div>}
      {chevron && <ChevronRight className="size-6 shrink-0 text-on-surface-variant" />}
    </>
  )
  const cls = cn('flex min-h-14 w-full items-center gap-4 px-4 py-2 text-left', (onClick || href) && 'state-layer', className)
  if (href)
    return (
      <a href={href} className={cls}>
        {body}
      </a>
    )
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cls}>
        {body}
      </button>
    )
  return <div className={cls}>{body}</div>
}

export function Divider({ className, inset = false }: { className?: string; inset?: boolean }) {
  return <hr className={cn('border-0 border-t border-outline-variant', inset && 'ml-14', className)} />
}

/** Section heading used inside pages and cards (Google "title-small" in primary colour). */
export function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={cn('px-1 pt-2 pb-2 text-title-small text-primary', className)}>{children}</h2>
}
