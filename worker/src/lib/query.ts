export const escapeSearch = (value: string) => value.replace(/[,%()]/g, ' ').trim()

export const cleanObject = <T extends Record<string, unknown>>(input: T) =>
  Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Partial<T>

export const parseLimit = (value: string | undefined, fallback = 50, max = 200) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(Math.trunc(parsed), max)
}
