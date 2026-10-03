import * as React from 'react'
import { cn } from '@/lib/utils'
import { ArrowDropDown, Check } from '@/components/icons'

/*
 * Material 3 outlined text fields. Wrap in <Field label> for the notched label
 * that sits on the outline. The label background comes from --field-bg, which
 * cards, dialogs and sheets set to their own surface colour.
 */
const field =
  'w-full rounded-xs border border-outline bg-transparent px-4 text-body-large text-on-surface outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-on-surface-variant/70 hover:border-on-surface focus:border-primary focus:shadow-[inset_0_0_0_1px_var(--md-primary)] focus-visible:outline-none disabled:opacity-40 aria-invalid:border-error'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(field, 'h-14', className)} {...props} />
))
Input.displayName = 'Input'

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(field, 'min-h-24 py-4', className)} {...props} />
))
Textarea.displayName = 'Textarea'

/** Outlined select with the Material dropdown arrow. `className` sizes the field (e.g. "h-10 w-32"). */
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...props }, ref) => (
  <div className={cn('relative inline-flex h-14 w-full', className)}>
    <select ref={ref} className={cn(field, 'h-full appearance-none pr-10 text-[inherit]')} {...props} />
    <ArrowDropDown className="pointer-events-none absolute top-1/2 right-2 size-6 -translate-y-1/2 text-on-surface-variant" />
  </div>
))
Select.displayName = 'Select'

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-label-large text-on-surface-variant', className)} {...props} />
}

/**
 * Field with an M3 label. Default: notched label on the outline of the input/select/textarea inside.
 * `plain`: label above the content (for chips, day pickers, sliders, button groups).
 */
export function Field({
  label,
  children,
  className,
  plain = false,
  supporting,
}: {
  label: string
  children: React.ReactNode
  className?: string
  plain?: boolean
  /** Helper text under the field */
  supporting?: React.ReactNode
}) {
  const autoId = React.useId()
  if (plain)
    return (
      <div className={cn('grid gap-2', className)}>
        <div className="text-label-large text-on-surface-variant">{label}</div>
        {children}
        {supporting && <div className="px-1 text-body-small text-on-surface-variant">{supporting}</div>}
      </div>
    )
  // Give the label a target: reuse the control's id or inject one.
  const only = React.Children.count(children) === 1 && React.isValidElement<{ id?: string; 'aria-describedby'?: string }>(children) ? children : null
  const id = only?.props.id ?? autoId
  const helpId = supporting ? `${id}-help` : undefined
  const control = only ? React.cloneElement(only, { id, 'aria-describedby': only.props['aria-describedby'] ?? helpId }) : children
  return (
    <div className={cn('group grid gap-1', className)}>
      <div className="relative">
        <label htmlFor={only ? id : undefined} className="pointer-events-none absolute -top-2 left-3 z-10 max-w-[calc(100%-1.5rem)] truncate bg-[var(--field-bg,var(--md-surface))] px-1 text-body-small text-on-surface-variant transition-colors group-focus-within:text-primary">
          {label}
        </label>
        {control}
      </div>
      {supporting && (
        <div id={helpId} className="px-4 text-body-small text-on-surface-variant">
          {supporting}
        </div>
      )}
    </div>
  )
}

/** Material 3 switch (52×32 track, thumb grows and shows a check when on). */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        onChange(!checked)
      }}
      className={cn(
        'group relative inline-flex h-8 w-[52px] shrink-0 items-center rounded-full border-2 transition-colors duration-200 ease-standard disabled:opacity-40',
        checked ? 'border-primary bg-primary' : 'border-outline bg-surface-container-highest',
      )}
    >
      <span
        className={cn(
          'flex items-center justify-center rounded-full transition-all duration-200 ease-standard group-active:h-7 group-active:w-7',
          checked ? 'ml-[22px] h-6 w-6 bg-on-primary text-primary' : 'ml-1.5 h-4 w-4 bg-outline',
        )}
      >
        {checked && <Check className="size-4" />}
      </span>
    </button>
  )
}

