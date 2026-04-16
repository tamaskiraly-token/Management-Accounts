import { parseISO } from 'date-fns'

export function sum<T>(arr: T[], f: (t: T) => number) {
  return arr.reduce((a, b) => a + f(b), 0)
}

export function ytdSlice<T extends { periodEnd: string }>(months: T[], periodEnd: string) {
  const d = parseISO(periodEnd)
  const year = d.getFullYear()
  const idx = Math.max(0, months.findIndex((m) => m.periodEnd === periodEnd))
  const upto = months.slice(0, idx + 1)
  return upto.filter((m) => parseISO(m.periodEnd).getFullYear() === year)
}

