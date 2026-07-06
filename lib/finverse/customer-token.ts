import { Configuration, PublicApi, type TokenRequest } from '@finverse/sdk-typescript'
import { getFinverseConfig } from './config'
import { throwFinverseApiError } from './errors'

/** Prod Data API may require customer_app_id / redirect_uri beyond TokenRequest. */
type CustomerTokenBody = TokenRequest & {
  customer_app_id?: string
  redirect_uri?: string
}

let cached: { token: string; expiresAt: number } | null = null

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Obtain (and cache) Finverse customer access token.
 * POST /auth/customer/token — application/json (per @finverse/sdk-typescript).
 */
export async function getCustomerAccessToken(): Promise<string> {
  const now = Date.now()
  if (cached && cached.expiresAt > now + 60_000) {
    return cached.token
  }

  const config = getFinverseConfig()
  const api = new PublicApi(new Configuration({ basePath: config.baseUrl }))

  try {
    const resp = await api.generateCustomerAccessToken({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'client_credentials',
      customer_app_id: config.appId,
      redirect_uri: config.redirectUri,
    } as CustomerTokenBody)

    const accessToken = resp.data.access_token
    if (!accessToken) {
      throw new Error('Customer token response missing access_token')
    }

    cached = {
      token: accessToken,
      expiresAt: now + (resp.data.expires_in ?? 3600) * 1000,
    }
    return cached.token
  } catch (err) {
    invalidateCustomerToken()
    throwFinverseApiError('POST /auth/customer/token', err)
  }
}

/** Clear cached customer token (e.g. after auth error). */
export function invalidateCustomerToken(): void {
  cached = null
}

export { sleep }
