import { format } from 'date-fns'
import type { MonthlyKpis, MockModel, Period, Product } from './types'

type Rng = {
  next: () => number // 0..1
  normal: (mu: number, sigma: number) => number
  int: (min: number, max: number) => number
  pick: <T>(items: T[]) => T
}

function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeRng(seed: number): Rng {
  const r = mulberry32(seed)
  return {
    next: () => r(),
    normal: (mu, sigma) => {
      // Box–Muller
      const u = Math.max(1e-9, r())
      const v = Math.max(1e-9, r())
      const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
      return mu + z * sigma
    },
    int: (min, max) => Math.floor(min + r() * (max - min + 1)),
    pick: (items) => items[Math.floor(r() * items.length)]!,
  }
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

function round(n: number, dp = 0) {
  const m = 10 ** dp
  return Math.round(n * m) / m
}

function toMoney(n: number) {
  return Math.round(n)
}

export function createMockModel(args: { seed: number; periods: Period[] }): MockModel {
  const rng = makeRng(args.seed)
  const products: Product[] = ['PIS', 'AIS', 'VRP', 'VAs']

  // Base fintech scale assumptions (consolidated, USD).
  let baseTxnCount = rng.int(2_900_000, 4_200_000)
  let baseTxnValue = rng.int(6_000_000_000, 10_500_000_000) // $ processed / month
  let takeRateBps = clamp(rng.normal(12, 2.2), 7, 18) // revenue / txn value
  let activeClients = rng.int(115, 185)
  let cash = rng.int(48_000_000, 86_000_000) // USD cash (slightly higher scale)

  const months: MonthlyKpis[] = []

  // entity split
  const entities = ['Consolidated', 'Token UK', 'Token EU', 'Token US']
  const entityCurrency: Record<string, 'USD' | 'GBP' | 'EUR'> = {
    Consolidated: 'USD',
    'Token UK': 'GBP',
    'Token EU': 'EUR',
    'Token US': 'USD',
  }

  // Static FX for prototyping (USD base).
  const fxUsdPerUnit: Record<'USD' | 'GBP' | 'EUR', number> = { USD: 1, GBP: 1.27, EUR: 1.09 }
  const usdTo = (usd: number, ccy: 'USD' | 'GBP' | 'EUR') => Math.round(usd / fxUsdPerUnit[ccy])
  const entityWeights: Record<string, number> = {
    Consolidated: 1,
    'Token UK': 0.46,
    'Token EU': 0.34,
    'Token US': 0.20,
  }

  // Create a coherent time series: growth + seasonality + noise.
  const seasonal = (i: number) => 1 + 0.06 * Math.sin((2 * Math.PI * i) / 12)
  const growth = (i: number) => 1 + i * 0.012 + 0.0005 * i * i // accelerating gently

  args.periods.forEach((p, idx) => {
    const g = growth(idx)
    const s = seasonal(idx)
    const noise = (scale: number) => 1 + rng.normal(0, scale)

    const txnCount = Math.max(100_000, Math.round(baseTxnCount * g * s * noise(0.03)))
    const txnValue = Math.max(50_000_000, Math.round(baseTxnValue * g * s * noise(0.04)))

    // Take-rate gradually improves with mix, with minor volatility.
    takeRateBps = clamp(takeRateBps + rng.normal(0.08, 0.25), 7, 19)
    const revenue = toMoney((txnValue * takeRateBps) / 10_000)

    // COGS as % of revenue, improving over time.
    const cogsPct = clamp(0.34 - idx * 0.002 + rng.normal(0, 0.01), 0.22, 0.38)
    const cogs = toMoney(revenue * cogsPct)

    // Opex grows slower than revenue (operating leverage), but with step-ups.
    const opexBase = 6_800_000 + idx * 120_000 + (idx > 10 ? 750_000 : 0) + (idx > 16 ? 550_000 : 0)
    const opex = toMoney(opexBase * noise(0.03))

    // Plans: slightly smoother, slightly conservative vs actual.
    const planBias = clamp(1 + rng.normal(0.01, 0.015), 0.97, 1.06)
    const txnCountPlan = Math.round(txnCount * planBias * clamp(1 + rng.normal(0, 0.01), 0.98, 1.03))
    const txnValuePlan = Math.round(txnValue * planBias * clamp(1 + rng.normal(0, 0.012), 0.98, 1.03))
    const revenuePlan = toMoney((txnValuePlan * (takeRateBps - 0.4)) / 10_000)

    const incrementalTxnCount = Math.round(txnCount * clamp(rng.normal(0.08, 0.02), 0.03, 0.14))
    const incrementalTxnCountPlan = Math.round(incrementalTxnCount * clamp(1 + rng.normal(0.02, 0.05), 0.9, 1.12))

    // Clients
    const clientsGrowth = clamp(rng.normal(2.1, 1.4), -2, 7)
    activeClients = Math.max(40, Math.round(activeClients + clientsGrowth))
    const activeClientsPlan = Math.round(activeClients * clamp(1 + rng.normal(0.02, 0.02), 0.98, 1.07))

    const newClients = Math.max(0, Math.round(clamp(rng.normal(4.6, 2.4), 0, 11)))
    const churnedClients = Math.max(0, Math.round(clamp(rng.normal(1.7, 1.2), 0, 6)))
    const complianceClients = Math.max(10, Math.round(activeClients * clamp(rng.normal(0.32, 0.04), 0.22, 0.42)))

    const paymentsClientsTransacting = Math.round(activeClients * clamp(rng.normal(0.68, 0.05), 0.55, 0.78))
    const paymentsClientsAboveMins = Math.round(paymentsClientsTransacting * clamp(rng.normal(0.62, 0.07), 0.45, 0.78))
    const paymentsClientsIdle = Math.max(0, activeClients - paymentsClientsTransacting)

    // Revenue retention / expansion
    const churnedAcv = toMoney(clamp(rng.normal(310_000, 140_000), 50_000, 800_000))
    const newAcvBookings = toMoney(clamp(rng.normal(1_050_000, 420_000), 250_000, 2_300_000))
    const renewalsAcv = toMoney(clamp(rng.normal(780_000, 260_000), 120_000, 1_650_000))

    const grossRevenueExpansion = toMoney(clamp(rng.normal(1_250_000, 520_000), 250_000, 2_800_000))
    const netRevenueExpansion = toMoney(grossRevenueExpansion - churnedAcv * clamp(rng.normal(0.58, 0.12), 0.35, 0.9))
    const nrr = clamp(1.12 + idx * 0.003 + rng.normal(0, 0.02), 0.88, 1.38)

    // Contract book & risk
    const contractBookValue = toMoney(clamp(rng.normal(64_000_000, 12_000_000), 35_000_000, 110_000_000))
    const highRiskRevenueShare = clamp(rng.normal(0.08, 0.03), 0.02, 0.18)

    // Cash: tie to operating result and working capital-ish swings.
    const operatingResult = revenue - cogs - opex
    const wcSwing = toMoney(rng.normal(-450_000, 900_000))
    const operatingCashFlow = toMoney(operatingResult * clamp(rng.normal(0.82, 0.08), 0.65, 1.05) + wcSwing)
    const investingCashFlow = toMoney(-clamp(rng.normal(680_000, 260_000), 120_000, 1_400_000))
    const financingCashFlow = toMoney(
      idx === 0 ? clamp(rng.normal(0, 0), 0, 0) : rng.pick([0, 0, 0, 0, 2_500_000, 5_000_000]) + rng.int(-250_000, 250_000),
    )
    const netCashMovement = operatingCashFlow + investingCashFlow + financingCashFlow
    cash = Math.max(8_000_000, cash + netCashMovement)

    const prev = months[months.length - 1]
    const prevYear = months[months.length - 13]

    const row: MonthlyKpis = {
      periodEnd: p.value,
      periodLabel: p.label,

      txnCount,
      txnCountPlan,
      txnCountPrevMonth: prev?.txnCount ?? Math.round(txnCount / 1.03),
      txnCountPrevYear: prevYear?.txnCount ?? Math.round(txnCount / 1.14),

      incrementalTxnCount,
      incrementalTxnCountPlan,

      txnValue,
      txnValuePlan,
      takeRateBps: round(takeRateBps, 1),

      revenue,
      revenuePlan,
      cogs,
      opex,

      activeClients,
      activeClientsPlan,
      newClients,
      churnedClients,
      complianceClients,
      paymentsClientsTransacting,
      paymentsClientsAboveMins,
      paymentsClientsIdle,

      contractBookValue,
      highRiskRevenueShare,

      grossRevenueExpansion,
      netRevenueExpansion,
      churnedAcv,
      newAcvBookings,
      renewalsAcv,
      nrr: round(nrr, 2),

      operatingCashFlow,
      investingCashFlow,
      financingCashFlow,
      netCashMovement,
      endingCash: cash,
    }

    months.push(row)
  })

  // Entity models: scaled versions of consolidated with minor independent noise.
  const byEntity: MockModel['byEntity'] = {}
  entities.forEach((entity) => {
    if (entity === 'Consolidated') return
    const w = entityWeights[entity] ?? 0.25
    const ccy = entityCurrency[entity] ?? 'USD'
    const localRng = makeRng(Math.floor(args.seed * (w * 1000 + 13)))
    byEntity[entity] = {
      entity,
      currency: ccy,
      months: months.map((m) => {
        const jitter = (x: number, s = 0.035) => Math.round(x * w * (1 + localRng.normal(0, s)))
        const jitterMoneyUsd = (x: number, s = 0.04) => toMoney(x * w * (1 + localRng.normal(0, s)))
        const jitterMoney = (xUsd: number, s = 0.04) => usdTo(jitterMoneyUsd(xUsd, s), ccy)
        const out: MonthlyKpis = {
          ...m,
          revenue: jitterMoney(m.revenue),
          revenuePlan: jitterMoney(m.revenuePlan),
          cogs: jitterMoney(m.cogs),
          opex: jitterMoney(m.opex, 0.03),
          txnCount: jitter(m.txnCount, 0.03),
          txnCountPlan: jitter(m.txnCountPlan, 0.02),
          txnValue: jitterMoney(m.txnValue, 0.03),
          txnValuePlan: jitterMoney(m.txnValuePlan, 0.03),
          incrementalTxnCount: jitter(m.incrementalTxnCount, 0.05),
          incrementalTxnCountPlan: jitter(m.incrementalTxnCountPlan, 0.05),
          activeClients: Math.max(5, Math.round(m.activeClients * w * (1 + localRng.normal(0, 0.04)))),
          activeClientsPlan: Math.max(5, Math.round(m.activeClientsPlan * w * (1 + localRng.normal(0, 0.04)))),
          newClients: Math.max(0, Math.round(m.newClients * w * (1 + localRng.normal(0, 0.08)))),
          churnedClients: Math.max(0, Math.round(m.churnedClients * w * (1 + localRng.normal(0, 0.12)))),
          complianceClients: Math.max(0, Math.round(m.complianceClients * w * (1 + localRng.normal(0, 0.06)))),
          paymentsClientsTransacting: Math.max(
            0,
            Math.round(m.paymentsClientsTransacting * w * (1 + localRng.normal(0, 0.06))),
          ),
          paymentsClientsAboveMins: Math.max(
            0,
            Math.round(m.paymentsClientsAboveMins * w * (1 + localRng.normal(0, 0.06))),
          ),
          paymentsClientsIdle: Math.max(
            0,
            Math.round(m.paymentsClientsIdle * w * (1 + localRng.normal(0, 0.08))),
          ),
          contractBookValue: jitterMoney(m.contractBookValue, 0.06),
          grossRevenueExpansion: jitterMoney(m.grossRevenueExpansion, 0.08),
          netRevenueExpansion: jitterMoney(m.netRevenueExpansion, 0.08),
          churnedAcv: jitterMoney(m.churnedAcv, 0.10),
          newAcvBookings: jitterMoney(m.newAcvBookings, 0.08),
          renewalsAcv: jitterMoney(m.renewalsAcv, 0.08),
          operatingCashFlow: jitterMoney(m.operatingCashFlow, 0.10),
          investingCashFlow: jitterMoney(m.investingCashFlow, 0.10),
          financingCashFlow: jitterMoney(m.financingCashFlow, 0.15),
          netCashMovement: jitterMoney(m.netCashMovement, 0.10),
          endingCash: jitterMoney(m.endingCash, 0.05),
        }
        return out
      }),
    }
  })

  // Consolidated accessor + derived consolidated entity model
  byEntity['Consolidated'] = { entity: 'Consolidated', currency: 'USD', months }

  const model: MockModel = {
    entities,
    products,
    months,
    byEntity,
    get(entity) {
      return this.byEntity[entity] ?? this.byEntity['Consolidated']!
    },
  }

  // Make period labels consistent even if upstream passes custom labels.
  model.months.forEach((m) => {
    if (!m.periodLabel) m.periodLabel = format(new Date(m.periodEnd), 'MMM yyyy')
  })

  return model
}

