// src/app/register/page.tsx
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AuthForm from '@/components/ui/AuthForm'

export default async function RegisterPage() {
  const session = await getSession()
  if (session) redirect('/lobby')

  return (
    <main className="min-h-screen bg-field bg-grid flex items-center justify-center px-4">
      <AuthForm defaultTab="register" />
    </main>
  )
}
