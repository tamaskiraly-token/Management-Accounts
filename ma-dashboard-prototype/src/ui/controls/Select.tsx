export function Select(props: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (next: string) => void
}) {
  return (
    <label style={{ display: 'grid', gap: 4 }}>
      <div className="subtle">{props.label}</div>
      <select
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        style={{
          height: 34,
          borderRadius: 12,
          padding: '0 10px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
          fontWeight: 650,
          fontSize: 13,
          boxShadow: 'var(--shadow-sm)',
          outline: 'none',
        }}
      >
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

