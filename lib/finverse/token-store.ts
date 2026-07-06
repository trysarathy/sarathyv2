import { createServiceSupabaseClient } from '@/lib/supabase-admin'
import type { FinverseConnection } from './types'

export interface UpsertConnectionParams {
  userId: string
  loginIdentityId: string
  institutionName: string | null
  refreshToken: string
  accessToken: string
  accessTokenExpiresAt: Date
}

/** Persist or update Finverse connection — service role only. */
export async function upsertFinverseConnection(
  params: UpsertConnectionParams
): Promise<FinverseConnection> {
  const supabase = createServiceSupabaseClient()
  const row = {
    user_id: params.userId,
    login_identity_id: params.loginIdentityId,
    institution_name: params.institutionName,
    refresh_token: params.refreshToken,
    access_token: params.accessToken,
    access_token_expires_at: params.accessTokenExpiresAt.toISOString(),
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('finverse_connections')
    .upsert(row, { onConflict: 'user_id' })
    .select('*')
    .single()

  if (error) throw error
  return data as FinverseConnection
}

/** Load connection for a user — service role only; never expose refresh_token to client. */
export async function getFinverseConnection(
  userId: string
): Promise<FinverseConnection | null> {
  const supabase = createServiceSupabaseClient()
  const { data, error } = await supabase
    .from('finverse_connections')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return (data as FinverseConnection | null) ?? null
}

/** Update tokens after refresh — service role only. */
export async function updateFinverseTokens(
  userId: string,
  accessToken: string,
  refreshToken: string,
  accessTokenExpiresAt: Date
): Promise<void> {
  const supabase = createServiceSupabaseClient()
  const { error } = await supabase
    .from('finverse_connections')
    .update({
      access_token: accessToken,
      refresh_token: refreshToken,
      access_token_expires_at: accessTokenExpiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  if (error) throw error
}
