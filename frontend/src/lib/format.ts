export const formatMoney = (value: number, currency = 'CLP') =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'CLP' ? 0 : 2,
  }).format(Number(value || 0))

export const formatDate = (value?: string | null, withTime = false) => {
  if (!value) return 'Sin fecha'
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value)
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date)
}

export const todayISO = () => new Date().toISOString().slice(0, 10)

export const classNames = (...values: Array<string | false | null | undefined>) =>
  values.filter(Boolean).join(' ')
