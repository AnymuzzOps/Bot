export const localDateISO = (timezone = 'America/Santiago', date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${map.year}-${map.month}-${map.day}`
}

export const monthBounds = (month?: string) => {
  const safe = /^\d{4}-\d{2}$/.test(month || '')
    ? month!
    : new Date().toISOString().slice(0, 7)
  const [year, monthNumber] = safe.split('-').map(Number)
  const start = `${safe}-01`
  const endDate = new Date(Date.UTC(year, monthNumber, 1))
  const end = endDate.toISOString().slice(0, 10)
  return { month: safe, start, end }
}

export const daysFromNowISO = (days: number) => {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
