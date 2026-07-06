export interface FinverseConnection {
  id: string
  user_id: string
  login_identity_id: string
  institution_name: string | null
  refresh_token: string
  access_token: string | null
  access_token_expires_at: string | null
  linked_at: string
  updated_at: string
}

export interface FinverseCallbackResult {
  userId: string
  loginIdentityId: string
  institutionName: string | null
  status: string
}
