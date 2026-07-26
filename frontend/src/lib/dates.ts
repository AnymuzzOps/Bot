export const DEFAULT_TIMEZONE = 'America/Santiago'

const partsInChile = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: DEFAULT_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  return Object.fromEntries(parts.map((part) => [part.type, part.value]))
}

export const getChileTodayISO = (date = new Date()) => {
  const parts = partsInChile(date)
  return `${parts.year}-${parts.month}-${parts.day}`
}

export const getChileCurrentYearMonth = (date = new Date()) => getChileTodayISO(date).slice(0, 7)

export const shiftYearMonth = (month: string, offset: number) => {
  const [year, monthNumber] = month.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, monthNumber - 1 + offset, 1))
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`
}

export const formatChileDate = (value: string | Date, withTime = false) => {
  const date = value instanceof Date ? value : new Date(value.length === 10 ? `${value}T12:00:00-03:00` : value)
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: DEFAULT_TIMEZONE,
    day: '2-digit', month: 'short', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date)
}

const chileDateTimeParts = (date: Date) => Object.fromEntries(new Intl.DateTimeFormat('en-US', {
  timeZone: DEFAULT_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
}).formatToParts(date).map((part) => [part.type, part.value]))

export const chileDateTimeToISO = (localValue: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(localValue)
  if (!match) return null
  const [, year, month, day, hour, minute] = match
  const desiredAsUtc = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute))
  let instant = desiredAsUtc
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const actual = chileDateTimeParts(new Date(instant))
    const actualAsUtc = Date.UTC(Number(actual.year), Number(actual.month) - 1, Number(actual.day), Number(actual.hour), Number(actual.minute))
    instant += desiredAsUtc - actualAsUtc
  }
  return new Date(instant).toISOString()
}

export const formatChileDateTimeInput = (value: string) => {
  const parts = chileDateTimeParts(new Date(value))
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

export const chileDaysUntil = (date: string) => {
  const [todayYear, todayMonth, todayDay] = getChileTodayISO().split('-').map(Number)
  const [year, month, day] = date.split('-').map(Number)
  return Math.ceil((Date.UTC(year, month - 1, day) - Date.UTC(todayYear, todayMonth - 1, todayDay)) / 86400000)
}
