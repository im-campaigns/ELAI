import { NextResponse } from 'next/server'
import { clearUserSession } from '@/lib/auth'

export async function POST() {
  clearUserSession()
  return NextResponse.json({ ok: true })
}
