export function Segmented<T extends string>(props: {
  value: T
  options: { value: T; label: string }[]
  onChange: (next: T) => void
  ariaLabel: string
}) {
  return (
    <div
      aria-label={props.ariaLabel}
      role="group"
      style={{
        display: 'inline-flex',
        gap: 4,
        padding: 4,
        borderRadius: 999,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {props.options.map((o) => {
        const active = o.value === props.value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => props.onChange(o.value)}
            style={{
              cursor: 'pointer',
              border: '1px solid transparent',
              borderRadius: 999,
              padding: '6px 10px',
              fontSize: 12,
              fontWeight: 650,
              color: active ? '#0b1220' : 'var(--muted)',
              background: active ? 'rgba(37, 99, 235, 0.10)' : 'transparent',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

