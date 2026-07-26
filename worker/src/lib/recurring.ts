export type RecurringProjection = { amount: unknown; frequency: string }

export const monthlyEquivalent = (item: RecurringProjection) => {
  const amount = Number(item.amount) || 0
  if (item.frequency === 'daily') return amount * 30.44
  if (item.frequency === 'weekly') return amount * 4.33
  if (item.frequency === 'yearly') return amount / 12
  return item.frequency === 'monthly' ? amount : 0
}

export const monthlyRecurringTotal = (items: RecurringProjection[]) =>
  items.reduce((total, item) => total + monthlyEquivalent(item), 0)

const lastDay = (year: number, monthIndex: number) => new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()

export const billingDateForMonth = (month: string, billingDay: number) => {
  const [year, monthNumber] = month.split('-').map(Number)
  const day = Math.min(billingDay, lastDay(year, monthNumber - 1))
  return `${month}-${String(day).padStart(2, '0')}`
}

export const nextMonthlyBillingDate = (billingDay: number, from = new Date()) => {
  const today = from.toISOString().slice(0, 10)
  let year = from.getUTCFullYear()
  let monthIndex = from.getUTCMonth()
  let candidate = billingDateForMonth(`${year}-${String(monthIndex + 1).padStart(2, '0')}`, billingDay)
  if (candidate < today) {
    monthIndex += 1
    if (monthIndex === 12) { year += 1; monthIndex = 0 }
    candidate = billingDateForMonth(`${year}-${String(monthIndex + 1).padStart(2, '0')}`, billingDay)
  }
  return candidate
}
