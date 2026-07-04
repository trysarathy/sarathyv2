import type { WiseClient } from './client'
import type { WiseMode } from './types'
import { MockWiseClient } from './mock-client'
import { createRealWiseClient } from './real-client'

export type { WiseBalance, WiseTransaction, WiseMode } from './types'
export type { WiseClient } from './client'

export function getWiseMode(): WiseMode {
  const mode = process.env.WISE_MODE?.toLowerCase()
  return mode === 'real' ? 'real' : 'mock'
}

export function getWiseClient(): WiseClient {
  if (getWiseMode() === 'real') {
    return createRealWiseClient()
  }
  return new MockWiseClient()
}
