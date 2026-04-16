import { useMemo } from 'react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { DashboardFilters, MockModel } from '../data/types'
import { ChartCard } from '../ui/charts/ChartCard'
import { makeValueLabel } from '../ui/charts/ValueLabel'
import { WaterfallChart } from '../ui/charts/WaterfallChart'
import { Card } from '../ui/layout/Card'
import { CommentaryCard } from '../ui/insights/CommentaryCard'
import { KpiTile } from '../ui/metrics/KpiTile'
import { DataTable } from '../ui/tables/DataTable'
import { formatMoney, formatPercent, safeDiv } from '../utils/format'
import { hashStringToSeed, mulberry32 } from '../utils/rng'
import { sum, ytdSlice } from '../utils/series'

const COLORS = {
  op: 'rgba(37,99,235,0.42)',
  inv: 'rgba(79,70,229,0.22)',
  fin: 'rgba(20,184,166,0.28)',
  net: 'rgba(15,23,42,0.85)',
  grid: 'rgba(15,23,42,0.06)',
}

export function CfPage(props: { model: MockModel; filters: DashboardFilters }) {
  const entity = props.model.get(props.filters.entity)
  const currency = entity.currency
  const moneyPoint = useMemo(() => makeValueLabel({ kind: 'money', currency, tone: 'muted' }), [currency])
  const idx = Math.max(0, entity.months.findIndex((m) => m.periodEnd === props.filters.periodEnd))
  const current = entity.months[idx] ?? entity.months[entity.months.length - 1]!
  const window = entity.months.slice(Math.max(0, idx - 11), idx + 1)

  const scope = props.filters.view === 'ytd' ? ytdSlice(entity.months, current.periodEnd) : [current]
  const cashKpis = useMemo(() => {
    const op = sum(scope, (m) => m.operatingCashFlow)
    const inv = sum(scope, (m) => m.investingCashFlow)
    const fin = sum(scope, (m) => m.financingCashFlow)
    const net = op + inv + fin
    const endCash = current.endingCash
    const burn = -sum(scope, (m) => m.revenue - m.cogs - m.opex)
    const runway = Math.max(1, Math.round(endCash / Math.max(1, burn)))
    return { op, inv, fin, net, endCash, burn, runway }
  }, [current.endingCash, scope])

  const bridge = useMemo(() => {
    const endCash = current.endingCash
    const startCash = endCash - current.netCashMovement
    return {
      startCash,
      endCash,
      steps: [
        { id: 'start', label: 'Starting cash', total: startCash },
        { id: 'op', label: 'Operating', delta: current.operatingCashFlow },
        { id: 'inv', label: 'Investing', delta: current.investingCashFlow },
        { id: 'fin', label: 'Financing', delta: current.financingCashFlow },
        { id: 'end', label: 'Ending cash', total: endCash },
      ],
    }
  }, [current])

  const trend = useMemo(() => {
    return window.map((m) => ({
      period: m.periodLabel.slice(0, 3),
      'Net movement': m.netCashMovement,
      'Ending cash': m.endingCash,
    }))
  }, [window])

  const netMovementLabel = useMemo(() => {
    return function NetMovementLabel(p: any) {
      const x = typeof p.x === 'number' ? p.x : Number(p.x)
      const y = typeof p.y === 'number' ? p.y : Number(p.y)
      const w = typeof p.width === 'number' ? p.width : Number(p.width)
      const h = typeof p.height === 'number' ? p.height : Number(p.height)
      const v = typeof p.value === 'number' ? p.value : Number(p.value)
      if (![x, y, w, h, v].every(Number.isFinite)) return null

      // Hide tiny bars to avoid unreadable overlaps around zero.
      if (Math.abs(v) < 450_000) return null

      const pad = 6
      const tx = x + w / 2
      const ty = v >= 0 ? y - pad : y + h + 12
      return (
        <text
          x={tx}
          y={ty}
          textAnchor="middle"
          fontSize={10}
          fontWeight={750}
          fill="rgba(100,116,139,0.95)"
        >
          {formatMoney(v, { compact: true, currency })}
        </text>
      )
    }
  }, [currency])

  const deltaMoney = useMemo(() => {
    return (v: number) => {
      const sign = v > 0 ? '+' : v < 0 ? '−' : ''
      return `${sign}${formatMoney(Math.abs(v), { compact: true, currency })}`
    }
  }, [currency])

  const cfTable = useMemo(() => {
    const op = cashKpis.op
    const inv = cashKpis.inv
    const fin = cashKpis.fin
    return [
      { id: 'op', group: 'Operating cash flow', label: 'Operating cash flow', v: op, strong: true },
      { id: 'inv', group: 'Investing cash flow', label: 'Investing cash flow', v: inv, strong: true },
      { id: 'fin', group: 'Financing cash flow', label: 'Financing cash flow', v: fin, strong: true },
      { id: 'net', group: 'Net movement', label: 'Net cash movement', v: op + inv + fin, strong: true },
      { id: 'end', group: 'Cash', label: 'Ending cash', v: cashKpis.endCash, strong: true },
    ]
  }, [cashKpis])

  const cashVariance = useMemo(() => {
    // Blueprint-only decomposition: use mutually-exclusive WC + FX style drivers.
    // This is meant to read like a CFO explanation (AR, prepayments, timing, FX),
    // not a GAAP cash flow statement.

    // Start cash at the beginning of the selected period scope.
    const startCash =
      props.filters.view === 'ytd'
        ? (scope[0] ? scope[0].endingCash - scope[0].netCashMovement : current.endingCash - current.netCashMovement)
        : current.endingCash - current.netCashMovement

    // Define a light "plan end cash" proxy to anchor the bridge (plan is *not* modeled in the dataset).
    const planNet = sum(scope, (m) => {
      const scale = m.revenue ? clamp(m.revenuePlan / m.revenue, 0.75, 1.25) : 1
      const opPlan = Math.round(m.operatingCashFlow * (0.70 + 0.30 * scale))
      const invPlan = Math.round(m.investingCashFlow * 0.95)
      const finPlan = Math.round(m.financingCashFlow * 0.98)
      return opPlan + invPlan + finPlan
    })

    const planEndCash = startCash + planNet
    const endMonth = scope[scope.length - 1] ?? current
    const actualEndCash = props.filters.view === 'ytd' ? (endMonth.endingCash ?? current.endingCash) : current.endingCash

    const variance = actualEndCash - planEndCash

    // Working-capital style balance proxies at period-end.
    // (These intentionally match the BS page proxy logic.)
    const arActual = Math.round(endMonth.revenue * 0.45)
    const arPlan = Math.round(endMonth.revenuePlan * 0.45)
    const arImpact = -(arActual - arPlan) // higher AR consumes cash

    const apActual = Math.round(endMonth.opex * 0.55)
    const apPlan = Math.round(endMonth.opex * clamp(endMonth.revenuePlan / Math.max(1, endMonth.revenue), 0.85, 1.20) * 0.55)
    const apImpact = apActual - apPlan // higher AP preserves cash

    const prepayActual = Math.round(endMonth.contractBookValue * 0.09) // deferred revenue / customer prepayments
    const prepayPlan = Math.round(endMonth.contractBookValue * clamp(endMonth.revenuePlan / Math.max(1, endMonth.revenue), 0.90, 1.15) * 0.09)
    const prepayImpact = prepayActual - prepayPlan // higher prepayments increase cash

    // FX translation impact (illustrative): only meaningful for Consolidated or non-USD entities.
    const fxSeedKey = `${props.filters.entity}-${endMonth.periodEnd}-${props.filters.view}-fx`
    const r = mulberry32(hashStringToSeed(fxSeedKey))
    const fxEnabled = props.filters.entity === 'Consolidated' || currency !== 'USD'
    const fxPct = fxEnabled ? clamp(0.002 + r() * 0.010, 0, 0.015) : 0
    const fxSign = r() > 0.55 ? 1 : -1
    const fxImpact = Math.round(planEndCash * fxPct * fxSign)

    // Reconciliation bucket: timing, one-offs, classification differences.
    const timingOther = variance - (arImpact + apImpact + prepayImpact + fxImpact)

    return {
      startCash,
      planEndCash,
      actualEndCash,
      variance,
      drivers: { arImpact, apImpact, prepayImpact, fxImpact, timingOther },
    }
  }, [current.endingCash, current.netCashMovement, current, props.filters.view, scope])

  const commentary = useMemo(() => {
    const variance = cashVariance.variance
    const drivers = [
      { k: 'AR / collections', v: cashVariance.drivers.arImpact },
      { k: 'Payables & accruals', v: cashVariance.drivers.apImpact },
      { k: 'Customer prepayments', v: cashVariance.drivers.prepayImpact },
      { k: 'FX translation', v: cashVariance.drivers.fxImpact },
      { k: 'Timing / other', v: cashVariance.drivers.timingOther },
    ].sort((a, b) => Math.abs(b.v) - Math.abs(a.v))

    const why1 =
      drivers[0]?.k === 'AR / collections'
        ? 'collections timing vs plan (higher AR ties up cash)'
        : drivers[0]?.k === 'Customer prepayments'
          ? 'billing/renewal timing (more upfront cash receipts)'
          : drivers[0]?.k === 'Payables & accruals'
            ? 'supplier payment timing (stretch/release of payables)'
            : drivers[0]?.k === 'FX translation'
              ? 'translation effects on non‑USD cash balances'
              : 'timing/one‑offs not captured in the modeled drivers'

    const why2 =
      drivers[1]?.k === 'AR / collections'
        ? 'secondary impact from collections timing'
        : drivers[1]?.k === 'Customer prepayments'
          ? 'secondary impact from prepayment mix'
          : drivers[1]?.k === 'Payables & accruals'
            ? 'secondary impact from payables/accruals timing'
            : drivers[1]?.k === 'FX translation'
              ? 'secondary FX translation impact'
              : 'secondary residual timing bucket'

    return [
      <>
        Ending cash is <b>{formatMoney(cashKpis.endCash, { compact: true, currency })}</b> with runway <b>{cashKpis.runway} months</b>.
      </>,
      <>
        Ending cash is <b style={{ color: variance >= 0 ? 'var(--good)' : 'var(--bad)' }}>{variance >= 0 ? 'above' : 'below'}</b> plan by{' '}
        <b style={{ color: variance >= 0 ? 'var(--good)' : 'var(--bad)' }}>{formatMoney(variance, { compact: true, currency })}</b>.
      </>,
      <>
        Biggest drivers vs plan: <b>{drivers[0]?.k}</b> ({formatMoney(drivers[0]?.v ?? 0, { compact: true, currency })}) — {why1};{' '}
        <b>{drivers[1]?.k}</b> ({formatMoney(drivers[1]?.v ?? 0, { compact: true, currency })}) — {why2}.
      </>,
      <>
        Read the bridge as “profit → cash”: even with similar EBITDA, timing (AR/AP/prepayments) and FX can dominate month-to-month cash outcomes.
      </>,
    ]
  }, [cashKpis.endCash, cashKpis.runway, cashVariance, currency])

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div>
        <div className="h1">Cash Flow</div>
        <div className="subtle">
          Liquidity-first view with a cash bridge, trend context, and a clean operating/investing/financing table.
        </div>
      </div>

      <CommentaryCard bullets={commentary} />

      <div className="grid cols-12">
        <div className="col-span-3">
          <KpiTile label="Operating CF" value={formatMoney(cashKpis.op, { compact: true, currency })} deltaLabel="Quality" deltaValue={cashKpis.op >= 0 ? 'Positive' : 'Negative'} deltaTone={cashKpis.op >= 0 ? 'good' : 'bad'} />
        </div>
        <div className="col-span-3">
          <KpiTile label="Net cash movement" value={formatMoney(cashKpis.net, { compact: true, currency })} deltaLabel="as % revenue" deltaValue={formatPercent(safeDiv(cashKpis.net, Math.max(1, sum(scope, (m) => m.revenue))), 0)} deltaTone={cashKpis.net >= 0 ? 'good' : 'bad'} />
        </div>
        <div className="col-span-3">
          <KpiTile label="Ending cash" value={formatMoney(cashKpis.endCash, { compact: true, currency })} deltaLabel="Runway" deltaValue={`${cashKpis.runway} mo`} deltaTone={cashKpis.runway >= 10 ? 'good' : cashKpis.runway >= 6 ? 'neutral' : 'bad'} />
        </div>
        <div className="col-span-3">
          <KpiTile label="Burn (proxy)" value={formatMoney(cashKpis.burn, { compact: true, currency })} deltaLabel="Interpretation" deltaValue={cashKpis.burn <= 0 ? 'Profitable' : 'Investing for growth'} deltaTone={cashKpis.burn <= 0 ? 'good' : 'neutral'} />
        </div>

        <div className="col-span-6" style={{ display: 'grid', gap: 10 }}>
          <ChartCard title="Cash bridge" subtitle="Movement from starting to ending cash (illustrative)" height={300}>
            <WaterfallChart
              height={260}
              steps={bridge.steps}
              yTickFormatter={(v) => formatMoney(v, { compact: true, currency })}
              tooltipFormatter={(v) => formatMoney(v, { compact: true, currency })}
              labelFormatter={(v) => formatMoney(v, { compact: true, currency })}
            />
          </ChartCard>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            <Card padding="sm" style={{ background: 'var(--surface-2)' }}>
              <div className="subtle">Starting cash</div>
              <div style={{ fontWeight: 900 }}>{formatMoney(bridge.startCash, { compact: true, currency })}</div>
            </Card>
            <Card padding="sm" style={{ background: 'var(--surface-2)' }}>
              <div className="subtle">Ending cash</div>
              <div style={{ fontWeight: 900 }}>{formatMoney(bridge.endCash, { compact: true, currency })}</div>
            </Card>
          </div>
        </div>

        <div className="col-span-6">
          <ChartCard title="Monthly cash movement" subtitle="Net movement bars with ending cash line" height={300}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trend} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={COLORS.grid} vertical={false} />
                <XAxis dataKey="period" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => formatMoney(v, { compact: true, currency })} />
                <Tooltip
                  formatter={(v: any, name: any) => [formatMoney(v, { compact: true, currency }), name]}
                  contentStyle={{
                    background: 'rgba(255,255,255,0.95)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    boxShadow: 'var(--shadow-md)',
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: 'var(--muted)' }} />
                <Bar dataKey="Net movement" fill="rgba(15,23,42,0.18)" radius={[10, 10, 0, 0]}>
                  <LabelList content={netMovementLabel} />
                </Bar>
                <Line type="monotone" dataKey="Ending cash" stroke="rgba(37,99,235,0.95)" strokeWidth={2.5} dot={false}>
                  <LabelList content={moneyPoint} />
                </Line>
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <div className="col-span-12" style={{ display: 'grid', gap: 10 }}>
          <ChartCard
            title="Cash vs plan — variance decomposition"
            subtitle="Mutually exclusive drivers (AR, prepayments, payables, FX, timing) explaining why ending cash differs from plan"
            height={260}
          >
            <WaterfallChart
              height={240}
              steps={[
                { id: 'plan', label: 'Plan ending cash', total: cashVariance.planEndCash },
                { id: 'ar', label: 'AR / collections', delta: cashVariance.drivers.arImpact },
                { id: 'ap', label: 'Payables & accruals', delta: cashVariance.drivers.apImpact },
                { id: 'prepay', label: 'Customer prepayments', delta: cashVariance.drivers.prepayImpact },
                { id: 'fx', label: 'FX translation', delta: cashVariance.drivers.fxImpact },
                { id: 'timing', label: 'Timing / other', delta: cashVariance.drivers.timingOther },
                { id: 'act', label: 'Actual ending cash', total: cashVariance.actualEndCash },
              ]}
              yTickFormatter={(v) => formatMoney(v, { compact: true, currency })}
              tooltipFormatter={(v) => formatMoney(v, { compact: true, currency })}
              deltaLabelFormatter={(v) => deltaMoney(v)}
              totalLabelFormatter={(v) => formatMoney(v, { compact: true, currency })}
            />
          </ChartCard>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
            <Card padding="sm" style={{ background: 'var(--surface-2)' }}>
              <div className="subtle">Plan ending cash</div>
              <div style={{ fontWeight: 900 }}>{formatMoney(cashVariance.planEndCash, { compact: true, currency })}</div>
            </Card>
            <Card padding="sm" style={{ background: 'var(--surface-2)' }}>
              <div className="subtle">Actual ending cash</div>
              <div style={{ fontWeight: 900 }}>{formatMoney(cashVariance.actualEndCash, { compact: true, currency })}</div>
            </Card>
            <Card padding="sm" style={{ background: 'var(--surface-2)' }}>
              <div className="subtle">Variance</div>
              <div style={{ fontWeight: 900, color: cashVariance.variance >= 0 ? 'var(--good)' : 'var(--bad)' }}>
                {formatMoney(cashVariance.variance, { compact: true, currency })}
              </div>
            </Card>
            <Card padding="sm" style={{ background: 'var(--surface-2)' }}>
              <div className="subtle">Scope</div>
              <div style={{ fontWeight: 900 }}>{props.filters.view === 'ytd' ? 'YTD' : 'Month'}</div>
            </Card>
          </div>
        </div>

        <div className="col-span-12">
          <Card title="Cash flow detail" subtitle="Operating / Investing / Financing breakdown" padding="md">
            <DataTable
              rows={cfTable}
              columns={[
                {
                  key: 'line',
                  header: 'Line item',
                  render: (r) => (
                    <div style={{ display: 'grid', gap: 2 }}>
                      <div className="subtle">{r.group}</div>
                      <div style={{ fontWeight: r.strong ? 850 : 700 }}>{r.label}</div>
                    </div>
                  ),
                },
                {
                  key: 'value',
                  header: 'Value',
                  align: 'right',
                  render: (r) => (
                    <span style={{ fontWeight: 900, color: r.v >= 0 ? 'var(--good)' : 'var(--bad)' }}>
                      {formatMoney(r.v, { compact: true, currency })}
                    </span>
                  ),
                },
              ]}
            />
          </Card>
        </div>
      </div>
    </div>
  )
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

