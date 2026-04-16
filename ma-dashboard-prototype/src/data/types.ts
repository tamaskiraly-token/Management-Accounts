export type DashboardTab = 'kpis' | 'pl' | 'bs' | 'cf'

export type DashboardFilters = {
  periodEnd: string
  entity: string
  view: 'monthly' | 'ytd'
  comparison: 'vsPlan' | 'yoy' | 'mom'
  product: 'All' | 'PIS' | 'AIS' | 'VRP' | 'VAs'
  clientSegment: 'All' | 'Enterprise' | 'Mid-market' | 'SMB'
  riskView: 'All' | 'High risk' | 'Gambling'
}

export type Period = { value: string; label: string; date: Date }

export type Product = 'PIS' | 'AIS' | 'VRP' | 'VAs'

export type MonthlyKpis = {
  periodEnd: string
  periodLabel: string

  // Volume
  txnCount: number
  txnCountPlan: number
  txnCountPrevMonth: number
  txnCountPrevYear: number

  incrementalTxnCount: number
  incrementalTxnCountPlan: number

  txnValue: number // $ processed
  txnValuePlan: number
  takeRateBps: number

  // Revenue & unit economics
  revenue: number
  revenuePlan: number
  cogs: number
  opex: number

  // Client KPIs
  activeClients: number
  activeClientsPlan: number
  newClients: number
  churnedClients: number
  complianceClients: number
  paymentsClientsTransacting: number
  paymentsClientsAboveMins: number
  paymentsClientsIdle: number

  contractBookValue: number
  highRiskRevenueShare: number // 0..1

  // Net retention & expansion/retention
  grossRevenueExpansion: number
  netRevenueExpansion: number
  churnedAcv: number
  newAcvBookings: number
  renewalsAcv: number
  nrr: number // 0..1.6

  // Cash
  operatingCashFlow: number
  investingCashFlow: number
  financingCashFlow: number
  netCashMovement: number
  endingCash: number
}

export type EntityModel = {
  entity: string
  currency: 'USD' | 'GBP' | 'EUR'
  months: MonthlyKpis[]
}

export type MockModel = {
  entities: string[]
  products: Product[]
  months: MonthlyKpis[] // consolidated
  byEntity: Record<string, EntityModel>

  // lookup helpers
  get(entity: string): EntityModel
}

