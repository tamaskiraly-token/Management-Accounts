import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { DashboardFilters, MockModel, Product } from '../data/types'
import { ChartCard } from '../ui/charts/ChartCard'
import { MiniTrend } from '../ui/charts/MiniTrend'
import { WaterfallChart } from '../ui/charts/WaterfallChart'
import { makeBarValueLabel, makeValueLabel } from '../ui/charts/ValueLabel'
import { Segmented } from '../ui/controls/Segmented'
import { Select } from '../ui/controls/Select'
import { Card } from '../ui/layout/Card'
import { CommentaryCard } from '../ui/insights/CommentaryCard'
import { KpiTile } from '../ui/metrics/KpiTile'
import { DataTable } from '../ui/tables/DataTable'
import { formatDeltaPct, formatMoney, formatNumber, formatPercent, safeDiv } from '../utils/format'
import { hashStringToSeed, mulberry32 } from '../utils/rng'

function useSeries(model: MockModel, filters: DashboardFilters) {
  const entity = model.get(filters.entity)
  const idx = Math.max(0, entity.months.findIndex((m) => m.periodEnd === filters.periodEnd))
  const window = entity.months.slice(Math.max(0, idx - 11), idx + 1)
  const current = entity.months[idx] ?? entity.months[entity.months.length - 1]!
  return { current, window, all: entity.months, idx }
}

function cmpDelta(filters: DashboardFilters, current: number, plan: number, prevMonth: number, prevYear: number) {
  if (filters.comparison === 'yoy') return safeDiv(current - prevYear, prevYear)
  if (filters.comparison === 'mom') return safeDiv(current - prevMonth, prevMonth)
  return safeDiv(current - plan, plan)
}

function toneFromDelta(d: number, invert = false) {
  const v = invert ? -d : d
  if (v > 0.02) return 'good'
  if (v < -0.02) return 'bad'
  return 'neutral'
}

function productSplit(seedKey: string, products: Product[], base: Record<Product, number>) {
  const r = mulberry32(hashStringToSeed(seedKey))
  const weights = products.map((p) => Math.max(0.08, base[p] * (1 + (r() - 0.5) * 0.18)))
  const sum = weights.reduce((a, b) => a + b, 0)
  const out: Record<Product, number> = {} as any
  products.forEach((p, i) => (out[p] = weights[i]! / sum))
  return out
}

const COLORS: Record<string, string> = {
  brand: '#2563eb',
  teal: '#14b8a6',
  cyan: '#06b6d4',
  violet: '#4f46e5',
  muted: 'rgba(100,116,139,0.75)',
  grid: 'rgba(15,23,42,0.06)',
}

function kpiTrend(window: { periodLabel: string; v: number }[]) {
  return window.map((w) => ({ x: w.periodLabel.slice(0, 3), y: w.v }))
}

