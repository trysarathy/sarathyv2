export interface FinverseConfig {
  baseUrl: string
  appId: string
  clientId: string
  clientSecret: string
  redirectUri: string
  stateSecret: string
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

/** Load Finverse env vars — server-only. */
export function getFinverseConfig(): FinverseConfig {
  return {
    baseUrl: process.env.FINVERSE_BASE_URL?.trim() || 'https://api.prod.finverse.net',
    appId: requireEnv('FINVERSE_APP_ID'),
    clientId: requireEnv('FINVERSE_CLIENT_ID'),
    clientSecret: requireEnv('FINVERSE_CLIENT_SECRET'),
    redirectUri:
      process.env.FINVERSE_REDIRECT_URI?.trim() ||
      'http://localhost:3000/api/finverse/callback',
    stateSecret: requireEnv('FINVERSE_STATE_SECRET'),
  }
}
