import * as React from 'react'
import { cn } from '@/lib/utils'

type CardVariant = 'default' | 'elevated' | 'filled' | 'outlined' | 'flat'

const CARD: Record<CardVariant, string> = {
  // Tonal card on the page surface (Google apps' default look).
  default: 'bg-surface-container-low [--field-bg:var(--md-surface-container-low)]',
  elevated: 'bg-surface-container-low shadow-elevation-1 [--field-bg:var(--md-surface-container-low)]',
  filled: 'bg-surface-container-highest [--field-bg:var(--md-surface-container-highest)]',
  outlined: 'border border-outline-variant bg-surface [--field-bg:var(--md-surface)]',
  flat: 'bg-surface-container [--field-bg:var(--md-surface-container)]',
}

/** Material 3 card (16px corners). */
export function Card({ className, variant = 'default', ...props }: React.HTMLAttributes<HTMLDivElement> & { variant?: CardVariant }) {
  return <div className={cn('rounded-lg text-on-surface', CARD[variant], className)} {...props} />
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center justify-between gap-2 px-4 pt-4 pb-2', className)} {...props} />
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('flex items-center gap-2 text-title-medium [&_svg]:size-5', className)} {...props} />
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-4 pb-4', className)} {...props} />
}
