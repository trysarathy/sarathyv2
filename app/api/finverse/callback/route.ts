import { NextRequest, NextResponse } from 'next/server'
import { handleFinverseCallback } from '@/lib/finverse/callback'
import { getFinverseErrorMessage } from '@/lib/finverse/errors'

export const runtime = 'nodejs'

function redirectHome(req: NextRequest, params: Record<string, string>): NextResponse {
  const url = new URL('/home', req.url)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return NextResponse.redirect(url, 303)
}

/** Finverse Link callback — Finverse POSTs code + state via form_post. */
export async function POST(req: NextRequest) {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return redirectHome(req, { finverse: 'error', reason: 'invalid_request' })
  }

  const error = form.get('error')?.toString()
  if (error) {
    const description = form.get('error_description')?.toString() || error
    console.error('Finverse link error:', description)
    return redirectHome(req, { finverse: 'error', reason: 'link_failed' })
  }

  const code = form.get('code')?.toString()
  const state = form.get('state')?.toString()

  if (!code || !state) {
    return redirectHome(req, { finverse: 'error', reason: 'missing_code' })
  }

  try {
    const result = await handleFinverseCallback(code, state)
    console.info(
      'Finverse connected:',
      result.userId,
      result.loginIdentityId,
      result.institutionName,
      result.status
    )
    return redirectHome(req, { finverse: 'connected' })
  } catch (err) {
    const message = getFinverseErrorMessage(err)
    console.error('Finverse callback route error:', message)
    return redirectHome(req, {
      finverse: 'error',
      reason: message.slice(0, 120),
    })
  }
}

/** Reject GET — Finverse uses form_post to this endpoint. */
export async function GET() {
  return NextResponse.json(
    { error: 'Finverse callback expects POST with form data' },
    { status: 405 }
  )
}
