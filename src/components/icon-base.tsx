import type { SVGProps } from 'react'
import { cn } from '@/lib/utils'

export interface IconProps extends SVGProps<SVGSVGElement> {
  /** Use the filled variant (e.g. the active navigation item). */
  filled?: boolean
  size?: number | string
}

export type IconComponent = ((props: IconProps) => React.JSX.Element) & { displayName?: string }

const paths = (raw: string) => [...raw.matchAll(/\sd="([^"]+)"/g)].map((m) => m[1])

/** Turns a Material Symbols SVG string into a React icon (24px by default, currentColor). */
export function makeIcon(name: string, raw: string, rawFilled?: string): IconComponent {
  const outline = paths(raw)
  const fill = rawFilled ? paths(rawFilled) : outline
  const Icon: IconComponent = ({ filled, size = 24, className, ...rest }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className={cn('shrink-0', className)}
      {...rest}
    >
      {(filled ? fill : outline).map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  )
  Icon.displayName = name
  return Icon
}
