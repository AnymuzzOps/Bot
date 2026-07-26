export const DEFAULT_TIMEZONE = 'America/Santiago'

export type ZonedNow = {
  date: Date
  timezone: string
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

export const getNowInTimezone = (timezone = DEFAULT_TIMEZONE, date = new Date()): ZonedNow => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date)
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return {
    date, timezone,
    year: Number(value.year), month: Number(value.month), day: Number(value.day),
    hour: Number(value.hour), minute: Number(value.minute), second: Number(value.second),
  }
}

const two = (value: number) => String(value).padStart(2, '0')

export const localDateISO = (timezone = DEFAULT_TIMEZONE, date = new Date()) => {
  const now = getNowInTimezone(timezone, date)
  return `${now.year}-${two(now.month)}-${two(now.day)}`
}

export const localTime = (timezone = DEFAULT_TIMEZONE, date = new Date()) => {
  const now = getNowInTimezone(timezone, date)
  return `${two(now.hour)}:${two(now.minute)}`
}

export const currentYearMonth = (timezone = DEFAULT_TIMEZONE, date = new Date()) =>
  localDateISO(timezone, date).slice(0, 7)

export const monthBounds = (month?: string, timezone = DEFAULT_TIMEZONE) => {
  const safe = /^\d{4}-(0[1-9]|1[0-2])$/.test(month || '') ? month! : currentYearMonth(timezone)
  const [year, monthNumber] = safe.split('-').map(Number)
  const nextYear = monthNumber === 12 ? year + 1 : year
  const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1
  return { month: safe, start: `${safe}-01`, end: `${nextYear}-${two(nextMonth)}-01` }
}

export const daysFromNowISO = (days: number, timezone = DEFAULT_TIMEZONE, date = new Date()) => {
  const [year, month, day] = localDateISO(timezone, date).split('-').map(Number)
  const target = new Date(Date.UTC(year, month - 1, day + days))
  return `${target.getUTCFullYear()}-${two(target.getUTCMonth() + 1)}-${two(target.getUTCDate())}`
}
