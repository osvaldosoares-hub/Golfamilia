// src/components/ui/Navbar.tsx
'use client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { User } from '@/types'
import { formatCoins } from '@/lib/utils'

interface Props {
  user: User
  onAddCoins?: () => void
}

export default function Navbar({ user, onAddCoins }: Props) {
  const router = useRouter()

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    toast.success('Até logo! 👋')
    router.push('/login')
    router.refresh()
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center justify-between px-6 bg-dark/85 backdrop-blur-xl border-b border-white/[0.06]">
      <div className="flex items-center gap-2">
        <span className="text-xl">⚽</span>
        <span className="text-xl font-black tracking-widest text-green uppercase">
          Gol<span className="text-gold">Familia</span>
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onAddCoins}
          className="flex items-center gap-2 bg-gold/10 border border-gold/20 rounded-xl px-4 py-2 transition-all hover:bg-gold/20 hover:border-gold/40"
        >
          <span className="text-sm">🪙</span>
          <span className="font-mono font-bold text-gold text-sm">{formatCoins(user?.coins)}</span>
          <span className="text-xs text-gold/60 font-bold">+ ADD</span>
        </button>

        <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.04] rounded-xl border border-white/[0.06]">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: user?.avatar_color, color: '#000' }}
          >
            {user?.nickname[0].toUpperCase()}
          </div>
          <span className="text-sm font-medium text-white/80">{user?.nickname}</span>
        </div>

        <button onClick={logout} className="btn-ghost text-xs py-2 px-4">
          Sair
        </button>
      </div>
    </nav>
  )
}
