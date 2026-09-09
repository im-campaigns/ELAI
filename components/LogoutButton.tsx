'use client'

import { useRouter } from 'next/navigation'

type Props = {
  className?: string
  endpoint?: string
  redirectTo?: string
  label?: string
}

export default function LogoutButton({
  className,
  endpoint = '/api/auth/logout',
  redirectTo = '/',
  label = '로그아웃',
}: Props) {
  const router = useRouter()

  const handleLogout = async () => {
    await fetch(endpoint, { method: 'POST' })
    router.push(redirectTo)
    router.refresh()
  }

  return (
    <button onClick={handleLogout} className={className}>
      {label}
    </button>
  )
}
