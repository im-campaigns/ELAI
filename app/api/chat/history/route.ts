import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { ConfigError } from '@/lib/errors'

export async function GET() {
  const userId = getSessionUserId()
  if (!userId) {
    return NextResponse.json({ messages: [] })
  }

  try {
    const { data, error } = await getDb()
      .from('chat_messages')
      .select('role, content, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(100)

    if (error) {
      console.error('[chat/history] 조회 실패:', error)
      return NextResponse.json({ messages: [] })
    }

    return NextResponse.json({
      messages: (data ?? []).map((m) => ({ role: m.role, content: m.content })),
    })
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error('[chat/history] 설정 오류:', err.message)
    } else {
      console.error('[chat/history] 알 수 없는 오류:', err)
    }
    return NextResponse.json({ messages: [] })
  }
}
