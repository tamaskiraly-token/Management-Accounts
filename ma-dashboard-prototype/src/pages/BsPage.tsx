import { useMemo } from 'react'
import {
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
import type { DashboardFilters, MockModel } from '../data/types'
import { ChartCard } from '../ui/charts/ChartCard'
import { makeValueLabel } from '../ui/charts/ValueLabel'
import { Card } from '../ui/layout/Card'
import { CommentaryCard } from '../ui/insights/CommentaryCard'
import { KpiTile } from '../ui/metrics/KpiTile'
import { DataTable } from '../ui/tables/DataTable'
import { formatDeltaPct, formatMoney, safeDiv } from '../utils/format'
import { hashStringToSeed, mulberry32 } from '../utils/rng'

const COLORS = {
  cash: 'rgba(37,99,235,0.45)',
  current: 'rgba(20,184,166,0.35)',
  nonCurrent: 'rgba(79,70,229,0.25)',
  liab: 'rgba(239,68,68,0.20)',
  eq: 'rgba(15,23,42,0.12)',
  grid: 'rgba(15,23,42,0.06)',
}

function deriveBsSnapshot(m: {
  endingCash: number
  revenue: number
  cogs: number
  opex: number
  contractBookValue: number
}) {
  // Proxy BS lines aligned to screenshot shape (for blueprint only).
  const operatingResult = m.revenue - m.cogs - m.opex

  // Assets
  const cash = m.endingCash
  const accountsReceivable = Math.max(850_000, Math.round(m.revenue * 0.45))
  const accruedRevenue = Math.max(0, Math.round(m.revenue * 0.005))
  const prepayments = Math.max(0, Math.round(m.opex * 0.14))
  const fixedAssets = Math.round(4_600_000 + m.contractBookValue * 0.012)
  const otherAssets = Math.round(9_500_000 + Math.max(0, operatingResult) * 0.25)
  const totalAssets = cash + accountsReceivable + accruedRevenue + prepayments + fixedAssets + otherAssets

  // Liabilities
  const accountsPayable = Math.round(m.opex * 0.55)
  const deferredRevenue = Math.round(m.contractBookValue * 0.09)
  const accruedExpenses = Math.round(m.opex * 0.12)
  const vat = Math.round(m.revenue * 0.06) // liability / (asset) proxy
  const deferredTax = Math.round(Math.max(0, operatingResult) * 0.03)
  const debtFunding = Math.round(10_800_000) // proxy debt funding line
  const otherLiabilities = Math.round(m.opex * 0.03)
  const totalLiabilities =
    accountsPayable + deferredRevenue + accruedExpenses + vat + deferredTax + debtFunding + otherLiabilities

  // Equity
  const shareCapitalPremium = Math.round(95_000_000)
  const retainedEarnings = Math.round(-(shareCapitalPremium - (totalAssets - totalLiabilities)))
  const cta = Math.round(420_000) // cumulative translation adjustment proxy
  const totalEquity = totalAssets - totalLiabilities

  const workingCapital =
    accountsReceivable + accruedRevenue + prepayments - accountsPayable - deferredRevenue - accruedExpenses

  return {
    cash,
    accountsReceivable,
    accruedRevenue,
    prepayments,
    fixedAssets,
    otherAssets,
    totalAssets,

    accountsPayable,
    deferredRevenue,
    accruedExpenses,
    vat,
    deferredTax,
    debtFunding,
    otherLiabilities,
    totalLiabilities,

    shareCapitalPremium,
    retainedEarnings,
    cta,
    totalEquity,

    workingCapital,
  }
}

export function BsPage(props: { model: MockModel; filters: DashboardFilters }) {
  const entity = props.model.get(props.filters.entity)
  const currency = entity.currency
  const moneyPoint = useMemo(() => makeValueLabel({ kind: 'money', currency, tone: 'muted' }), [currency])
  const numberPoint = useMemo(() => makeValueLabel({ kind: 'number', tone: 'muted' }), [])
  const idx = Math.max(0, entity.months.findIndex((m) => m.periodEnd === props.filters.periodEnd))
  const current = entity.months[idx] ?? entity.months[entity.months.length - 1]!
  const window = entity.months.slice(Math.max(0, idx - 11), idx + 1)

  const actual = useMemo(() => deriveBsSnapshot(current), [current])
  const plan = useMemo(() => {
    // Deterministic plan jitters for the period (blueprint only).
    const r = mulberry32(hashStringToSeed(`${props.filters.entity}-${current.periodEnd}-bs-plan`))
    const jitter = (base: number, pct: number) => Math.round(base * (1 + (r() * 2 - 1) * pct))
    const m = deriveBsSnapshot({
      ...current,
      endingCash: jitter(current.endingCash, 0.06),
      revenue: jitter(current.revenuePlan, 0.03), // plan anchored
      cogs: jitter(current.cogs, 0.04),
      opex: jitter(current.opex, 0.04),
      contractBookValue: jitter(current.contractBookValue, 0.03),
    })
    return m
  }, [current, props.filters.entity])

  const movement = useMemo(() => {
    return window.map((m) => {
      const d = deriveBsSnapshot(m)
      return {
        period: m.periodLabel.slice(0, 3),
        Cash: d.cash,
        'Net assets': d.totalEquity,
        'Working capital': d.workingCapital,
        'Accounts receivable': d.accountsReceivable,
        Prepayments: d.prepayments,
        'Accounts payable': -d.accountsPayable,
        'Deferred revenue': -d.deferredRevenue,
        'Accrued expenses': -d.accruedExpenses,
      }
    })
  }, [window])

  const cccTrend = useMemo(() => {
    // CCC proxy (no inventory): DSO + 0 − DPO
    return window.map((m) => {
      const d = deriveBsSnapshot(m)
      const days = 30
      const dailyRevenue = Math.max(1, m.revenue / days)
      const dailySpend = Math.max(1, (m.cogs + m.opex) / days)
      const dso = d.accountsReceivable / dailyRevenue
      const dpo = d.accountsPayable / dailySpend
      const ccc = dso - dpo
      return {
        period: m.periodLabel.slice(0, 3),
        'AR turnover (DSO)': Math.round(dso),
        'ACT turnover (DPO)': Math.round(dpo),
        'Cash conversion cycle': Math.round(ccc),
      }
    })
  }, [window])

  const workingCapitalTrend = useMemo(() => {
    return movement.map((m) => ({
      period: m.period,
      'Working capital': m['Working capital'],
      'Accounts receivable': m['Accounts receivable'],
      Prepayments: m.Prepayments,
      'Accounts payable': m['Accounts payable'],
      'Deferred revenue': m['Deferred revenue'],
      'Accrued expenses': m['Accrued expenses'],
    }))
  }, [movement])

  const bsTable = useMemo(() => {
    type Row = {
      id: string
      section: 'Assets' | 'Liabilities' | 'Equity'
      label: string
      actual: number
      plan: number
      strong?: boolean
    }

    const rows: Row[] = [
      { id: 'a_cash', section: 'Assets', label: 'Cash and cash equivalents', actual: actual.cash, plan: plan.cash },
      { id: 'a_ar', section: 'Assets', label: 'Accounts receivable', actual: actual.accountsReceivable, plan: plan.accountsReceivable },
      { id: 'a_accr', section: 'Assets', label: 'Accrued revenue', actual: actual.accruedRevenue, plan: plan.accruedRevenue },
      { id: 'a_prep', section: 'Assets', label: 'Prepayments', actual: actual.prepayments, plan: plan.prepayments },
      { id: 'a_fixed', section: 'Assets', label: 'Fixed assets', actual: actual.fixedAssets, plan: plan.fixedAssets },
      { id: 'a_other', section: 'Assets', label: 'Other assets', actual: actual.otherAssets, plan: plan.otherAssets },
      { id: 'a_total', section: 'Assets', label: 'TOTAL ASSETS', actual: actual.totalAssets, plan: plan.totalAssets, strong: true },

      { id: 'l_ap', section: 'Liabilities', label: 'Accounts payable', actual: actual.accountsPayable, plan: plan.accountsPayable },
      { id: 'l_def', section: 'Liabilities', label: 'Deferred revenue', actual: actual.deferredRevenue, plan: plan.deferredRevenue },
      { id: 'l_accx', section: 'Liabilities', label: 'Accrued expenses', actual: actual.accruedExpenses, plan: plan.accruedExpenses },
      { id: 'l_vat', section: 'Liabilities', label: 'VAT liability / (asset)', actual: actual.vat, plan: plan.vat },
      { id: 'l_tax', section: 'Liabilities', label: 'Deferred tax liability / (asset)', actual: actual.deferredTax, plan: plan.deferredTax },
      { id: 'l_debt', section: 'Liabilities', label: 'Debt funding', actual: actual.debtFunding, plan: plan.debtFunding },
      { id: 'l_other', section: 'Liabilities', label: 'Other liabilities', actual: actual.otherLiabilities, plan: plan.otherLiabilities },
      { id: 'l_total', section: 'Liabilities', label: 'TOTAL LIABILITIES', actual: actual.totalLiabilities, plan: plan.totalLiabilities, strong: true },

      { id: 'e_sc', section: 'Equity', label: 'Share capital & premium', actual: actual.shareCapitalPremium, plan: plan.shareCapitalPremium },
      { id: 'e_re', section: 'Equity', label: 'Retained earnings', actual: actual.retainedEarnings, plan: plan.retainedEarnings },
      { id: 'e_cta', section: 'Equity', label: 'Cumulative translation adjustment', actual: actual.cta, plan: plan.cta },
      { id: 'e_total', section: 'Equity', label: 'TOTAL EQUITY', actual: actual.totalEquity, plan: plan.totalEquity, strong: true },
    ]

    return rows.map((r) => {
      const variance = r.actual - r.plan
      const variancePct = safeDiv(variance, Math.abs(r.plan || 1))
      return { ...r, variance, variancePct }
    })
  }, [actual, plan])

  const commentary = useMemo(() => {
    const cashVar = safeDiv(actual.cash - plan.cash, Math.max(1, plan.cash))
    const assetsVar = safeDiv(actual.totalAssets - plan.totalAssets, Math.max(1, plan.totalAssets))
    const liabVar = safeDiv(actual.totalLiabilities - plan.totalLiabilities, Math.max(1, plan.totalLiabilities))
    const equityVar = safeDiv(actual.totalEquity - plan.totalEquity, Math.max(1, Math.abs(plan.totalEquity || 1)))

    const wcNow = actual.workingCapital
    const wcPrev = deriveBsSnapshot(window[Math.max(0, window.length - 2)] ?? current).workingCapital
    const wcDelta = wcNow - wcPrev

    const biggest = [...bsTable]
      .filter((r) => !r.strong)
      .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
      .slice(0, 2)

    const arRow = bsTable.find((r) => r.label === 'Accounts receivable')
    const defRow = bsTable.find((r) => r.label === 'Deferred revenue')
    const wcWhy =
      (arRow?.variance ?? 0) > 0
        ? 'working capital consumption is mainly AR-led (collections timing)'
        : (defRow?.variance ?? 0) < 0
          ? 'deferred revenue is below plan (prepayment/renewal timing), reducing the WC benefit'
          : wcDelta >= 0
            ? 'WC improved via payables/accruals timing and prepayment mix'
            : 'WC softened due to timing between billing, collections, and supplier payments'

    return [
      <>
        Cash is <b>{formatMoney(actual.cash, { compact: true, currency })}</b>{' '}
        (<span style={{ color: cashVar >= 0 ? 'var(--good)' : 'var(--bad)', fontWeight: 800 }}>
          {cashVar >= 0 ? 'above' : 'below'} plan {formatDeltaPct(cashVar)}
        </span>
        ).
      </>,
      <>
        Total assets are {assetsVar >= 0 ? 'above' : 'below'} plan ({formatDeltaPct(assetsVar)}); liabilities are{' '}
        {liabVar >= 0 ? 'above' : 'below'} plan ({formatDeltaPct(liabVar)}).
      </>,
      <>
        Equity is {equityVar >= 0 ? 'above' : 'below'} plan ({formatDeltaPct(equityVar)}); variance typically reflects retained earnings timing and FX translation for non‑USD entities.
      </>,
      <>
        Working capital is <b>{formatMoney(wcNow, { compact: true, currency })}</b> ({wcDelta >= 0 ? 'up' : 'down'}{' '}
        {formatMoney(Math.abs(wcDelta), { compact: true, currency })} vs prior month) — <b>{wcWhy}</b>.
      </>,
      <>
        Biggest variances: <b>{biggest[0]?.label ?? '—'}</b> ({formatMoney(biggest[0]?.variance ?? 0, { compact: true, currency })}),{' '}
        <b>{biggest[1]?.label ?? '—'}</b> ({formatMoney(biggest[1]?.variance ?? 0, { compact: true, currency })}).
      </>,
    ]
  }, [actual, bsTable, currency, current, plan, window])

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div>
        <div className="h1">Balance Sheet</div>
        <div className="subtle">
          Investor-style balance sheet with Actual / Plan / Variance and executive commentary.
        </div>
      </div>

      <CommentaryCard bullets={commentary} />

      <div className="grid cols-12">
        <div className="col-span-3">
          <KpiTile label="Cash & cash equivalents" value={formatMoney(actual.cash, { compact: true, currency })} deltaLabel="vs plan" deltaValue={formatMoney(actual.cash - plan.cash, { compact: true, currency })} deltaTone={(actual.cash - plan.cash) >= 0 ? 'good' : 'bad'} />
        </div>
        <div className="col-span-3">
          <KpiTile label="Total assets" value={formatMoney(actual.totalAssets, { compact: true, currency })} deltaLabel="vs plan" deltaValue={formatMoney(actual.totalAssets - plan.totalAssets, { compact: true, currency })} deltaTone={(actual.totalAssets - plan.totalAssets) >= 0 ? 'good' : 'bad'} />
        </div>
        <div className="col-span-3">
          <KpiTile label="Total liabilities" value={formatMoney(actual.totalLiabilities, { compact: true, currency })} deltaLabel="vs plan" deltaValue={formatMoney(actual.totalLiabilities - plan.totalLiabilities, { compact: true, currency })} deltaTone={(actual.totalLiabilities - plan.totalLiabilities) <= 0 ? 'good' : 'bad'} />
        </div>
        <div className="col-span-3">
          <KpiTile label="Total equity" value={formatMoney(actual.totalEquity, { compact: true, currency })} deltaLabel="vs plan" deltaValue={formatMoney(actual.totalEquity - plan.totalEquity, { compact: true, currency })} deltaTone={(actual.totalEquity - plan.totalEquity) >= 0 ? 'good' : 'bad'} />
        </div>

        <div className="col-span-12">
          <Card
            title="Balance sheet (Actual vs Plan)"
            subtitle="Investor-style statement with variances"
            padding="md"
          >
            <DataTable
              dense
              rows={bsTable.map((r) => ({ ...r, id: r.id }))}
              columns={[
                {
                  key: 'line',
                  header: 'Line item',
                  render: (r) => (
                    <div style={{ display: 'grid', gap: 2 }}>
                      <div className="subtle">{r.section}</div>
                      <div style={{ fontWeight: r.strong ? 900 : 700 }}>{r.label}</div>
                    </div>
                  ),
                },
                { key: 'act', header: 'Actual', align: 'right', render: (r) => formatMoney(r.actual, { compact: true, currency }) },
                { key: 'plan', header: 'Plan', align: 'right', render: (r) => formatMoney(r.plan, { compact: true, currency }) },
                {
                  key: 'var',
                  header: 'Variance',
                  align: 'right',
                  render: (r) => (
                    <span style={{ fontWeight: 850, color: r.variance >= 0 ? 'var(--good)' : 'var(--bad)' }}>
                      {formatMoney(r.variance, { compact: true, currency })}
                    </span>
                  ),
                },
                {
                  key: 'varp',
                  header: 'Var %',
                  align: 'right',
                  render: (r) => (
                    <span style={{ fontWeight: 850, color: r.variancePct >= 0 ? 'var(--good)' : 'var(--bad)' }}>
                      {formatDeltaPct(r.variancePct, 0)}
                    </span>
                  ),
                },
              ]}
            />
          </Card>
        </div>

        <div className="col-span-12">
          <ChartCard
            title="Cash conversion cycle (proxy)"
            subtitle="AR turnover (DSO), ACT turnover (DPO) and implied CCC (days)"
            height={260}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cccTrend} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={COLORS.grid} vertical={false} />
                <XAxis dataKey="period" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `${v}d`} />
                <Tooltip
                  formatter={(v: any, name: any) => [`${v} days`, name]}
                  contentStyle={{
                    background: 'rgba(255,255,255,0.95)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    boxShadow: 'var(--shadow-md)',
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: 'var(--muted)' }} />
                <Line type="monotone" dataKey="AR turnover (DSO)" stroke="rgba(37,99,235,0.95)" strokeWidth={2.4} dot={false}>
                  <LabelList content={numberPoint} />
                </Line>
                <Line type="monotone" dataKey="ACT turnover (DPO)" stroke="rgba(239,68,68,0.75)" strokeWidth={2.2} dot={false}>
                  <LabelList content={numberPoint} />
                </Line>
                <Line
                  type="monotone"
                  dataKey="Cash conversion cycle"
                  stroke="rgba(20,184,166,0.95)"
                  strokeWidth={2.4}
                  dot={false}
                >
                  <LabelList content={numberPoint} />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <div className="col-span-12">
          <ChartCard
            title="Working capital (trend)"
            subtitle="Balance-sheet drivers behind the CCC movement"
            height={280}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={workingCapitalTrend} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
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
                <Line type="monotone" dataKey="Working capital" stroke="rgba(20,184,166,0.95)" strokeWidth={2.4} dot={false}>
                  <LabelList content={moneyPoint} />
                </Line>
                <Line type="monotone" dataKey="Accounts receivable" stroke="rgba(37,99,235,0.65)" strokeWidth={1.8} dot={false} strokeDasharray="4 4" />
                <Line type="monotone" dataKey="Prepayments" stroke="rgba(79,70,229,0.55)" strokeWidth={1.8} dot={false} strokeDasharray="4 4" />
                <Line type="monotone" dataKey="Accounts payable" stroke="rgba(239,68,68,0.55)" strokeWidth={1.8} dot={false} strokeDasharray="4 4" />
                <Line type="monotone" dataKey="Deferred revenue" stroke="rgba(15,23,42,0.38)" strokeWidth={1.8} dot={false} strokeDasharray="4 4" />
                <Line type="monotone" dataKey="Accrued expenses" stroke="rgba(15,23,42,0.22)" strokeWidth={1.8} dot={false} strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

      </div>
    </div>
  )
}

