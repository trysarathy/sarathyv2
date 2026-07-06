import crypto from 'crypto'
import { getFinverseConfig } from './config'

const STATE_TTL_SEC = 15 * 60
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Supabase user ids are UUIDs — encode as 16 raw bytes → 22-char base64url. */
function uuidToB64url(userId: string): string | null {
  if (!UUID_RE.test(userId)) return null
  return Buffer.from(userId.replace(/-/g, ''), 'hex').toString('base64url')
}

function b64urlToUuid(b64: string): string | null {
  try {
    const bytes = Buffer.from(b64, 'base64url')
    if (bytes.length !== 16) return null
    const hex = bytes.toString('hex')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  } catch {
    return null
  }
}

/** HMAC-SHA256 truncated to 16 bytes, base64url (~22 chars). */
function signStatePart(uuidB64: string, expSec: number, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(`${uuidB64}.${expSec}`)
    .digest()
    .subarray(0, 16)
    .toString('base64url')
}

/**
 * Compact signed state for Finverse Link (≤100 chars).
 * Format: {b64url(uuid_bytes)}.{expiry_unix_seconds}.{hmac16_b64url}
 */
export function signLinkState(userId: string): string {
  const uuidB64 = uuidToB64url(userId)
  if (!uuidB64) throw new Error('Invalid user id for link state')

  const expSec = Math.floor(Date.now() / 1000) + STATE_TTL_SEC
  const sig = signStatePart(uuidB64, expSec, getFinverseConfig().stateSecret)
  const state = `${uuidB64}.${expSec}.${sig}`

  if (state.length > 100) {
    throw new Error(`Link state exceeds 100 chars (${state.length})`)
  }
  return state
}

/** Returns userId if state is valid and unexpired. */
export function verifyLinkState(state: string): { userId: string } | null {
  if (!state || state.length > 100) return null

  const parts = state.split('.')
  if (parts.length !== 3) return null

  const [uuidB64, expStr, sig] = parts
  if (!uuidB64 || !expStr || !sig) return null

  const expSec = Number.parseInt(expStr, 10)
  if (!Number.isFinite(expSec) || expSec < Math.floor(Date.now() / 1000)) return null

  const expected = signStatePart(uuidB64, expSec, getFinverseConfig().stateSecret)
  const sigBuf = Buffer.from(sig, 'base64url')
  const expectedBuf = Buffer.from(expected, 'base64url')
  if (
    sigBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expectedBuf)
  ) {
    return null
  }

  const userId = b64urlToUuid(uuidB64)
  if (!userId) return null
  return { userId }
}
