import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set() {},
        remove() {},
      },
    },
  );
}

export async function POST(req: NextRequest) {
  const db = getClient();

  const { data: auth } = await db.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  let label = 'Android';
  try {
    const body = await req.json();
    if (typeof body?.label === 'string') label = body.label.slice(0, 60);
  } catch {
    // body is optional
  }

  const token = 'sarathy_dev_' + crypto.randomBytes(24).toString('hex');

  const { error } = await db.from('device_tokens').insert({
    token,
    user_id: auth.user.id,
    device_label: label,
  });

  if (error) {
    console.error('[device/register]', error);
    return NextResponse.json({ error: 'could not register' }, { status: 500 });
  }

  return NextResponse.json({ token });
}

export async function DELETE() {
  const db = getClient();

  const { data: auth } = await db.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  await db.from('device_tokens').delete().eq('user_id', auth.user.id);
  return NextResponse.json({ success: true });
}
