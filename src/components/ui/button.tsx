import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Material 3 buttons. Variant names keep the old API:
 * default = filled, secondary = tonal, outline = outlined, ghost = text (or standard icon button), elevated.
 */
export const buttonVariants = cva(
  'state-layer inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full text-label-large transition-[box-shadow,background-color,color,opacity] duration-200 ease-standard disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-[18px] [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-on-primary hover:shadow-elevation-1',
        filled: 'bg-primary text-on-primary hover:shadow-elevation-1',
        secondary: 'bg-secondary-container text-on-secondary-container hover:shadow-elevation-1',
        tonal: 'bg-secondary-container text-on-secondary-container hover:shadow-elevation-1',
        outline: 'border border-outline bg-transparent text-primary',
        ghost: 'bg-transparent text-primary',
        text: 'bg-transparent text-primary',
        elevated: 'bg-surface-container-low text-primary shadow-elevation-1 hover:shadow-elevation-2',
        destructive: 'bg-error text-on-error hover:shadow-elevation-1',
        success: 'bg-success text-on-success hover:shadow-elevation-1',
        link: 'text-primary underline-offset-4 hover:underline [&::before]:hidden',
      },
      size: {
        default: 'h-10 px-6 has-[>svg:first-child]:pl-4',
        sm: 'h-8 px-4 text-label-medium has-[>svg:first-child]:pl-3',
        lg: 'h-14 px-8 text-title-medium has-[>svg:first-child]:pl-6 [&_svg]:size-6',
        icon: 'h-10 w-10 [&_svg]:size-6',
        'icon-sm': 'h-8 w-8 [&_svg]:size-5',
        'icon-lg': 'h-14 w-14 [&_svg]:size-7',
      },
    },
    compoundVariants: [
      // Standard icon buttons use the on-surface-variant colour, not primary.
      { variant: 'ghost', size: ['icon', 'icon-sm', 'icon-lg'], className: 'text-on-surface-variant' },
    ],
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, type = 'button', ...props }, ref) => (
  <button ref={ref} type={type} className={cn(buttonVariants({ variant, size, className }))} {...props} />
))
Button.displayName = 'Button'

/** Material 3 icon button with a required accessible label. */
export const IconButton = React.forwardRef<
  HTMLButtonElement,
  Omit<ButtonProps, 'size'> & { label: string; size?: 'icon' | 'icon-sm' | 'icon-lg'; selected?: boolean }
>(({ label, size = 'icon', variant = 'ghost', selected, className, ...props }, ref) => (
  <Button
    ref={ref}
    size={size}
    variant={variant}
    aria-label={label}
    title={label}
    aria-pressed={selected}
    className={cn(selected && 'bg-secondary-container text-on-secondary-container', className)}
    {...props}
  />
))
IconButton.displayName = 'IconButton'

/**
 * Floating action button. With `label` it is an extended FAB.
 * `fixed` pins it bottom-right on phones, above the navigation bar.
 */
export function Fab({
  icon,
  label,
  onClick,
  className,
  variant = 'primary',
  fixed = false,
  ...rest
}: {
  icon: React.ReactNode
  label?: string
  onClick?: () => void
  className?: string
  variant?: 'primary' | 'surface' | 'secondary' | 'tertiary'
  fixed?: boolean
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>) {
  const colors = {
    primary: 'bg-primary-container text-on-primary-container',
    surface: 'bg-surface-container-high text-primary',
    secondary: 'bg-secondary-container text-on-secondary-container',
    tertiary: 'bg-tertiary-container text-on-tertiary-container',
  }[variant]
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      data-page-fab={fixed ? '' : undefined}
      className={cn(
        'state-layer inline-flex h-14 items-center justify-center gap-3 rounded-lg text-label-large shadow-elevation-3 transition-shadow duration-200 hover:shadow-[var(--md-elevation-3),0_6px_12px_4px_rgb(0_0_0/0.12)] [&_svg]:size-6',
        label ? 'min-w-20 px-4 pr-5' : 'w-14',
        colors,
        fixed && 'fixed right-4 bottom-[calc(96px+env(safe-area-inset-bottom))] z-30 md:hidden',
        className,
      )}
      {...rest}
    >
      {icon}
      {label}
    </button>
  )
}
