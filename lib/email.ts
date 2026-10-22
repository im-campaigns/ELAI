import { ConfigError } from '@/lib/errors'

const RESEND_API_URL = 'https://api.resend.com/emails'
// Resend 무료 플랜은 도메인 인증 전에는 noreply@elai-zeta.vercel.app 같은 커스텀 도메인에서 발송할 수 없고,
// 플랫폼이 제공하는 onboarding@resend.dev 에서만 발송 가능하다. 도메인을 인증하면 RESEND_FROM_EMAIL로 교체한다.
const FROM_ADDRESS = process.env.RESEND_FROM_EMAIL || 'ELAI <onboarding@resend.dev>'

export async function sendTempPasswordEmail(to: string, tempPassword: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new ConfigError(
      '이메일 발송 기능이 아직 설정되지 않았어요. 관리자에게 문의해주세요. (RESEND_API_KEY 미설정)',
    )
  }

  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [to],
      subject: '[ELAI] 임시 비밀번호 안내',
      text: `임시 비밀번호는 ${tempPassword} 입니다. 로그인 후 마이페이지에서 변경해주세요.`,
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    console.error(`[email] Resend 발송 실패 (status ${res.status}):`, detail)
    throw new Error(`이메일 발송에 실패했어요. (status ${res.status}) ${detail}`)
  }
}
