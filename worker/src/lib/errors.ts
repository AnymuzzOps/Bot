export class HttpError extends Error {
  status: number
  details?: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.details = details
  }
}

export const assertNoDbError = (error: { message: string; details?: string } | null) => {
  if (error) {
    throw new HttpError(400, error.message, error.details)
  }
}
