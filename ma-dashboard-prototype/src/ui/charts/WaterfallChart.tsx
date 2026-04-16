import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCompactNumber } from '../../utils/format'

type Step = {
  id: string
  label: string
  delta?: number // omit for totals
  total?: number // for totals
}

type TickProps = {
  x?: number
  y?: number
  payload?: { value?: string }
}

type LabelRenderProps = {
  x?: number | string
  y?: number | string
  width?: number | string
  height?: number | string
  value?: number | string | boolean | null
  index?: number
}

type Row = {
  name: string
  base: number
  delta: number
  total: number
  tone: 'pos' | 'neg' | 'total'
}

function buildRows(steps: Step[]) {
  let running = 0
  const rows: Row[] = []

  for (const s of steps) {
    if (typeof s.total === 'number') {
      running = s.total
      rows.push({ name: s.label, base: 0, delta: 0, total: s.total, tone: 'total' })
      continue
    }

    const d = s.delta ?? 0
    const base = running
    running += d
    rows.push({ name: s.label, base, delta: d, total: 0, tone: d >= 0 ? 'pos' : 'neg' })
  }

  return rows
}

export function WaterfallChart(props: {
  steps: Step[]
  height: number
  yTickFormatter?: (v: number) => string
  tooltipFormatter?: (v: number) => string
  labelFormatter?: (v: number) => string
  deltaLabelFormatter?: (v: number) => string
  totalLabelFormatter?: (v: number) => string
}) {
  const rows = buildRows(props.steps)
  const deltaFill = (d: number) =>
    d >= 0 ? 'rgba(37,99,235,0.38)' : 'rgba(239,68,68,0.24)'
  const lf = props.labelFormatter ?? ((v: number) => formatCompactNumber(v))
  const dlf = props.deltaLabelFormatter ?? lf
  const tlf = props.totalLabelFormatter ?? lf

  function Tick(p: TickProps) {
    const x = p.x ?? 0
    const y = p.y ?? 0
    const v = p.payload?.value ?? ''
    return (
      <text
        x={x}
        y={y + 16}
        textAnchor="middle"
        fill="rgba(100,116,139,0.95)"
        fontSize={11}
        fontWeight={700}
      >
        {v}
      </text>
    )
  }

  function DeltaLabel(p: LabelRenderProps) {
    const x = typeof p.x === 'number' ? p.x : Number(p.x)
    const y = typeof p.y === 'number' ? p.y : Number(p.y)
    const w = typeof p.width === 'number' ? p.width : Number(p.width)
    const h = typeof p.height === 'number' ? p.height : Number(p.height)
    const i = typeof p.index === 'number' ? p.index : -1
    const v = i >= 0 ? rows[i]?.delta ?? 0 : 0
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) return null
    if (v === 0) return null
    return (
      <text
        x={x + w / 2}
        y={v >= 0 ? y - 6 : y + h + 12}
        textAnchor="middle"
        fontSize={10}
        fontWeight={700}
        fill="rgba(100,116,139,0.95)"
      >
        {dlf(v)}
      </text>
    )
  }

  function TotalLabel(p: LabelRenderProps) {
    const x = typeof p.x === 'number' ? p.x : Number(p.x)
    const y = typeof p.y === 'number' ? p.y : Number(p.y)
    const w = typeof p.width === 'number' ? p.width : Number(p.width)
    const i = typeof p.index === 'number' ? p.index : -1
    const v = i >= 0 ? rows[i]?.total ?? 0 : 0
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w)) return null
    if (v === 0) return null
    return (
      <text
        x={x + w / 2}
        y={y - 6}
        textAnchor="middle"
        fontSize={10}
        fontWeight={800}
        fill="rgba(15,23,42,0.75)"
      >
        {tlf(v)}
      </text>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={props.height}>
      <BarChart data={rows} margin={{ top: 10, right: 10, bottom: 18, left: 0 }}>
        <CartesianGrid stroke="rgba(15,23,42,0.06)" vertical={false} />
        <XAxis
          dataKey="name"
          tickLine={false}
          axisLine={false}
          interval={0}
          minTickGap={0}
          height={28}
          tickMargin={10}
          tick={<Tick />}
        />
        <YAxis tickLine={false} axisLine={false} tickFormatter={props.yTickFormatter} />
        <Tooltip
          formatter={(v: any, name: any, item: any) => {
            const row = item?.payload as Row | undefined
            const raw = name === 'total' ? row?.total ?? 0 : name === 'delta' ? row?.delta ?? 0 : v
            return [props.tooltipFormatter ? props.tooltipFormatter(raw) : String(raw), '']
          }}
          labelFormatter={(_, payload) => (payload?.[0]?.payload?.name as string) ?? ''}
          contentStyle={{
            background: 'rgba(255,255,255,0.95)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            boxShadow: 'var(--shadow-md)',
          }}
        />

        {/* invisible base */}
        <Bar dataKey="base" stackId="a" fill="rgba(0,0,0,0)" isAnimationActive={false} />
        {/* delta (positive/negative) */}
        <Bar
          dataKey="delta"
          stackId="a"
          isAnimationActive={false}
          radius={[10, 10, 10, 10]}
        >
          {rows.map((r, i) => (
            <Cell key={i} fill={deltaFill(r.delta)} />
          ))}
          <LabelList content={DeltaLabel} />
        </Bar>
        {/* totals */}
        <Bar
          dataKey="total"
          stackId="a"
          isAnimationActive={false}
          radius={[10, 10, 10, 10]}
          fill="rgba(15,23,42,0.20)"
        >
          <LabelList content={TotalLabel} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

