import clsx from 'clsx'

export function Tabs<T extends string>(props: {
  items: { id: T; label: string }[]
  value: T
  onChange: (next: T) => void
  ariaLabel: string
}) {
  return (
    <nav
      aria-label={props.ariaLabel}
      style={{
        display: 'flex',
        gap: 6,
        padding: 6,
        borderRadius: 999,
        background: 'rgba(255,255,255,0.65)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {props.items.map((it) => {
        const active = it.id === props.value
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => props.onChange(it.id)}
            className={clsx(active && 'is-active')}
            style={{
              cursor: 'pointer',
              border: '1px solid transparent',
              borderRadius: 999,
              padding: '8px 12px',
              fontSize: 13,
              fontWeight: 650,
              letterSpacing: '-0.01em',
              color: active ? '#fff' : 'var(--muted)',
              background: active ? 'linear-gradient(180deg, #0f172a, #111827)' : 'transparent',
              boxShadow: active ? '0 8px 18px rgba(15,23,42,0.18)' : undefined,
            }}
          >
            {it.label}
          </button>
        )
      })}
    </nav>
  )
}

