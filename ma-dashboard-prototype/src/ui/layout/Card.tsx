import type { CSSProperties, ReactNode } from 'react'
import clsx from 'clsx'

export function Card(props: {
  children: ReactNode
  title?: ReactNode
  subtitle?: ReactNode
  right?: ReactNode
  padding?: 'sm' | 'md' | 'lg'
  className?: string
  style?: CSSProperties
}) {
  const padding =
    props.padding === 'sm' ? 12 : props.padding === 'lg' ? 18 : props.padding === 'md' ? 16 : 16

  return (
    <section
      className={clsx(props.className)}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        boxShadow: 'var(--shadow-sm)',
        padding,
        ...props.style,
      }}
    >
      {(props.title || props.right || props.subtitle) && (
        <div
          style={{
            display: 'flex',
            alignItems: props.subtitle ? 'flex-start' : 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 10,
          }}
        >
          <div>
            {props.title && <div className="h2">{props.title}</div>}
            {props.subtitle && <div className="subtle" style={{ marginTop: 2 }}>{props.subtitle}</div>}
          </div>
          {props.right && <div>{props.right}</div>}
        </div>
      )}
      {props.children}
    </section>
  )
}

