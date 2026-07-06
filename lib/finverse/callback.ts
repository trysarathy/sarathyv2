import {
  Configuration,
  LinkApi,
  LoginIdentityApi,
  TokenGrantTypeEnum,
} from '@finverse/sdk-typescript'
import { getFinverseConfig } from './config'
import { getCustomerAccessToken, sleep } from './customer-token'
import { throwFinverseApiError } from './errors'
import { verifyLinkState } from './state'
import { upsertFinverseConnection } from './token-store'
import type { FinverseCallbackResult } from './types'

const FINAL_STATUSES = new Set([
  'ERROR',
  'DATA_RETRIEVAL_COMPLETE',
  'DATA_RETRIEVAL_PARTIALLY_SUCCESSFUL',
])

const POLL_INTERVAL_MS = 3000
const POLL_MAX_ATTEMPTS = 20

async function pollLoginIdentity(
  loginIdentityToken: string
): Promise<{ status: string; institutionName: string | null }> {
  const config = getFinverseConfig()
  const dataConfig = new Configuration({
    basePath: config.baseUrl,
    accessToken: loginIdentityToken,
  })
  const api = new LoginIdentityApi(dataConfig)

  let lastStatus = 'UNKNOWN'
  let institutionName: string | null = null

  for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
    try {
      const resp = await api.getLoginIdentity()
      lastStatus = resp.data.login_identity?.status ?? lastStatus
      institutionName = resp.data.institution?.institution_name ?? institutionName

      if (FINAL_STATUSES.has(lastStatus)) {
        return { status: lastStatus, institutionName }
      }
    } catch (err) {
      throwFinverseApiError('GET /login_identity (poll)', err)
    }

    await sleep(POLL_INTERVAL_MS)
  }

  return { status: lastStatus, institutionName }
}

/**
 * Exchange Finverse authorization code, poll login identity, persist connection.
 * Called from POST /api/finverse/callback after user completes Finverse Link.
 */
export async function handleFinverseCallback(
  code: string,
  state: string
): Promise<FinverseCallbackResult> {
  const verified = verifyLinkState(state)
  if (!verified) {
    throw new Error('Invalid or expired link state')
  }

  const config = getFinverseConfig()
  const customerToken = await getCustomerAccessToken()

  const linkConfig = new Configuration({
    basePath: config.baseUrl,
    accessToken: customerToken,
  })

  let tokenResp
  try {
    tokenResp = await new LinkApi(linkConfig).token(
      TokenGrantTypeEnum.AuthorizationCode,
      code,
      config.clientId,
      config.redirectUri
    )
  } catch (err) {
    throwFinverseApiError('POST /auth/token (code exchange)', err)
  }

  const loginIdentityToken = tokenResp.data.access_token
  const loginIdentityId = tokenResp.data.login_identity_id
  const refreshToken = tokenResp.data.refresh_token
  const expiresIn = tokenResp.data.expires_in ?? 3600

  if (!loginIdentityToken || !loginIdentityId || !refreshToken) {
    throw new Error('Finverse token response missing required fields')
  }

  const { status, institutionName } = await pollLoginIdentity(loginIdentityToken)

  if (status === 'ERROR') {
    throw new Error('Finverse data retrieval failed')
  }

  await upsertFinverseConnection({
    userId: verified.userId,
    loginIdentityId,
    institutionName,
    refreshToken,
    accessToken: loginIdentityToken,
    accessTokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
  })

  return {
    userId: verified.userId,
    loginIdentityId,
    institutionName,
    status,
  }
}
