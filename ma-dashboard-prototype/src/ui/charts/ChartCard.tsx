import type { ReactNode } from 'react'
import { Card } from '../layout/Card'

export function ChartCard(props: {
  title: ReactNode
  subtitle?: ReactNode
  right?: ReactNode
  children: ReactNode
  height?: number
}) {
  return (
    <Card title={props.title} subtitle={props.subtitle} right={props.right} padding="md">
      <div style={{ height: props.height ?? 260, minHeight: 0, minWidth: 0, position: 'relative' }}>
        {props.children}
      </div>
    </Card>
  )
}

