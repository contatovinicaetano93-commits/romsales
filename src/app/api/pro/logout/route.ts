import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { PRO_AUTH_COOKIE } from '@/lib/pro/auth'

export async function POST() {
  const res = ok({ auth: 'logged_out' })
  res.cookies.set(PRO_AUTH_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return res
}
