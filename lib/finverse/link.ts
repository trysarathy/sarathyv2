import { Configuration, LinkApi } from '@finverse/sdk-typescript'
import { getFinverseConfig } from './config'
import { getCustomerAccessToken } from './customer-token'
import { throwFinverseApiError } from './errors'
import { signLinkState } from './state'

export interface FinverseLinkResult {
  url: string
  state: string
}

/** Generate Finverse Link URL for a Sarathy user (server-only). */
export async function generateFinverseLinkUrl(userId: string): Promise<FinverseLinkResult> {
  const config = getFinverseConfig()
  const customerToken = await getCustomerAccessToken()
  const state = signLinkState(userId)

  const linkConfig = new Configuration({
    basePath: config.baseUrl,
    accessToken: customerToken,
  })

  try {
    const resp = await new LinkApi(linkConfig).generateLinkToken({
      grant_type: 'client_credentials',
      response_type: 'code',
      response_mode: 'form_post',
      client_id: config.clientId,
      user_id: userId,
      redirect_uri: config.redirectUri,
      state,
    })

    const url = resp.data.link_url
    if (!url) throw new Error('Finverse did not return a link URL')

    return { url, state }
  } catch (err) {
    throwFinverseApiError('POST /link/token', err)
  }
}
