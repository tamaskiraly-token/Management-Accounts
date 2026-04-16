import { ResponsiveContainer, Area, AreaChart } from 'recharts'

export function MiniTrend(props: {
  data: { x: string; y: number }[]
  tone?: 'brand' | 'good' | 'bad' | 'muted'
}) {
  const stroke =
    props.tone === 'good'
      ? 'var(--good)'
      : props.tone === 'bad'
        ? 'var(--bad)'
        : props.tone === 'muted'
          ? 'rgba(100,116,139,0.9)'
          : 'var(--brand)'

  const fill =
    props.tone === 'good'
      ? 'rgba(22,163,74,0.16)'
      : props.tone === 'bad'
        ? 'rgba(239,68,68,0.14)'
        : props.tone === 'muted'
          ? 'rgba(100,116,139,0.10)'
          : 'rgba(37,99,235,0.14)'

  return (
    <div style={{ width: 110, height: 46 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={props.data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <Area
            type="monotone"
            dataKey="y"
            stroke={stroke}
            strokeWidth={2}
            fill={fill}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

