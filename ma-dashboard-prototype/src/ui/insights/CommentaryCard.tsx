import type { ReactNode } from 'react'
import { Card } from '../layout/Card'

export function CommentaryCard(props: {
  title?: ReactNode
  subtitle?: ReactNode
  bullets: ReactNode[]
}) {
  return (
    <Card
      title={props.title ?? 'Commentary'}
      subtitle={props.subtitle ?? 'Executive summary for the selected period'}
      padding="md"
    >
      <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
        {props.bullets.map((b, i) => (
          <li key={i} style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.35 }}>
            {b}
          </li>
        ))}
      </ul>
    </Card>
  )
}

