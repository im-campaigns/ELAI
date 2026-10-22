import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ user: null })
  }
  return NextResponse.json({
    user: {
      nickname: user.nickname,
      email: user.email,
      createdAt: user.created_at,
      job: user.job,
      aiInterest: user.ai_interest,
      aiLevel: user.ai_level,
      onboardingDone: user.onboarding_done,
    },
  })
}
