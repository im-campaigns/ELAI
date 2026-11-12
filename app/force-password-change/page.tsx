'use client'

import { useRouter } from 'next/navigation'
import ChangePasswordForm from '@/components/ChangePasswordForm'

export default function ForcePasswordChangePage() {
  const router = useRouter()

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-slate-50 px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-slate-800 mb-2">비밀번호 변경이 필요해요</h1>
          <p className="text-slate-500 text-sm">
            계속 이용하려면 임시 비밀번호를 새 비밀번호로 바꿔주세요.
          </p>
        </div>
        <ChangePasswordForm
          forced
          onSuccess={() => {
            router.replace('/mypage')
            router.refresh()
          }}
        />
      </div>
    </div>
  )
}
