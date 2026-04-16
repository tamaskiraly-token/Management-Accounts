import { useMemo } from 'react'
import {
  Bar,
  BarChart,
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
import { makeBarValueLabel, makeValueLabel } from '../ui/charts/ValueLabel'
import { Card } from '../ui/layout/Card'
import { CommentaryCard } from '../ui/insights/CommentaryCard'
import { KpiTile } from '../ui/metrics/KpiTile'
import { DataTable } from '../ui/tables/DataTable'
import { formatDeltaPct, formatMoney, formatPercent, safeDiv } from '../utils/format'
import { sum, ytdSlice } from '../utils/series'

const COLORS = {
  revenue: 'rgba(37,99,235,0.45)',
  gp: 'rgba(20,184,166,0.35)',
  ebitda: 'rgba(79,70,229,0.85)',
  plan: 'rgba(100,116,139,0.65)',
  grid: 'rgba(15,23,42,0.06)',
}

function tone(d: number, invert = false) {
  const v = invert ? -d : d
  if (v > 0.02) return 'good'
  if (v < -0.02) return 'bad'
  return 'neutral'
}

export function PlPage(props: { model: MockModel; filters: DashboardFilters }) {
  const entity = props.model.get(props.filters.entity)
  const currency = entity.currency
  const moneyLabel = useMemo(() => makeBarValueLabel({ kind: 'money', currency, tone: 'muted' }), [currency])
  const moneyPoint = useMemo(() => makeValueLabel({ kind: 'money', currency, tone: 'muted' }), [currency])
  const idx = Math.max(0, entity.months.findIndex((m) => m.periodEnd === props.filters.periodEnd))
  const current = entity.months[idx] ?? entity.months[entity.months.length - 1]!
  const window = entity.months.slice(Math.max(0, idx - 11), idx + 1)

  const scope = props.filters.view === 'ytd' ? ytdSlice(entity.months, current.periodEnd) : [current]

  const kpis = useMemo(() => {
    const revenue = sum(scope, (m) => m.revenue)
    const revenuePlan = sum(scope, (m) => m.revenuePlan)
    const cogs = sum(scope, (m) => m.cogs)
    const grossProfit = revenue - cogs
    const opex = sum(scope, (m) => m.opex)
    const ebitda = grossProfit - opex
    const delta = safeDiv(revenue - revenuePlan, revenuePlan)
    return { revenue, revenuePlan, grossProfit, cogs, opex, ebitda, delta }
  }, [scope])

  const plLines = useMemo(() => {
    const revenue = kpis.revenue
    const revenuePlan = kpis.revenuePlan

    // Revenue detail (proxy split)
    const revSplits = {
      license: 0.39,
      minimum: 0.28,
      volume: 0.32,
      professional: 0.01,
    }
    const revPlanBias = {
      license: 1.01,
      minimum: 1.02,
      volume: 0.98,
      professional: 1.0,
    }

    const rev = {
      license: Math.round(revenue * revSplits.license),
      minimum: Math.round(revenue * revSplits.minimum),
      volume: Math.round(revenue * revSplits.volume),
      professional: Math.round(revenue * revSplits.professional),
      other: Math.max(0, revenue - Math.round(revenue * (revSplits.license + revSplits.minimum + revSplits.volume + revSplits.professional))),
    }
    const revPlan = {
      license: Math.round(revenuePlan * revSplits.license * revPlanBias.license),
      minimum: Math.round(revenuePlan * revSplits.minimum * revPlanBias.minimum),
      volume: Math.round(revenuePlan * revSplits.volume * revPlanBias.volume),
      professional: Math.round(revenuePlan * revSplits.professional * revPlanBias.professional),
      other: Math.max(0, revenuePlan - Math.round(revenuePlan * (revSplits.license + revSplits.minimum + revSplits.volume + revSplits.professional))),
    }

    const cogs = kpis.cogs
    const cogsPlan = Math.round(revenuePlan * 0.30)
    const cogsRec = Math.round(cogs * 0.92)
    const cogsNon = cogs - cogsRec
    const cogsRecPlan = Math.round(cogsPlan * 0.94)
    const cogsNonPlan = cogsPlan - cogsRecPlan

    const grossProfit = revenue - cogs
    const grossProfitPlan = revenuePlan - cogsPlan

    const opex = kpis.opex
    const opexPlan = Math.round(revenuePlan * 0.86)

    // Staff vs non-staff cost blocks
    const staff = Math.round(opex * 0.79)
    const staffPlan = Math.round(opexPlan * 0.78)
    const nonStaff = opex - staff
    const nonStaffPlan = opexPlan - staffPlan

    // Staff detail (proxy)
    const staffLines = {
      fixed: Math.round(staff * 0.77),
      variable: Math.round(staff * 0.015),
      commissions: Math.round(staff * 0.03),
      pension: Math.round(staff * 0.07),
      contractors: Math.round(staff * 0.145),
      reclass: staff - Math.round(staff * (0.77 + 0.015 + 0.03 + 0.07 + 0.145)),
    }
    const staffLinesPlan = {
      fixed: Math.round(staffPlan * 0.79),
      variable: Math.round(staffPlan * 0.012),
      commissions: Math.round(staffPlan * 0.028),
      pension: Math.round(staffPlan * 0.068),
      contractors: Math.round(staffPlan * 0.135),
      reclass: staffPlan - Math.round(staffPlan * (0.79 + 0.012 + 0.028 + 0.068 + 0.135)),
    }

    // Non-staff detail (proxy)
    const ns = (p: number) => Math.round(nonStaff * p)
    const nsP = (p: number) => Math.round(nonStaffPlan * p)
    const nonStaffLines = {
      advertising: ns(0.05),
      audit: ns(0.04),
      cloud: ns(0.20),
      insurance: ns(0.06),
      legal: ns(0.05),
      professional: ns(0.12),
      recruitment: ns(0.06),
      rent: ns(0.08),
      software: ns(0.16),
      travel: ns(0.06),
      other: nonStaff - ns(0.05 + 0.04 + 0.20 + 0.06 + 0.05 + 0.12 + 0.06 + 0.08 + 0.16 + 0.06),
    }
    const nonStaffLinesPlan = {
      advertising: nsP(0.07),
      audit: nsP(0.05),
      cloud: nsP(0.18),
      insurance: nsP(0.06),
      legal: nsP(0.05),
      professional: nsP(0.11),
      recruitment: nsP(0.09),
      rent: nsP(0.08),
      software: nsP(0.14),
      travel: nsP(0.08),
      other: nonStaffPlan - nsP(0.07 + 0.05 + 0.18 + 0.06 + 0.05 + 0.11 + 0.09 + 0.08 + 0.14 + 0.08),
    }

    const ebitda = grossProfit - opex
    const ebitdaPlan = grossProfitPlan - opexPlan

    type Row = {
      id: string
      label: string
      group: string
      indent: number
      actual: number
      plan: number
      strong?: boolean
      isCost?: boolean
    }

    const rows: Row[] = [
      { id: 'rev_license', label: 'License fees', group: 'Revenue', indent: 0, actual: rev.license, plan: revPlan.license },
      { id: 'rev_min', label: 'Minimum usage fees', group: 'Revenue', indent: 0, actual: rev.minimum, plan: revPlan.minimum },
      { id: 'rev_vol', label: 'Volume-driven usage fees', group: 'Revenue', indent: 0, actual: rev.volume, plan: revPlan.volume },
      { id: 'rev_prof', label: 'Professional service fees', group: 'Revenue', indent: 0, actual: rev.professional, plan: revPlan.professional },
      { id: 'rev_other', label: 'Other revenue', group: 'Revenue', indent: 0, actual: rev.other, plan: revPlan.other },
      { id: 'rev_total', label: 'REVENUE', group: 'Revenue', indent: 0, actual: revenue, plan: revenuePlan, strong: true },

      { id: 'cogs_rec', label: 'Cost of sales — Recurring', group: 'Cost of sales', indent: 0, actual: -cogsRec, plan: -cogsRecPlan, isCost: true },
      { id: 'cogs_non', label: 'Cost of sales — Non-recurring', group: 'Cost of sales', indent: 0, actual: -cogsNon, plan: -cogsNonPlan, isCost: true },
      { id: 'gp', label: 'GROSS PROFIT', group: 'Gross profit', indent: 0, actual: grossProfit, plan: grossProfitPlan, strong: true },

      { id: 'staff_fixed', label: 'Fixed remuneration', group: 'Staff costs', indent: 0, actual: -staffLines.fixed, plan: -staffLinesPlan.fixed, isCost: true },
      { id: 'staff_var', label: 'Variable remuneration', group: 'Staff costs', indent: 0, actual: -staffLines.variable, plan: -staffLinesPlan.variable, isCost: true },
      { id: 'staff_comm', label: 'Commissions', group: 'Staff costs', indent: 0, actual: -staffLines.commissions, plan: -staffLinesPlan.commissions, isCost: true },
      { id: 'staff_pens', label: 'Pension & benefits', group: 'Staff costs', indent: 0, actual: -staffLines.pension, plan: -staffLinesPlan.pension, isCost: true },
      { id: 'staff_con', label: 'Contractors & consultants', group: 'Staff costs', indent: 0, actual: -staffLines.contractors, plan: -staffLinesPlan.contractors, isCost: true },
      { id: 'staff_reclass', label: 'Staff costs reclassification', group: 'Staff costs', indent: 0, actual: -staffLines.reclass, plan: -staffLinesPlan.reclass, isCost: true },
      { id: 'staff_total', label: 'Staff costs', group: 'Staff costs', indent: 0, actual: -staff, plan: -staffPlan, strong: true, isCost: true },

      { id: 'ns_adv', label: 'Advertising & marketing', group: 'Non-staff costs', indent: 0, actual: -nonStaffLines.advertising, plan: -nonStaffLinesPlan.advertising, isCost: true },
      { id: 'ns_audit', label: 'Audit & accounting', group: 'Non-staff costs', indent: 0, actual: -nonStaffLines.audit, plan: -nonStaffLinesPlan.audit, isCost: true },
      { id: 'ns_cloud', label: 'Cloud & third-party services', group: 'Non-staff costs', indent: 0, actual: -nonStaffLines.cloud, plan: -nonStaffLinesPlan.cloud, isCost: true },
      { id: 'ns_ins', label: 'Insurance', group: 'Non-staff costs', indent: 0, actual: -nonStaffLines.insurance, plan: -nonStaffLinesPlan.insurance, isCost: true },
      { id: 'ns_legal', label: 'Legal services', group: 'Non-staff costs', indent: 0, actual: -nonStaffLines.legal, plan: -nonStaffLinesPlan.legal, isCost: true },
      { id: 'ns_prof', label: 'Professional fees', group: 'Non-staff costs', indent: 0, actual: -nonStaffLines.professional, plan: -nonStaffLinesPlan.professional, isCost: true },
      { id: 'ns_recruit', label: 'Recruitment', group: 'Non-staff costs', indent: 0, actual: -nonStaffLines.recruitment, plan: -nonStaffLinesPlan.recruitment, isCost: true },
      { id: 'ns_rent', label: 'Rent & premises', group: 'Non-staff costs', indent: 0, actual: -nonStaffLines.rent, plan: -nonStaffLinesPlan.rent, isCost: true },
      { id: 'ns_soft', label: 'Software & licenses', group: 'Non-staff costs', indent: 0, actual: -nonStaffLines.software, plan: -nonStaffLinesPlan.software, isCost: true },
      { id: 'ns_travel', label: 'Travel & accommodation', group: 'Non-staff costs', indent: 0, actual: -nonStaffLines.travel, plan: -nonStaffLinesPlan.travel, isCost: true },
      { id: 'ns_other', label: 'Other non-staff costs', group: 'Non-staff costs', indent: 0, actual: -nonStaffLines.other, plan: -nonStaffLinesPlan.other, isCost: true },
      { id: 'ns_total', label: 'Non-staff costs', group: 'Non-staff costs', indent: 0, actual: -nonStaff, plan: -nonStaffPlan, strong: true, isCost: true },

      { id: 'ebitda', label: 'EBITDA', group: 'EBITDA', indent: 0, actual: ebitda, plan: ebitdaPlan, strong: true },
    ]

    const commentary = (row: Row) => {
      const variance = row.actual - row.plan
      const absVar = Math.abs(variance)
      const pct = safeDiv(variance, Math.abs(row.plan || 1))

      if (row.strong) {
        if (row.id === 'rev_total') return variance >= 0 ? 'Overall revenue above plan across key fee lines.' : 'Overall revenue below plan; see fee line drivers above.'
        if (row.id === 'gp') return variance >= 0 ? 'Gross profit above plan driven by revenue and/or cost efficiency.' : 'Gross profit below plan due to revenue shortfall and/or higher COS.'
        if (row.id === 'staff_total') return variance <= 0 ? 'Staff costs below plan; hiring/variable costs controlled.' : 'Staff costs above plan; hiring/contractor or variable comp higher.'
        if (row.id === 'ns_total') return variance <= 0 ? 'Non-staff costs below plan; discretionary spend controlled.' : 'Non-staff costs above plan; vendor/one-off spend elevated.'
        if (row.id === 'ebitda') return variance >= 0 ? 'EBITDA ahead of plan; operating leverage improving.' : 'EBITDA behind plan; revenue/cost variance to address.'
      }

      if (absVar < Math.max(25_000, Math.abs(row.plan) * 0.01)) return 'In line with plan.'

      const driver =
        row.group === 'Revenue'
          ? 'driven by mix and usage vs expectation.'
          : row.group === 'Cost of sales'
            ? 'driven by processing costs and vendor mix.'
            : row.group === 'Staff costs'
              ? 'driven by timing of hires, contractor usage, and variable comp.'
              : 'driven by timing of spend and vendor activity.'

      // For costs, "good" is lower (more negative variance means lower spend).
      if (row.isCost) {
        return variance <= 0 ? `Favourable vs plan; ${driver}` : `Unfavourable vs plan; ${driver}`
      }

      return pct >= 0 ? `Above plan; ${driver}` : `Below plan; ${driver}`
    }

    return rows.map((r) => {
      const variance = r.actual - r.plan
      const variancePct = safeDiv(variance, Math.abs(r.plan || 1))
      return { ...r, variance, variancePct, commentary: commentary(r) }
    })
  }, [kpis])

  const monthlyTrend = useMemo(() => {
    return window.map((m) => {
      const gp = m.revenue - m.cogs
      const ebitda = gp - m.opex
      return {
        period: m.periodLabel.slice(0, 3),
        Revenue: m.revenue,
        'Gross profit': gp,
        EBITDA: ebitda,
        Plan: m.revenuePlan,
        'EBITDA margin': safeDiv(ebitda, m.revenue),
      }
    })
  }, [window])

  const ytdActualVsPlan = useMemo(() => {
    const ytd = ytdSlice(entity.months, current.periodEnd)
    const actual = sum(ytd, (m) => m.revenue)
    const plan = sum(ytd, (m) => m.revenuePlan)
    return { actual, plan }
  }, [current.periodEnd, entity.months])

  const varianceByGroup = useMemo(() => {
    const by: Record<string, number> = {}
    plLines.forEach((r) => {
      if (!['Revenue', 'Cost of sales', 'Staff costs', 'Non-staff costs'].includes(r.group)) return
      by[r.group] = (by[r.group] ?? 0) + r.variance
    })
    // Express as EBITDA-variance contributions:
    // - Revenue above plan improves EBITDA (+)
    // - Costs above plan reduce EBITDA (−), so invert sign for cost groups.
    const rev = by['Revenue'] ?? 0
    const cogs = by['Cost of sales'] ?? 0
    const staff = by['Staff costs'] ?? 0
    const ns = by['Non-staff costs'] ?? 0
    return [
      { id: 'rev', label: 'Revenue', raw: rev, contrib: rev },
      { id: 'cogs', label: 'Cost of sales', raw: cogs, contrib: -cogs },
      { id: 'staff', label: 'Staff costs', raw: staff, contrib: -staff },
      { id: 'ns', label: 'Non-staff costs', raw: ns, contrib: -ns },
    ]
  }, [plLines])

  const commentary = useMemo(() => {
    const revVsPlan = safeDiv(kpis.revenue - kpis.revenuePlan, Math.max(1, kpis.revenuePlan))
    // Plan COS is not explicitly modeled; use a simple scale proxy for commentary purposes.
    const scale = safeDiv(kpis.revenuePlan, Math.max(1, kpis.revenue))
    const cogsPlanProxy = Math.round(kpis.cogs * scale)
    const gpPlanProxy = kpis.revenuePlan - cogsPlanProxy
    const gpVsPlan = safeDiv(kpis.grossProfit - gpPlanProxy, Math.max(1, Math.abs(gpPlanProxy)))
    const staffVar = varianceByGroup.find((x) => x.label === 'Staff costs')?.raw ?? 0
    const nsVar = varianceByGroup.find((x) => x.label === 'Non-staff costs')?.raw ?? 0
    const cogsVar = varianceByGroup.find((x) => x.label === 'Cost of sales')?.raw ?? 0

    const marginWhy =
      cogsVar < 0
        ? 'gross margin is pressured by higher delivery costs (routing, scheme fees, support)'
        : cogsVar > 0
          ? 'gross margin benefits from cost efficiency (lower COS or better mix)'
          : 'gross margin is mainly driven by revenue performance'

    const opexWhy =
      staffVar + nsVar < 0
        ? 'opex is ahead of plan (hiring ramp / one-offs / timing)'
        : staffVar + nsVar > 0
          ? 'opex is below plan (hiring lag / spend deferrals)'
          : 'opex is broadly on plan'

    const topLines = [...plLines]
      .filter((r) => !r.strong)
      .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
      .slice(0, 3)

    return [
      <>
        Revenue is <b style={{ color: revVsPlan >= 0 ? 'var(--good)' : 'var(--bad)' }}>{revVsPlan >= 0 ? 'ahead of' : 'behind'}</b>{' '}
        plan ({formatDeltaPct(revVsPlan)}); gross profit is {gpVsPlan >= 0 ? 'better' : 'worse'} than plan ({formatDeltaPct(gpVsPlan)}), because <b>{marginWhy}</b>.
      </>,
      <>
        EBITDA is {kpis.ebitda >= 0 ? 'positive' : 'negative'} at <b>{formatMoney(kpis.ebitda, { compact: true, currency })}</b> — <b>{opexWhy}</b>, so variance is driven by cost phasing as much as revenue.
      </>,
      <>
        Biggest variances: <b>{topLines[0]?.label ?? '—'}</b>, <b>{topLines[1]?.label ?? '—'}</b>, <b>{topLines[2]?.label ?? '—'}</b> — these are the best “why” lines to read first in the table commentary.
      </>,
      <>
        If revenue is below plan but COS/opex is above plan, expect a double-hit to EBITDA; if revenue is above plan with flat opex, operating leverage is improving.
      </>,
    ]
  }, [currency, kpis, plLines, varianceByGroup])

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div>
        <div className="h1">Profit & Loss</div>
        <div className="subtle">
          Modern management accounts view with headline KPIs, trend context, variance drivers and an investor-friendly table.
        </div>
      </div>

      <CommentaryCard bullets={commentary} />

      <div className="grid cols-12">
        <div className="col-span-3">
          <KpiTile
            label={props.filters.view === 'ytd' ? 'Revenue (YTD)' : 'Revenue (month)'}
            value={formatMoney(kpis.revenue, { compact: true, currency })}
            deltaLabel="vs plan"
            deltaValue={formatDeltaPct(kpis.delta)}
            deltaTone={tone(kpis.delta)}
            footnote={`Plan: ${formatMoney(kpis.revenuePlan, { compact: true, currency })}`}
          />
        </div>
        <div className="col-span-3">
          <KpiTile
            label="Gross profit"
            value={formatMoney(kpis.grossProfit, { compact: true, currency })}
            deltaLabel="GM"
            deltaValue={formatPercent(safeDiv(kpis.grossProfit, Math.max(1, kpis.revenue)), 0)}
            deltaTone="neutral"
            footnote={`COS: ${formatMoney(kpis.cogs, { compact: true, currency })}`}
          />
        </div>
        <div className="col-span-3">
          <KpiTile
            label="EBITDA"
            value={formatMoney(kpis.ebitda, { compact: true, currency })}
            deltaLabel="Margin"
            deltaValue={formatPercent(safeDiv(kpis.ebitda, Math.max(1, kpis.revenue)), 0)}
            deltaTone={tone(safeDiv(kpis.ebitda, Math.max(1, kpis.revenue)), true)}
            footnote={`Opex: ${formatMoney(kpis.opex, { compact: true, currency })}`}
          />
        </div>
        <div className="col-span-3">
          <KpiTile
            label="Operating result"
            value={formatMoney(kpis.ebitda, { compact: true, currency })}
            deltaLabel="Run-rate"
            deltaValue={props.filters.view === 'ytd' ? 'YTD view' : 'Monthly view'}
            deltaTone="neutral"
            footnote="Replace with your preferred definition (EBIT / op profit)."
          />
        </div>

        <div className="col-span-8">
          <ChartCard title="Monthly performance" subtitle="Revenue bars with EBITDA overlay and plan line" height={320}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthlyTrend} margin={{ top: 10, right: 14, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={COLORS.grid} vertical={false} />
                <XAxis dataKey="period" tickLine={false} axisLine={false} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatMoney(v, { compact: true, currency })}
                />
                <Tooltip
                  formatter={(v: any, name: any) => {
                    if (name === 'EBITDA margin') return [formatPercent(v, 0), name]
                    return [formatMoney(v, { compact: true, currency }), name]
                  }}
                  contentStyle={{
                    background: 'rgba(255,255,255,0.95)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    boxShadow: 'var(--shadow-md)',
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: 'var(--muted)' }} />
                <Bar dataKey="Revenue" fill={COLORS.revenue} radius={[10, 10, 0, 0]}>
                  <LabelList content={moneyLabel} />
                </Bar>
                <Line type="monotone" dataKey="Plan" stroke={COLORS.plan} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="EBITDA" stroke={COLORS.ebitda} strokeWidth={2.5} dot={false}>
                  <LabelList content={moneyPoint} />
                </Line>
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <div className="col-span-4">
          <ChartCard title="YTD revenue" subtitle="Actual vs plan (current FY)" height={320}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { name: 'YTD', Actual: ytdActualVsPlan.actual, Plan: ytdActualVsPlan.plan },
                ]}
                margin={{ top: 10, right: 10, bottom: 0, left: 0 }}
              >
                <CartesianGrid stroke={COLORS.grid} vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
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
                <Bar dataKey="Actual" fill="rgba(37,99,235,0.42)" radius={[10, 10, 10, 10]}>
                  <LabelList content={moneyLabel} />
                </Bar>
                <Bar dataKey="Plan" fill="rgba(100,116,139,0.25)" radius={[10, 10, 10, 10]}>
                  <LabelList content={moneyLabel} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="subtle" style={{ marginTop: 10 }}>
              Variance: <span style={{ fontWeight: 800, color: tone(safeDiv(ytdActualVsPlan.actual - ytdActualVsPlan.plan, ytdActualVsPlan.plan)) === 'good' ? 'var(--good)' : 'var(--bad)' }}>
                {formatDeltaPct(safeDiv(ytdActualVsPlan.actual - ytdActualVsPlan.plan, ytdActualVsPlan.plan))}
              </span>
            </div>
          </ChartCard>
        </div>

        <div className="col-span-5">
          <ChartCard title="Variance drivers" subtitle="What explains the variance vs plan?" height={260}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={varianceByGroup.map((w) => ({ name: w.label, v: w.contrib }))}
                margin={{ top: 10, right: 10, bottom: 0, left: 0 }}
              >
                <CartesianGrid stroke={COLORS.grid} vertical={false} />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  minTickGap={0}
                  height={28}
                  tickMargin={10}
                  tick={{ fill: 'rgba(100,116,139,0.95)', fontSize: 11, fontWeight: 700 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatMoney(v, { compact: true, currency })}
                />
                <Tooltip
                  formatter={(v: any) => [formatMoney(v, { compact: true, currency }), 'EBITDA impact']}
                  contentStyle={{
                    background: 'rgba(255,255,255,0.95)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    boxShadow: 'var(--shadow-md)',
                  }}
                />
                <Bar dataKey="v" fill="rgba(37,99,235,0.35)" radius={[10, 10, 10, 10]}>
                  <LabelList content={moneyLabel} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
              {varianceByGroup.map((w) => (
                <Card key={w.id} padding="sm" style={{ background: 'var(--surface-2)' }}>
                  <div className="subtle">{w.label}</div>
                  <div style={{ fontWeight: 850, color: w.contrib >= 0 ? 'var(--good)' : 'var(--bad)' }}>
                    {formatMoney(w.contrib, { compact: true, currency })}
                  </div>
                </Card>
              ))}
            </div>
          </ChartCard>
        </div>

        <div className="col-span-7">
          <Card title="Income statement detail" subtitle="Actual / Plan / Variance with line-level commentary" padding="md">
            <DataTable
              rows={plLines.map((r) => ({ ...r, id: r.id }))}
              columns={[
                {
                  key: 'label',
                  header: 'Line item',
                  render: (r) => (
                    <div style={{ display: 'grid', gap: 2 }}>
                      <div className="subtle">{r.group}</div>
                      <div style={{ paddingLeft: r.indent ? 14 : 0, fontWeight: r.strong ? 850 : 700 }}>
                        {r.label}
                      </div>
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
                    <span style={{ fontWeight: 800, color: r.variance >= 0 ? 'var(--good)' : 'var(--bad)' }}>
                      {formatMoney(r.variance, { compact: true, currency })}
                    </span>
                  ),
                },
                {
                  key: 'varp',
                  header: 'Var %',
                  align: 'right',
                  render: (r) => (
                    <span style={{ fontWeight: 800, color: r.variancePct >= 0 ? 'var(--good)' : 'var(--bad)' }}>
                      {formatDeltaPct(r.variancePct)}
                    </span>
                  ),
                },
                {
                  key: 'comm',
                  header: 'Commentary',
                  render: (r) => <span style={{ color: 'var(--muted)', fontSize: 12, whiteSpace: 'normal' }}>{r.commentary}</span>,
                },
              ]}
            />
          </Card>
        </div>
      </div>
    </div>
  )
}

