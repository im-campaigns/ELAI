import { ConfigError } from '@/lib/errors'

const RESEND_API_URL = 'https://api.resend.com/emails'
const FROM_ADDRESS = 'ELAI <noreply@elai-zeta.vercel.app>'

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
    throw new Error(`이메일 발송에 실패했어요. (status ${res.status}) ${detail}`)
  }
}
