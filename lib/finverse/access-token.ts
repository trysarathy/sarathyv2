import { Configuration, CustomerApi } from '@finverse/sdk-typescript'
import { getFinverseConfig } from './config'
import { getCustomerAccessToken } from './customer-token'
import { getFinverseConnection, updateFinverseTokens } from './token-store'

export class FinverseNotConnectedError extends Error {
  constructor() {
    super('No Finverse bank connection')
    this.name = 'FinverseNotConnectedError'
  }
}

/** Return a valid login-identity access token, refreshing via stored refresh_token if needed. */
export async function ensureValidAccessToken(userId: string): Promise<string> {
  const connection = await getFinverseConnection(userId)
  if (!connection) throw new FinverseNotConnectedError()

  const expiresAt = connection.access_token_expires_at
    ? new Date(connection.access_token_expires_at).getTime()
    : 0

  if (connection.access_token && expiresAt > Date.now() + 60_000) {
    return connection.access_token
  }

  const config = getFinverseConfig()
  const customerToken = await getCustomerAccessToken()
  const customerConfig = new Configuration({
    basePath: config.baseUrl,
    accessToken: customerToken,
  })

  const resp = await new CustomerApi(customerConfig).refreshToken({
    refresh_token: connection.refresh_token,
  })

  const accessToken = resp.data.access_token
  const refreshToken = resp.data.refresh_token ?? connection.refresh_token
  const expiresIn = resp.data.expires_in ?? 3600

  if (!accessToken) {
    throw new Error('Finverse token refresh failed')
  }

  await updateFinverseTokens(
    userId,
    accessToken,
    refreshToken,
    new Date(Date.now() + expiresIn * 1000)
  )

  return accessToken
}
