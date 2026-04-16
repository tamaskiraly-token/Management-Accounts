import type { ReactNode } from 'react'
import { Card } from '../layout/Card'

export function KpiTile(props: {
  label: string
  value: ReactNode
  deltaLabel?: string
  deltaValue?: ReactNode
  deltaTone?: 'good' | 'bad' | 'neutral'
  footnote?: ReactNode
  right?: ReactNode
}) {
  const tone =
    props.deltaTone === 'good'
      ? 'var(--good)'
      : props.deltaTone === 'bad'
        ? 'var(--bad)'
        : 'var(--muted)'

  return (
    <Card padding="md">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <div className="subtle" style={{ color: 'var(--muted)' }}>
            {props.label}
          </div>
          <div style={{ fontSize: 26, fontWeight: 750, letterSpacing: '-0.02em' }}>
            {props.value}
          </div>
          {(props.deltaLabel || props.deltaValue) && (
            <div className="subtle">
              {props.deltaLabel && <span style={{ color: 'var(--muted-2)' }}>{props.deltaLabel} </span>}
              {props.deltaValue && <span style={{ color: tone, fontWeight: 700 }}>{props.deltaValue}</span>}
            </div>
          )}
          {props.footnote && <div className="subtle" style={{ color: 'var(--muted-2)' }}>{props.footnote}</div>}
        </div>
        {props.right && <div style={{ alignSelf: 'flex-start' }}>{props.right}</div>}
      </div>
    </Card>
  )
}

