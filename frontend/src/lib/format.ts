export const formatMoney = (value: number, currency = 'CLP') =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'CLP' ? 0 : 2,
  }).format(Number(value || 0))

export const formatDate = (value?: string | null, withTime = false) => {
  if (!value) return 'Sin fecha'
  return formatChileDate(value, withTime)
}

export const todayISO = getChileTodayISO

export const classNames = (...values: Array<string | false | null | undefined>) =>
  values.filter(Boolean).join(' ')
import { formatChileDate, getChileTodayISO } from './dates'
