import type { ReactNode } from 'react'

export type Column<Row> = {
  key: string
  header: ReactNode
  align?: 'left' | 'right' | 'center'
  width?: number | string
  render: (row: Row) => ReactNode
}

export function DataTable<Row extends { id: string }>(props: {
  columns: Column<Row>[]
  rows: Row[]
  dense?: boolean
}) {
  const padY = props.dense ? 8 : 10
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
        <thead>
          <tr>
            {props.columns.map((c) => (
              <th
                key={c.key}
                style={{
                  textAlign: c.align ?? 'left',
                  fontSize: 12,
                  color: 'var(--muted)',
                  fontWeight: 750,
                  padding: `10px 10px`,
                  borderBottom: '1px solid var(--border)',
                  whiteSpace: 'nowrap',
                  width: c.width,
                }}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.rows.map((r) => (
            <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
              {props.columns.map((c, idx) => (
                <td
                  key={c.key}
                  style={{
                    textAlign: c.align ?? 'left',
                    padding: `${padY}px 10px`,
                    borderBottom: '1px solid var(--border)',
                    fontSize: 13,
                    color: idx === 0 ? 'var(--text)' : 'var(--text)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

