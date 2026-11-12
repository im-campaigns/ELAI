/**
 * 그룹과외 AI 무한반복 방지 점검 스크립트.
 * "회원 메시지 1개를 보내면 그 메시지에 달리는 AI 메시지(AI쌤+AI 학생)가 2개를
 * 넘지 않는지"를 실제 운영 중인 서버에 대해 끝에서 끝까지(end-to-end) 확인한다.
 *
 * AI 생성은 응답 이후 백그라운드(waitUntil)로 처리되므로, 이 스크립트는 메시지를
 * 보낸 뒤 서버의 maxDuration(60초)보다 넉넉하게 기다렸다가 결과를 확인한다.
 *
 * 사용법 (Node 20.6+는 --env-file로 .env.local을 바로 읽을 수 있다):
 *   node --env-file=.env.local scripts/check-ai-trigger-cap.mjs \
 *     --base-url=http://localhost:3000 --room-id=<방 uuid> \
 *     --nickname=<테스트 회원 닉네임> --password=<비밀번호>
 *
 * 필요 환경변수: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (결과를 DB에서 직접 확인하기 위함)
 * 테스트 회원은 해당 방에 status='approved'로 가입돼 있어야 한다.
 */

import { createClient } from '@supabase/supabase-js'

function parseArgs() {
  const args = {}
  for (const arg of process.argv.slice(2)) {
    const match = arg.match(/^--([^=]+)=(.*)$/)
    if (match) args[match[1]] = match[2]
  }
  return args
}

function fail(message) {
  console.error(`[FAIL] ${message}`)
  process.exit(1)
}

async function main() {
  const args = parseArgs()
  const baseUrl = args['base-url'] ?? 'http://localhost:3000'
  const roomId = args['room-id']
  const nickname = args['nickname']
  const password = args['password']
  const waitSeconds = Number(args['wait-seconds'] ?? 65)

  if (!roomId || !nickname || !password) {
    fail('사용법: node scripts/check-ai-trigger-cap.mjs --room-id=... --nickname=... --password=... [--base-url=...]')
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    fail('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요해요.')
  }
  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  console.log(`[1/4] ${baseUrl} 에 로그인 중...`)
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname, password }),
  })
  if (!loginRes.ok) fail(`로그인 실패: ${loginRes.status} ${await loginRes.text()}`)
  const cookie = loginRes.headers.get('set-cookie')
  if (!cookie) fail('로그인 응답에 쿠키가 없어요.')

  const content = `[점검] AI쌤 트리거 테스트입니다. 지금 몇 시인가요? ${Date.now()}`
  console.log(`[2/4] 방 ${roomId}에 트리거 메시지 전송 중... (${content})`)
  const sendRes = await fetch(`${baseUrl}/api/group/${roomId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ content }),
  })
  if (!sendRes.ok) fail(`메시지 전송 실패: ${sendRes.status} ${await sendRes.text()}`)
  const sendData = await sendRes.json()
  const triggerId = sendData?.message?.id
  if (!triggerId) fail('전송 응답에 message.id가 없어요.')
  console.log(`      트리거 메시지 id=${triggerId}`)

  console.log(`[3/4] AI 백그라운드 생성이 끝나길 ${waitSeconds}초 대기 중...`)
  await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000))

  console.log('[4/4] DB에서 이 트리거로 생성된 AI 메시지 확인 중...')
  const { data: aiMessages, error } = await db
    .from('room_messages')
    .select('id, sender_type, nickname, content, visible_at')
    .eq('room_id', roomId)
    .eq('triggered_by', triggerId)
    .order('visible_at', { ascending: true })

  if (error) fail(`조회 실패: ${error.message}`)

  console.log(`      생성된 AI 메시지 ${aiMessages.length}개:`)
  for (const m of aiMessages) {
    console.log(`      - [${m.sender_type}] ${m.nickname}: ${m.content.slice(0, 60)}`)
  }

  const teacherCount = aiMessages.filter((m) => m.sender_type === 'ai_teacher').length
  const studentCount = aiMessages.filter((m) => m.sender_type === 'ai_student').length

  if (aiMessages.length > 2) {
    fail(`트리거 1개당 AI 메시지가 ${aiMessages.length}개 생성됐어요 (최대 2개여야 함).`)
  }
  if (teacherCount > 1) fail(`AI쌤 메시지가 ${teacherCount}개 생성됐어요 (최대 1개여야 함).`)
  if (studentCount > 1) fail(`AI 학생 메시지가 ${studentCount}개 생성됐어요 (최대 1개여야 함).`)

  console.log(`[PASS] 트리거 1개당 AI 메시지 ${aiMessages.length}개 (AI쌤 ${teacherCount}, AI 학생 ${studentCount}) — 정상`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
