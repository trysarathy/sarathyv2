/** Thrown when a Finverse SDK/Axios call fails — carries a client-safe message. */
export class FinverseApiError extends Error {
  readonly safeMessage: string
  readonly status?: number
  readonly context: string

  constructor(context: string, safeMessage: string, status?: number) {
    super(safeMessage)
    this.name = 'FinverseApiError'
    this.context = context
    this.safeMessage = safeMessage
    this.status = status
  }
}

function extractFinverseErrorBody(data: unknown): string | null {
  if (data == null) return null
  if (typeof data === 'string' && data.trim()) return data.trim()

  if (typeof data === 'object') {
    const d = data as Record<string, unknown>
    const parts = [d.message, d.error, d.error_description, d.details, d.detail, d.hint]
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    if (parts.length) return parts.join(' — ')

    if (Array.isArray(d.errors)) {
      const joined = d.errors
        .map(e => (typeof e === 'string' ? e : JSON.stringify(e)))
        .join('; ')
      if (joined) return joined.slice(0, 300)
    }
  }

  try {
    const serialized = JSON.stringify(data)
    if (serialized && serialized !== '{}') return serialized.slice(0, 300)
  } catch {
    // ignore
  }
  return null
}

function getAxiosResponse(err: unknown): { status?: number; data?: unknown } | null {
  if (!err || typeof err !== 'object') return null
  const response = (err as { response?: { status?: number; data?: unknown } }).response
  return response ?? null
}

/** Log Finverse error body and rethrow with a safe client message. */
export function throwFinverseApiError(context: string, err: unknown): never {
  const response = getAxiosResponse(err)

  if (response) {
    const { status, data } = response
    console.error(`Finverse API error [${context}]:`, { status, body: data })

    const finverseMsg = extractFinverseErrorBody(data)
    const safeMessage = finverseMsg
      ? `Finverse: ${finverseMsg}`.slice(0, 300)
      : `Finverse request failed (${status ?? 'unknown status'})`

    throw new FinverseApiError(context, safeMessage, status)
  }

  console.error(`Finverse error [${context}]:`, err)
  const message = err instanceof Error ? err.message : 'Finverse request failed'
  throw err instanceof FinverseApiError ? err : new FinverseApiError(context, message)
}

export function getFinverseErrorMessage(err: unknown): string {
  if (err instanceof FinverseApiError) return err.safeMessage
  if (err instanceof Error) return err.message
  return 'Finverse request failed'
}
