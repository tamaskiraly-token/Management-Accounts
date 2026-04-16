import { useMemo, useState } from 'react'
import { addMonths, endOfMonth, format } from 'date-fns'
import clsx from 'clsx'
import { createMockModel } from '../data/mockModel'
import type { DashboardFilters, DashboardTab, MockModel } from '../data/types'
import { Select } from '../ui/controls/Select'
import { Segmented } from '../ui/controls/Segmented'
import { Tabs } from '../ui/controls/Tabs'
import { Card } from '../ui/layout/Card'
import { KpisPage } from '../pages/KpisPage'
import { PlPage } from '../pages/PlPage'
import { BsPage } from '../pages/BsPage'
import { CfPage } from '../pages/CfPage'

const TABS: { id: DashboardTab; label: string }[] = [
  { id: 'kpis', label: 'KPIs' },
  { id: 'pl', label: 'P&L' },
  { id: 'bs', label: 'BS' },
  { id: 'cf', label: 'CF' },
]

function buildPeriods(monthCount = 18): { value: string; label: string; date: Date }[] {
  const end = endOfMonth(new Date(2026, 3, 1)) // Apr 2026 month end (matches screenshots)
  const items = Array.from({ length: monthCount }, (_, i) => {
    const d = endOfMonth(addMonths(end, -i))
    return { value: format(d, 'yyyy-MM-dd'), label: format(d, 'MMM yyyy'), date: d }
  })
  return items.reverse()
}

export function AppShell() {
  const periods = useMemo(() => buildPeriods(20), [])
  const [tab, setTab] = useState<DashboardTab>('kpis')

  const [filters, setFilters] = useState<DashboardFilters>(() => ({
    periodEnd: periods[periods.length - 1]!.value,
    entity: 'Consolidated',
    view: 'monthly',
    comparison: 'vsPlan',
    product: 'All',
    clientSegment: 'All',
    riskView: 'All',
  }))

  const model: MockModel = useMemo(() => createMockModel({ seed: 42, periods }), [periods])

  const periodLabel = periods.find((p) => p.value === filters.periodEnd)?.label ?? '—'

  return (
    <div>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          backdropFilter: 'blur(10px)',
          background: 'rgba(246, 248, 251, 0.72)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="container" style={{ padding: '14px 0' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 320 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  background: '#fff',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow-sm)',
                  display: 'grid',
                  placeItems: 'center',
                  overflow: 'hidden',
                }}
              >
                <img
                  src="/token-logo.png"
                  alt="Token"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <div style={{ lineHeight: 1.1 }}>
                <div className="h1">Management Accounts</div>
                <div className="subtle">Investor dashboard blueprint • mock data</div>
              </div>
            </div>

            <Tabs
              items={TABS}
              value={tab}
              onChange={setTab}
              ariaLabel="Dashboard sections"
            />

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: 10,
                minWidth: 420,
              }}
            >
              <Select
                label="Month ends at"
                value={filters.periodEnd}
                options={periods.map((p) => ({ value: p.value, label: p.label }))}
                onChange={(v) => setFilters((s) => ({ ...s, periodEnd: v }))}
              />
              <Select
                label="Entity"
                value={filters.entity}
                options={model.entities.map((e) => ({ value: e, label: e }))}
                onChange={(v) => setFilters((s) => ({ ...s, entity: v as MockModel['entities'][number] }))}
              />
              <Segmented
                ariaLabel="Monthly or YTD"
                value={filters.view}
                options={[
                  { value: 'monthly', label: 'Monthly' },
                  { value: 'ytd', label: 'YTD' },
                ]}
                onChange={(v) => setFilters((s) => ({ ...s, view: v as DashboardFilters['view'] }))}
              />
            </div>
          </div>

          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Card
              padding="sm"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div className="subtle">
                  <span className="kbd">{filters.entity}</span> • <span className="kbd">{periodLabel}</span>
                </div>
                <div className="subtle" style={{ color: 'var(--muted-2)' }}>
                  This is a front-end blueprint. Replace mocked numbers later.
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Segmented
                  ariaLabel="Comparison"
                  value={filters.comparison}
                  options={[
                    { value: 'vsPlan', label: 'vs Plan' },
                    { value: 'yoy', label: 'YoY' },
                    { value: 'mom', label: 'MoM' },
                  ]}
                  onChange={(v) =>
                    setFilters((s) => ({ ...s, comparison: v as DashboardFilters['comparison'] }))
                  }
                />
                <div
                  className={clsx('subtle')}
                  style={{ padding: '0 8px', borderLeft: '1px solid var(--border)' }}
                >
                  <span style={{ color: 'var(--muted)' }}>Seed</span> <span className="kbd">42</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </header>

      <main className="container page">
        {tab === 'kpis' && <KpisPage model={model} filters={filters} onChangeFilters={setFilters} />}
        {tab === 'pl' && <PlPage model={model} filters={filters} />}
        {tab === 'bs' && <BsPage model={model} filters={filters} />}
        {tab === 'cf' && <CfPage model={model} filters={filters} />}
      </main>
    </div>
  )
}

