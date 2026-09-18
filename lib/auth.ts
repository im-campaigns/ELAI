import { createHmac, timingSafeEqual } from 'crypto'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { getDb, type DbUser } from '@/lib/db'
import { ConfigError } from '@/lib/errors'

const USER_COOKIE = 'elai_session'
const ADMIN_COOKIE = 'elai_admin_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

function getSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (!secret) {
    throw new ConfigError('로그인 시스템이 아직 설정되지 않았어요. 관리자에게 문의해주세요. (SESSION_SECRET 미설정)')
  }
  return secret
}

function base64url(input: string): string {
  return Buffer.from(input, 'utf-8').toString('base64url')
}

function fromBase64url(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf-8')
}

function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('base64url')
}

function pack(data: Record<string, unknown>): string {
  const payload = base64url(JSON.stringify(data))
  const signature = sign(payload)
  return `${payload}.${signature}`
}

function unpack<T>(token: string | undefined): T | null {
  if (!token) return null
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null

  const expected = sign(payload)
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  try {
    return JSON.parse(fromBase64url(payload)) as T
  } catch {
    return null
  }
}

// ---- Password hashing ----

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// ---- User session ----

export function createUserSession(userId: string): void {
  const token = pack({ uid: userId, iat: Date.now() })
  cookies().set(USER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
}

export function clearUserSession(): void {
  cookies().delete(USER_COOKIE)
}

export function getSessionUserId(): string | null {
  try {
    const token = cookies().get(USER_COOKIE)?.value
    const data = unpack<{ uid: string }>(token)
    return data?.uid ?? null
  } catch (err) {
    console.error('[auth] 세션 확인 실패:', err)
    return null
  }
}

export async function getCurrentUser(): Promise<DbUser | null> {
  const uid = getSessionUserId()
  if (!uid) return null

  try {
    const { data, error } = await getDb().from('users').select('*').eq('id', uid).maybeSingle()
    if (error || !data) return null
    return data as DbUser
  } catch (err) {
    console.error('[auth] 사용자 조회 실패:', err)
    return null
  }
}

// ---- Admin session ----

export function createAdminSession(): void {
  const token = pack({ admin: true, iat: Date.now() })
  cookies().set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8, // 8 hours
  })
}

export function clearAdminSession(): void {
  cookies().delete(ADMIN_COOKIE)
}

export function isAdminSession(): boolean {
  try {
    const token = cookies().get(ADMIN_COOKIE)?.value
    const data = unpack<{ admin: boolean }>(token)
    return data?.admin === true
  } catch (err) {
    console.error('[auth] 관리자 세션 확인 실패:', err)
    return false
  }
}
