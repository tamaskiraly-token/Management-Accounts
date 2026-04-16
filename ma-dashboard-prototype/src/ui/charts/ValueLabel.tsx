import type { ReactElement } from 'react'
import { formatCompactNumber, formatMoney } from '../../utils/format'

type LabelProps = {
  x?: number | string
  y?: number | string
  width?: number | string
  height?: number | string
  value?: number | string | boolean | null
  index?: number
}

export function makeValueLabel(args?: {
  tone?: 'muted' | 'dark'
  kind?: 'number' | 'money'
  currency?: 'USD' | 'GBP' | 'EUR'
  dp?: number
}) {
  const fill = args?.tone === 'dark' ? 'rgba(15,23,42,0.85)' : 'rgba(100,116,139,0.95)'

  return function ValueLabel(p: LabelProps): ReactElement | null {
    const x = typeof p.x === 'number' ? p.x : Number(p.x)
    const y = typeof p.y === 'number' ? p.y : Number(p.y)
    const value = typeof p.value === 'number' ? p.value : Number(p.value)
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(value)) return null

    const text =
      args?.kind === 'money'
        ? formatMoney(value, { compact: true, currency: args.currency })
        : formatCompactNumber(value)

    // Place slightly above the point/bar top.
    return (
      <text
        x={x}
        y={y - 6}
        textAnchor="middle"
        fontSize={10}
        fontWeight={700}
        fill={fill}
      >
        {text}
      </text>
    )
  }
}

export function makeBarValueLabel(args?: {
  tone?: 'muted' | 'dark'
  kind?: 'number' | 'money'
  currency?: 'USD' | 'GBP' | 'EUR'
}) {
  const fill = args?.tone === 'dark' ? 'rgba(15,23,42,0.85)' : 'rgba(100,116,139,0.95)'

  return function BarValueLabel(p: LabelProps): ReactElement | null {
    const x = typeof p.x === 'number' ? p.x : Number(p.x)
    const y = typeof p.y === 'number' ? p.y : Number(p.y)
    const w = typeof p.width === 'number' ? p.width : Number(p.width)
    const h = typeof p.height === 'number' ? p.height : Number(p.height)
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) return null
    const value = typeof p.value === 'number' ? p.value : Number(p.value)
    if (!Number.isFinite(value)) return null

    const text =
      args?.kind === 'money'
        ? formatMoney(value, { compact: true, currency: args.currency })
        : formatCompactNumber(value)

    const isHorizontal = w > h
    const pad = 6

    const tx = isHorizontal ? (value >= 0 ? x + w + pad : x - pad) : x + w / 2
    const top = Math.min(y, y + h)
    const bottom = Math.max(y, y + h)
    const ty = isHorizontal ? y + h / 2 + 4 : value >= 0 ? top - pad : bottom + 12
    const anchor: 'start' | 'middle' | 'end' = isHorizontal ? (value >= 0 ? 'start' : 'end') : 'middle'

    return (
      <text
        x={tx}
        y={ty}
        textAnchor={anchor}
        fontSize={10}
        fontWeight={750}
        fill={fill}
      >
        {text}
      </text>
    )
  }
}