export function KpisPage(props: {
  model: MockModel
  filters: DashboardFilters
  onChangeFilters: (next: (prev: DashboardFilters) => DashboardFilters) => void
}) {
  const entityModel = props.model.get(props.filters.entity)
  const currency = entityModel.currency
  const { current, window } = useSeries(props.model, props.filters)
  const [volumeMode, setVolumeMode] = useState<'total' | 'incremental'>('total')
  const valueLabel = useMemo(() => makeValueLabel({ kind: 'number', tone: 'muted' }), [])
  const barValueLabel = useMemo(() => makeBarValueLabel({ kind: 'number', tone: 'muted' }), [])
  const moneyBarLabel = useMemo(() => makeBarValueLabel({ kind: 'money', tone: 'muted', currency }), [currency])

  const productBase: Record<Product, number> = { PIS: 0.42, AIS: 0.18, VRP: 0.26, VAs: 0.14 }
  const seriesByProduct = useMemo(() => {
    return window.map((m) => {
      const split = productSplit(`${props.filters.entity}-${m.periodEnd}-${props.filters.product}`, props.model.products, productBase)
      const row: any = { period: m.periodLabel.slice(0, 3), total: m.txnCount }
      props.model.products.forEach((p) => (row[p] = Math.round(m.txnCount * split[p])))
      row.txnValue = m.txnValue
      return row
    })
  }, [props.filters.entity, props.filters.product, props.model.products, window])

  const revenueDelta = cmpDelta(
    props.filters,
    current.revenue,
    current.revenuePlan,
    window[window.length - 2]?.revenue ?? current.revenue,
    props.model.months.find((m) => m.periodEnd === current.periodEnd)?.revenue ?? current.revenue,
  )

  const txnDelta = cmpDelta(
    props.filters,
    current.txnCount,
    current.txnCountPlan,
    current.txnCountPrevMonth,
    current.txnCountPrevYear,
  )

  const clientsDelta = cmpDelta(
    props.filters,
    current.activeClients,
    current.activeClientsPlan,
    window[window.length - 2]?.activeClients ?? current.activeClients,
    Math.round(current.activeClients / 1.12),
  )

  const burn = -(current.revenue - current.cogs - current.opex)
  const runwayMonths = Math.max(1, Math.round(current.endingCash / Math.max(1, burn)))

  const concentration = useMemo(() => {
    const r = mulberry32(hashStringToSeed(`${props.filters.entity}-${current.periodEnd}-clients`))
    const rows = Array.from({ length: 12 }, (_, i) => {
      const share = Math.max(0.006, (0.12 / (i + 1)) * (1 + (r() - 0.5) * 0.25))
      const rev = Math.round(current.revenue * share)
      return {
        id: `c${i}`,
        name: `Client ${String.fromCharCode(65 + i)}${i % 3 === 0 ? ' (Enterprise)' : ''}`,
        revenue: rev,
        share,
        risk: r() < 0.18 ? 'High risk' : r() < 0.25 ? 'Gambling' : 'Standard',
      }
    })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)

    const top5 = rows.slice(0, 5).reduce((a, b) => a + b.share, 0)
    const top10 = rows.slice(0, 10).reduce((a, b) => a + b.share, 0)
    return { rows, top5, top10 }
  }, [current.periodEnd, current.revenue, props.filters.entity])

  const arrBridge = useMemo(() => {
    const startArr = Math.round(current.contractBookValue * 0.42)
    const newArr = Math.round(current.newAcvBookings * 10.5)
    const expansion = Math.round(current.netRevenueExpansion * 9.2)
    const churn = -Math.round(current.churnedAcv * 11.2)
    const renewals = Math.round(current.renewalsAcv * 6.8)
    const endArr = startArr + newArr + expansion + churn + renewals
    return {
      startArr,
      endArr,
      steps: [
        { name: 'Starting ARR', value: startArr, type: 'total' as const },
        { name: 'New', value: newArr, type: 'pos' as const },
        { name: 'Expansion', value: expansion, type: 'pos' as const },
        { name: 'Churn', value: churn, type: 'neg' as const },
        { name: 'Renewals', value: renewals, type: 'pos' as const },
        { name: 'Ending ARR', value: endArr, type: 'total' as const },
      ],
    }
  }, [current])

  const unitEconomics = useMemo(() => {
    const revPerTxn = safeDiv(current.revenue, current.txnCount)
    const cogsPerTxn = safeDiv(current.cogs, current.txnCount)
    const opResultPerTxn = safeDiv(current.revenue - current.cogs - current.opex, current.txnCount)
    const avgRevPerClient = safeDiv(current.revenue, current.activeClients)
    return {
      revPerTxn,
      cogsPerTxn,
      opResultPerTxn,
      avgRevPerClient,
    }
  }, [current])

  const commentary = useMemo(() => {
    const volumeVsPlan = safeDiv(current.txnCount - current.txnCountPlan, Math.max(1, current.txnCountPlan))
    const revVsPlan = safeDiv(current.revenue - current.revenuePlan, Math.max(1, current.revenuePlan))
    const clientsVsPlan = safeDiv(current.activeClients - current.activeClientsPlan, Math.max(1, current.activeClientsPlan))
    const opResult = current.revenue - current.cogs - current.opex
    const takeRateImpliedVsPlan = safeDiv(
      safeDiv(current.revenue, Math.max(1, current.txnValue)) -
        safeDiv(current.revenuePlan, Math.max(1, current.txnValuePlan)),
      Math.max(1e-9, safeDiv(current.revenuePlan, Math.max(1, current.txnValuePlan))),
    )

    const revDriver =
      volumeVsPlan >= 0 && revVsPlan < 0
        ? 'revenue is lagging volumes (mix / take‑rate down)'
        : volumeVsPlan < 0 && revVsPlan >= 0
          ? 'revenue is holding up despite volume (take‑rate / mix up)'
          : revVsPlan >= 0
            ? 'growth is broad‑based across volume and yield'
            : 'softness is broad‑based across volume and yield'

    const cashDriver =
      runwayMonths <= 6
        ? 'runway tightened due to operating losses and working-capital timing'
        : runwayMonths <= 10
          ? 'runway stable; monitor spend phasing and collections'
          : 'runway comfortable; focus on sustaining unit economics and retention'

    const bullets = [
      <>
        Transaction volume is <b style={{ color: volumeVsPlan >= 0 ? 'var(--good)' : 'var(--bad)' }}>
          {volumeVsPlan >= 0 ? 'above' : 'below'}
        </b>{' '}
        plan ({formatDeltaPct(volumeVsPlan)}), with product mix shifts visible in the stacked area chart.
      </>,
      <>
        Revenue is <b style={{ color: revVsPlan >= 0 ? 'var(--good)' : 'var(--bad)' }}>
          {revVsPlan >= 0 ? 'ahead of' : 'behind'}
        </b>{' '}
        plan ({formatDeltaPct(revVsPlan)}); <b>{revDriver}</b>. Take rate is <b>{current.takeRateBps.toFixed(1)} bps</b>{' '}
        (implied vs plan {takeRateImpliedVsPlan >= 0 ? 'up' : 'down'} {formatDeltaPct(takeRateImpliedVsPlan, 0)}).
      </>,
      <>
        Active clients are {clientsVsPlan >= 0 ? 'above' : 'below'} plan ({formatDeltaPct(clientsVsPlan)}); new{' '}
        <b>{current.newClients}</b> / churn <b>{current.churnedClients}</b>. Net adds suggest{' '}
        {current.newClients - current.churnedClients >= 0 ? 'pipeline conversion is keeping pace' : 'churn is outpacing onboarding'}.
      </>,
      <>
        NRR at <b>{formatPercent(current.nrr, 0)}</b>; movement is driven by{' '}
        {current.nrr >= 1.05 ? 'expansion (seat/volume growth) outweighing churn' : current.nrr >= 0.98 ? 'stable renewals with limited expansion' : 'churn / contraction in key cohorts'}.
      </>,
      <>
        Cash runway at <b>{runwayMonths} months</b> (ending cash {formatMoney(current.endingCash, { compact: true, currency })});
        operating result {formatMoney(opResult, { compact: true, currency })} — <b>{cashDriver}</b>.
      </>,
    ]

    return bullets
  }, [currency, current, runwayMonths])

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14 }}>
        <div>
          <div className="h1">Business Performance KPIs</div>
          <div className="subtle">
            Executive summary with drill-through blocks for volume, clients, ARR/revenue, retention and unit economics.
          </div>
        </div>
        <Card padding="sm" style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <Select
            label="Product"
            value={props.filters.product}
            options={[
              { value: 'All', label: 'All' },
              { value: 'PIS', label: 'PIS' },
              { value: 'AIS', label: 'AIS' },
              { value: 'VRP', label: 'VRP' },
              { value: 'VAs', label: 'VAs' },
            ]}
            onChange={(v) => props.onChangeFilters((s) => ({ ...s, product: v as DashboardFilters['product'] }))}
          />
          <Select
            label="Client segment"
            value={props.filters.clientSegment}
            options={[
              { value: 'All', label: 'All' },
              { value: 'Enterprise', label: 'Enterprise' },
              { value: 'Mid-market', label: 'Mid-market' },
              { value: 'SMB', label: 'SMB' },
            ]}
            onChange={(v) =>
              props.onChangeFilters((s) => ({ ...s, clientSegment: v as DashboardFilters['clientSegment'] }))
            }
          />
          <Segmented
            ariaLabel="Risk view"
            value={props.filters.riskView}
            options={[
              { value: 'All', label: 'All' },
              { value: 'High risk', label: 'High risk' },
              { value: 'Gambling', label: 'Gambling' },
            ]}
            onChange={(v) =>
              props.onChangeFilters((s) => ({ ...s, riskView: v as DashboardFilters['riskView'] }))
            }
          />
        </Card>
      </div>

      <CommentaryCard bullets={commentary} />

      <div className="grid cols-12">
        <div className="col-span-3">
          <KpiTile
            label="Transaction volume (MTD)"
            value={formatNumber(current.txnCount)}
            deltaLabel={props.filters.comparison === 'vsPlan' ? 'vs plan' : props.filters.comparison.toUpperCase()}
            deltaValue={formatDeltaPct(txnDelta)}
            deltaTone={toneFromDelta(txnDelta)}
            right={<MiniTrend data={kpiTrend(window.map((m) => ({ periodLabel: m.periodLabel, v: m.txnCount })))} />}
            footnote={`$ processed: ${formatMoney(current.txnValue, { compact: true, currency })}`}
          />
        </div>
        <div className="col-span-3">
          <KpiTile
            label="Revenue"
            value={formatMoney(current.revenue, { compact: true, currency })}
            deltaLabel={props.filters.comparison === 'vsPlan' ? 'vs plan' : props.filters.comparison.toUpperCase()}
            deltaValue={formatDeltaPct(revenueDelta)}
            deltaTone={toneFromDelta(revenueDelta)}
            right={
              <MiniTrend
                data={kpiTrend(window.map((m) => ({ periodLabel: m.periodLabel, v: m.revenue })))}
                tone="brand"
              />
            }
            footnote={`Take rate: ${current.takeRateBps.toFixed(1)} bps`}
          />
        </div>
        <div className="col-span-3">
          <KpiTile
            label="Active clients"
            value={formatNumber(current.activeClients)}
            deltaLabel={props.filters.comparison === 'vsPlan' ? 'vs plan' : props.filters.comparison.toUpperCase()}
            deltaValue={formatDeltaPct(clientsDelta)}
            deltaTone={toneFromDelta(clientsDelta)}
            right={
              <MiniTrend
                data={kpiTrend(window.map((m) => ({ periodLabel: m.periodLabel, v: m.activeClients })))}
                tone="muted"
              />
            }
            footnote={`New: ${current.newClients} • Churned: ${current.churnedClients}`}
          />
        </div>
        <div className="col-span-3">
          <KpiTile
            label="Cash & burn"
            value={formatMoney(current.endingCash, { compact: true, currency })}
            deltaLabel="Runway"
            deltaValue={`${runwayMonths} mo`}
            deltaTone={toneFromDelta(safeDiv(-burn, Math.max(1, current.revenue)), true)}
            right={
              <MiniTrend
                data={kpiTrend(window.map((m) => ({ periodLabel: m.periodLabel, v: m.endingCash })))}
                tone={burn > 0 ? 'bad' : 'good'}
              />
            }
            footnote={`Monthly burn: ${formatMoney(burn, { compact: true, currency })}`}
          />
        </div>

        <div className="col-span-7">
          <ChartCard
            title="Transaction volume by product"
            subtitle="Stacked view to show mix shift across PIS/AIS/VRP/VAs"
            height={300}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={seriesByProduct} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gPIS" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS.brand} stopOpacity={0.24} />
                    <stop offset="100%" stopColor={COLORS.brand} stopOpacity={0.04} />
                  </linearGradient>
                  <linearGradient id="gAIS" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS.cyan} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={COLORS.cyan} stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="gVRP" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS.teal} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={COLORS.teal} stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="gVAs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS.violet} stopOpacity={0.20} />
                    <stop offset="100%" stopColor={COLORS.violet} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={COLORS.grid} vertical={false} />
                <XAxis dataKey="period" tickLine={false} axisLine={false} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${Math.round(v / 1_000_000)}M`}
                />
                <Tooltip
                  formatter={(v: any, name: any) => [formatNumber(v), name]}
                  contentStyle={{
                    background: 'rgba(255,255,255,0.95)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    boxShadow: 'var(--shadow-md)',
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: 'var(--muted)' }} />
                <Area type="monotone" dataKey="PIS" stackId="1" stroke={COLORS.brand} fill="url(#gPIS)" dot={false}>
                  <LabelList content={valueLabel} />
                </Area>
                <Area type="monotone" dataKey="AIS" stackId="1" stroke={COLORS.cyan} fill="url(#gAIS)" dot={false}>
                  <LabelList content={valueLabel} />
                </Area>
                <Area type="monotone" dataKey="VRP" stackId="1" stroke={COLORS.teal} fill="url(#gVRP)" dot={false}>
                  <LabelList content={valueLabel} />
                </Area>
                <Area type="monotone" dataKey="VAs" stackId="1" stroke={COLORS.violet} fill="url(#gVAs)" dot={false}>
                  <LabelList content={valueLabel} />
                </Area>
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <div className="col-span-5">
          <ChartCard
            title="Client health (payments)"
            subtitle="Transacting, above minimums, and idle"
            height={300}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={window.map((m) => ({
                period: m.periodLabel.slice(0, 3),
                Transacting: m.paymentsClientsTransacting,
                'Above mins': m.paymentsClientsAboveMins,
                Idle: m.paymentsClientsIdle,
              }))} margin={{ top: 8, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={COLORS.grid} vertical={false} />
                <XAxis dataKey="period" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(255,255,255,0.95)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    boxShadow: 'var(--shadow-md)',
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: 'var(--muted)' }} />
                <Bar dataKey="Transacting" stackId="a" fill="rgba(37,99,235,0.45)" radius={[8, 8, 0, 0]}>
                  <LabelList content={barValueLabel} />
                </Bar>
                <Bar dataKey="Above mins" stackId="a" fill="rgba(20,184,166,0.40)">
                  <LabelList content={barValueLabel} />
                </Bar>
                <Bar dataKey="Idle" stackId="a" fill="rgba(100,116,139,0.25)">
                  <LabelList content={barValueLabel} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <div className="col-span-12">
          <ChartCard
            title="Volume (actual vs plan)"
            subtitle={
              volumeMode === 'total'
                ? 'Total transaction volume vs plan'
                : 'Incremental transaction volume vs plan'
            }
            right={
              <Segmented
                ariaLabel="Total or incremental volume"
                value={volumeMode}
                options={[
                  { value: 'total', label: 'Total' },
                  { value: 'incremental', label: 'Incremental' },
                ]}
                onChange={(v) => setVolumeMode(v as 'total' | 'incremental')}
              />
            }
            height={220}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={window.map((m) => ({
                  period: m.periodLabel.slice(0, 3),
                  Actual: volumeMode === 'total' ? m.txnCount : m.incrementalTxnCount,
                  Plan: volumeMode === 'total' ? m.txnCountPlan : m.incrementalTxnCountPlan,
                }))}
                margin={{ top: 8, right: 10, bottom: 0, left: 0 }}
              >
                <CartesianGrid stroke={COLORS.grid} vertical={false} />
                <XAxis dataKey="period" tickLine={false} axisLine={false} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => {
                    if (volumeMode === 'total') return `${Math.round(v / 1_000_000)}M`
                    return `${Math.round(v / 1000)}k`
                  }}
                />
                <Tooltip
                  formatter={(v: any, name: any) => [formatNumber(v), name]}
                  contentStyle={{
                    background: 'rgba(255,255,255,0.95)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    boxShadow: 'var(--shadow-md)',
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: 'var(--muted)' }} />
                <Line type="monotone" dataKey="Actual" stroke={COLORS.brand} strokeWidth={2} dot={false}>
                  <LabelList content={valueLabel} />
                </Line>
                <Line
                  type="monotone"
                  dataKey="Plan"
                  stroke={COLORS.teal}
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="4 4"
                >
                  <LabelList content={valueLabel} />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <div className="col-span-6">
          <ChartCard
            title="ARR / revenue bridge (illustrative)"
            subtitle="Investor-friendly movement view; replace with your exact logic later"
            height={280}
          >
            <WaterfallChart
              height={176}
              steps={[
                { id: 'start', label: 'Starting ARR', total: arrBridge.startArr },
                { id: 'new', label: 'New', delta: arrBridge.steps[1]!.value },
                { id: 'exp', label: 'Expansion', delta: arrBridge.steps[2]!.value },
                { id: 'churn', label: 'Churn', delta: arrBridge.steps[3]!.value },
                { id: 'ren', label: 'Renewals', delta: arrBridge.steps[4]!.value },
                { id: 'end', label: 'Ending ARR', total: arrBridge.endArr },
              ]}
              yTickFormatter={(v) => `${formatMoney(v, { compact: true, currency })}`}
              tooltipFormatter={(v) => formatMoney(v, { compact: true, currency })}
            />
            <div
              style={{
                marginTop: 8,
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: 10,
              }}
            >
              <Card padding="sm" style={{ background: 'var(--surface-2)' }}>
                <div className="subtle">Starting ARR</div>
                <div style={{ fontWeight: 800 }}>{formatMoney(arrBridge.startArr, { compact: true, currency })}</div>
              </Card>
              <Card padding="sm" style={{ background: 'var(--surface-2)' }}>
                <div className="subtle">NRR</div>
                <div style={{ fontWeight: 800 }}>{formatPercent(current.nrr, 0)}</div>
              </Card>
              <Card padding="sm" style={{ background: 'var(--surface-2)' }}>
                <div className="subtle">Ending ARR</div>
                <div style={{ fontWeight: 800 }}>{formatMoney(arrBridge.endArr, { compact: true, currency })}</div>
              </Card>
            </div>
          </ChartCard>
        </div>

        <div className="col-span-6">
          <ChartCard title="Revenue vs plan (last 12 months)" subtitle="Smooth plan line with actual bars" height={280}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={window.map((m) => ({
                  period: m.periodLabel.slice(0, 3),
                  Actual: m.revenue,
                  Plan: m.revenuePlan,
                }))}
                margin={{ top: 10, right: 10, bottom: 0, left: 0 }}
              >
                <CartesianGrid stroke={COLORS.grid} vertical={false} />
                <XAxis dataKey="period" tickLine={false} axisLine={false} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatMoney(v, { compact: true, currency })}
                />
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
                <Bar dataKey="Actual" fill="rgba(37,99,235,0.42)" radius={[10, 10, 0, 0]}>
                  <LabelList content={moneyBarLabel} />
                </Bar>
                <Line
                  type="monotone"
                  dataKey="Plan"
                  stroke="rgba(20,184,166,0.95)"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <div className="col-span-5">
          <ChartCard
            title="Client concentration"
            subtitle={`Top 5: ${formatPercent(concentration.top5, 0)} • Top 10: ${formatPercent(concentration.top10, 0)}`}
            height={300}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={concentration.rows.map((r) => ({ name: r.name, revenue: r.revenue }))}
                layout="vertical"
                margin={{ top: 10, right: 10, bottom: 0, left: 70 }}
              >
                <CartesianGrid stroke={COLORS.grid} horizontal={false} />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatMoney(v, { compact: true, currency })}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  width={120}
                  tick={{ fontSize: 12, fill: 'rgba(100,116,139,0.95)' }}
                />
                <Tooltip
                  formatter={(v: any) => [formatMoney(v, { compact: true, currency }), 'Revenue']}
                  contentStyle={{
                    background: 'rgba(255,255,255,0.95)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    boxShadow: 'var(--shadow-md)',
                  }}
                />
                <Bar dataKey="revenue" fill="rgba(79,70,229,0.45)" radius={[0, 10, 10, 0]}>
                  <LabelList content={moneyBarLabel} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <div className="col-span-7">
          <Card
            title="Detail highlights"
            subtitle="A few high-signal tables (kept intentionally lightweight for readability)"
            padding="md"
          >
            <div className="grid cols-12" style={{ gap: 12 }}>
              <div className="col-span-6">
                <div className="h2" style={{ marginBottom: 8 }}>
                  Top clients (revenue)
                </div>
                <DataTable
                  dense
                  columns={[
                    { key: 'name', header: 'Client', render: (r) => <span style={{ fontWeight: 700 }}>{r.name}</span> },
                    {
                      key: 'rev',
                      header: 'Revenue',
                      align: 'right',
                      render: (r) => formatMoney(r.revenue, { compact: true, currency }),
                    },
                    { key: 'share', header: 'Share', align: 'right', render: (r) => formatPercent(r.share, 1) },
                    {
                      key: 'risk',
                      header: 'Risk',
                      render: (r) => (
                        <span
                          style={{
                            fontWeight: 750,
                            color:
                              r.risk === 'Standard'
                                ? 'var(--muted)'
                                : r.risk === 'Gambling'
                                  ? 'var(--warn)'
                                  : 'var(--bad)',
                          }}
                        >
                          {r.risk}
                        </span>
                      ),
                    },
                  ]}
                  rows={concentration.rows.map((r) => ({ ...r, id: r.id }))}
                />
              </div>

              <div className="col-span-6">
                <div className="h2" style={{ marginBottom: 8 }}>
                  Unit economics snapshot
                </div>
                <DataTable
                  dense
                  columns={[
                    { key: 'metric', header: 'Metric', render: (r) => <span style={{ fontWeight: 700 }}>{r.metric}</span> },
                    { key: 'value', header: 'Value', align: 'right', render: (r) => r.value },
                  ]}
                  rows={[
                    { id: 'tr', metric: 'Take rate', value: `${current.takeRateBps.toFixed(1)} bps` },
                    {
                      id: 'rpt',
                      metric: 'Revenue per transaction',
                      value: formatMoney(unitEconomics.revPerTxn, { currency, maximumFractionDigits: 4 }),
                    },
                    { id: 'cpt', metric: 'COS per transaction', value: formatMoney(unitEconomics.cogsPerTxn, { currency, maximumFractionDigits: 4 }) },
                    {
                      id: 'oppt',
                      metric: 'Operating result per transaction',
                      value: formatMoney(unitEconomics.opResultPerTxn, { currency, maximumFractionDigits: 4 }),
                    },
                    {
                      id: 'arpc',
                      metric: 'Avg revenue per active client',
                      value: formatMoney(unitEconomics.avgRevPerClient, { compact: true, currency }),
                    },
                    {
                      id: 'risk',
                      metric: 'High-risk revenue exposure',
                      value: formatPercent(current.highRiskRevenueShare, 1),
                    },
                  ]}
                />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