/** Round check (Google Tasks style). `color` tints the ring, e.g. by priority. */
export function Checkbox({
  checked,
  onChange,
  className,
  label,
  color,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  className?: string
  label?: string
  color?: string
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation()
        onChange(!checked)
      }}
      className={cn('state-layer -m-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-on-surface-variant', className)}
    >
      <span
        style={checked ? { background: color ?? 'var(--md-primary)', borderColor: color ?? 'var(--md-primary)' } : color ? { borderColor: color } : undefined}
        className={cn(
          'flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors duration-150',
          checked ? 'border-primary bg-primary text-on-primary' : 'border-on-surface-variant',
        )}
      >
        {checked && <Check className={cn('size-3.5', color ? 'text-white' : 'text-on-primary')} />}
      </span>
    </button>
  )
}

interface Opt<T extends string> {
  value: T
  label: React.ReactNode
}

/** Material 3 segmented buttons: for choosing between 2–5 short options. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T
  onChange: (v: T) => void
  options: Opt<T>[]
  className?: string
}) {
  return (
    <div
      role="radiogroup"
      className={cn('inline-grid h-10 max-w-full auto-cols-fr grid-flow-col overflow-x-auto rounded-full border border-outline no-scrollbar', className)}
    >
      {options.map((o, i) => {
        const on = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              'state-layer flex min-w-12 items-center justify-center gap-1.5 whitespace-nowrap px-3 text-label-large transition-colors [&_svg]:size-[18px]',
              i > 0 && 'border-l border-outline',
              on ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface',
            )}
          >
            {on && <Check className="size-[18px]" />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** Material 3 primary tabs: for switching between views of a page. */
export function Tabs<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T
  onChange: (v: T) => void
  options: Opt<T>[]
  className?: string
}) {
  return (
    <div role="tablist" className={cn('flex overflow-x-auto border-b border-outline-variant no-scrollbar', className)}>
      {options.map((o) => {
        const on = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={cn(
              'state-layer relative flex h-12 min-w-fit flex-1 items-center justify-center gap-2 px-4 text-title-small whitespace-nowrap transition-colors [&_svg]:size-5',
              on ? 'text-primary' : 'text-on-surface-variant',
            )}
          >
            {o.label}
            {on && <span className="absolute inset-x-3 bottom-0 h-[3px] rounded-t-full bg-primary" />}
          </button>
        )
      })}
    </div>
  )
}

/** Material 3 filter chip. */
export function Chip({
  selected = false,
  onClick,
  children,
  icon,
  className,
}: {
  selected?: boolean
  onClick?: () => void
  children: React.ReactNode
  icon?: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'state-layer inline-flex h-8 shrink-0 items-center gap-2 rounded-sm border px-4 text-label-large transition-colors [&_svg]:size-[18px]',
        selected ? 'border-transparent bg-secondary-container pl-2 text-on-secondary-container' : 'border-outline text-on-surface-variant',
        icon && !selected && 'pl-2',
        className,
      )}
    >
      {selected ? <Check /> : icon}
      {children}
    </button>
  )
}

export function DayPicker({ value, onChange, weekStart = 1 }: { value: number[]; onChange: (d: number[]) => void; weekStart?: 0 | 1 }) {
  const order = weekStart === 1 ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6]
  const letters = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return (
    <div className="flex flex-wrap gap-2">
      {order.map((d) => {
        const on = value.includes(d)
        return (
          <button
            key={d}
            type="button"
            aria-pressed={on}
            aria-label={names[d]}
            onClick={() => onChange(on ? value.filter((x) => x !== d) : [...value, d].sort())}
            className={cn(
              'state-layer h-10 w-10 rounded-full text-label-large transition-colors',
              on ? 'bg-primary text-on-primary' : 'bg-surface-container-highest text-on-surface-variant',
            )}
          >
            {letters[d]}
          </button>
        )
      })}
    </div>
  )
}
