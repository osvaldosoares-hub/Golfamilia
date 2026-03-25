'use client'
// src/components/ui/AuthForm.tsx
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface Props { defaultTab: 'login' | 'register' }

export default function AuthForm({ defaultTab }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<'login' | 'register'>(defaultTab)
  const [loading, setLoading] = useState(false)

  // login fields
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPass, setLoginPass] = useState('')

  // register fields
  const [regNick, setRegNick] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPass, setRegPass] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!loginEmail || !loginPass) { toast.error('Preencha todos os campos'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPass }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error || 'Erro ao entrar'); return }
      toast.success(`Bem-vindo de volta! 🎉`)
      router.push('/lobby')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!regNick || !regEmail || !regPass) { toast.error('Preencha todos os campos'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: regNick, email: regEmail, password: regPass }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error || 'Erro ao criar conta'); return }
      toast.success(`Conta criada! Bem-vindo, ${regNick}! ⚽`)
      router.push('/lobby')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md animate-fade-up">
      {/* Card */}
      <div className="card relative overflow-hidden p-10">
        {/* Top accent bar */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-green via-gold to-green" />

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🏆</div>
          <h1 className="text-4xl font-black tracking-widest uppercase text-green">
            Gol<span className="text-gold">Familia</span>
          </h1>
          <p className="text-muted text-sm mt-2">Bolão da Copa do Mundo com seus amigos</p>
        </div>

        {/* Tabs */}
        <div className="flex border border-white/[0.08] rounded-xl overflow-hidden mb-7">
          {(['login', 'register'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-sm font-bold transition-all ${
                tab === t ? 'bg-green text-black' : 'text-white/40 hover:text-white'
              }`}
            >
              {t === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          ))}
        </div>

        {/* Login Form */}
        {tab === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">E-mail</label>
              <input
                type="email"
                className="input-base"
                placeholder="seu@email.com"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Senha</label>
              <input
                type="password"
                className="input-base"
                placeholder="••••••••"
                value={loginPass}
                onChange={e => setLoginPass(e.target.value)}
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? 'Entrando...' : 'Entrar 🚀'}
            </button>
            <p className="text-center text-xs text-muted mt-3">
              Não tem conta?{' '}
              <button type="button" onClick={() => setTab('register')} className="text-green hover:underline">
                Criar agora
              </button>
            </p>
          </form>
        )}

        {/* Register Form */}
        {tab === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">
                Apelido (aparece no ranking)
              </label>
              <input
                type="text"
                className="input-base"
                placeholder="Ex: Pelezinho, Rainha..."
                value={regNick}
                onChange={e => setRegNick(e.target.value)}
                maxLength={20}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">E-mail</label>
              <input
                type="email"
                className="input-base"
                placeholder="seu@email.com"
                value={regEmail}
                onChange={e => setRegEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Senha</label>
              <input
                type="password"
                className="input-base"
                placeholder="Mínimo 6 caracteres"
                value={regPass}
                onChange={e => setRegPass(e.target.value)}
              />
            </div>
            <button type="submit" disabled={loading} className="btn-gold w-full mt-2">
              {loading ? 'Criando conta...' : 'Criar minha conta ⚽'}
            </button>
            <p className="text-center text-xs text-muted mt-3">
              Já tem conta?{' '}
              <button type="button" onClick={() => setTab('login')} className="text-green hover:underline">
                Entrar
              </button>
            </p>
          </form>
        )}
      </div>

      <p className="text-center text-xs text-muted mt-4">
        🎮 GolCoins não têm valor monetário real. É só diversão!
      </p>
    </div>
  )
}
