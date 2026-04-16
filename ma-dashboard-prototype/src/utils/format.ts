export function formatNumber(n: number) {
  return new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(n)
}

export function formatCompact(n: number) {
  return new Intl.NumberFormat('en-GB', {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(n)
}

export function formatCompactNumber(n: number) {
  return new Intl.NumberFormat('en-GB', {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: Math.abs(n) >= 10_000_000 ? 0 : 1,
  }).format(n)
}

export function formatMoney(
  n: number,
  opts?: { compact?: boolean; currency?: 'USD' | 'GBP' | 'EUR'; maximumFractionDigits?: number },
) {
  const currency = opts?.currency ?? 'USD'
  const locale = currency === 'USD' ? 'en-US' : 'en-GB'
  if (opts?.compact) {
    const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '£'
    return `${symbol}${formatCompact(n)}`
  }
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: opts?.maximumFractionDigits ?? 0,
  }).format(n)
}

export function formatPercent(x: number, dp = 1) {
  return `${(x * 100).toFixed(dp)}%`
}

export function formatDeltaPct(x: number, dp = 1) {
  const v = x * 100
  const sign = v > 0 ? '+' : ''
  return `${sign}${v.toFixed(dp)}%`
}

export function safeDiv(a: number, b: number) {
  if (!b) return 0
  return a / b
}

