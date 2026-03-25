'use client'
// src/app/lobby/LobbyClient.tsx
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Navbar from '@/components/ui/Navbar'
import AddCoinsModal from '@/components/ui/AddCoinsModal'
import type { User, Room } from '@/types'
import { formatCoins } from '@/lib/utils'

interface Props {
  user: User
  initialRooms: Room[]
}

export default function LobbyClient({ user, initialRooms }: Props) {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState(user)
  const [rooms, setRooms] = useState(initialRooms)
  const [showCoins, setShowCoins] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(false)

  // Create room form
  const [roomName, setRoomName] = useState('')
  const [ptsExact, setPtsExact] = useState(10)
  const [ptsWinner, setPtsWinner] = useState(5)
  const [ptsQual, setPtsQual] = useState(3)
  const [createdRoom, setCreatedRoom] = useState<Room | null>(null)

  // Join form
  const [joinCode, setJoinCode] = useState('')

  async function createRoom(e: React.FormEvent) {
    e.preventDefault()
    if (!roomName.trim()) { toast.error('Dá um nome pra sala!'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: roomName }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error); return }
      setCreatedRoom(json.data)
      setRooms(prev => [json.data, ...prev])
      setShowCreate(false)
      setRoomName('')
    } finally {
      setLoading(false)
    }
  }

  async function joinRoom(e: React.FormEvent) {
    e.preventDefault()
    if (joinCode.length < 4) { toast.error('Código inválido'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: joinCode }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error); return }
      toast.success(`Entrou na sala "${json.data.name}"! 🎉`)
      router.push(`/sala/${json.data.id}`)
    } finally {
      setLoading(false)
    }
  }

  function copyLink(code: string) {
    const url = `${window.location.origin}/sala/join/${code}`
    navigator.clipboard.writeText(url).catch(() => {})
    toast.success('🔗 Link copiado!')
  }
  function copyCode(code: string) {
    navigator.clipboard.writeText(code).catch(() => {})
    toast.success(`📋 Código ${code} copiado!`)
  }
 console.log(initialRooms)
  return (
    <>
      <Navbar user={currentUser} onAddCoins={() => setShowCoins(true)} />

      {showCoins && (
        <AddCoinsModal
          currentCoins={currentUser.coins}
          onClose={() => setShowCoins(false)}
          onSuccess={(coins) => setCurrentUser(u => ({ ...u, coins }))}
        />
      )}

      {/* Room Created success modal */}
      {createdRoom && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center px-4" onClick={() => setCreatedRoom(null)}>
          <div className="card relative w-full max-w-sm p-8 overflow-hidden text-center" onClick={e => e.stopPropagation()}>
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-green to-gold" />
            <div className="text-5xl mb-4">🎉</div>
            <h3 className="text-2xl font-black tracking-widest mb-2">Sala criada!</h3>
            <p className="text-sm text-muted mb-6">Compartilhe com seus amigos</p>
            <div className="bg-dark-3 rounded-2xl p-5 mb-4">
              <div className="text-xs text-muted uppercase tracking-widest mb-1">Código da sala</div>
              <div className="font-mono text-5xl font-black text-gold tracking-[0.3em]">{createdRoom.code}</div>
            </div>
            <div className="flex gap-2 mb-4">
              <button onClick={() => copyCode(createdRoom.code)} className="flex-1 btn-ghost text-sm py-2.5">📋 Copiar código</button>
              <button onClick={() => copyLink(createdRoom.code)} className="flex-1 btn-primary text-sm py-2.5">🔗 Copiar link</button>
            </div>
            <button
              onClick={() => { setCreatedRoom(null); router.push(`/sala/${createdRoom.id}`) }}
              className="w-full text-sm text-muted hover:text-white transition-colors py-2"
            >
              Entrar na sala →
            </button>
          </div>
        </div>
      )}

      <main className="min-h-screen bg-field bg-grid pt-16">
        <div className="max-w-5xl mx-auto px-4 py-10">

          {/* Header */}
          <div className="mb-10 animate-fade-up">
            <h1 className="text-5xl font-black tracking-widest uppercase text-white">
              Olá, <span className="text-green">{currentUser?.nickname}</span>! 👋
            </h1>
            <p className="text-muted mt-2">Crie ou entre em uma sala para apostar na Copa</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* CREATE ROOM */}
            {!showCreate ? (
              <div className="card relative overflow-hidden p-7 animate-fade-up-1 cursor-pointer group" onClick={() => setShowCreate(true)}>
                <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-green to-gold" />
                <div className="text-4xl mb-4">🏟️</div>
                <h2 className="text-xl font-black mb-2">Criar nova sala</h2>
                <p className="text-sm text-muted mb-5">Defina as regras e chame seus amigos com link ou código</p>
                <div className="btn-primary inline-flex items-center gap-2 text-sm">
                  Criar sala <span>→</span>
                </div>
              </div>
            ) : (
              <div className="card relative overflow-hidden p-7 animate-fade-up-1">
                <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-green to-gold" />
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-xl font-black">🏟️ Nova sala</h2>
                  <button onClick={() => setShowCreate(false)} className="text-muted hover:text-white text-sm">✕</button>
                </div>
                <form onSubmit={createRoom} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-2">Nome da sala</label>
                    <input className="input-base" placeholder="Ex: Família, Trampo, Gangue..." value={roomName} onChange={e => setRoomName(e.target.value)} />
                  </div>
                
                  <button type="submit" disabled={loading} className="btn-primary w-full">
                    {loading ? 'Criando...' : 'Criar sala 🎉'}
                  </button>
                </form>
              </div>
            )}

            {/* JOIN ROOM */}
            <div className="card relative overflow-hidden p-7 animate-fade-up-2">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-blue to-green" />
              <div className="text-4xl mb-4">🔑</div>
              <h2 className="text-xl font-black mb-2">Entrar com código</h2>
              <p className="text-sm text-muted mb-5">Recebeu um código de um amigo? Entre aqui</p>
              <form onSubmit={joinRoom} className="flex gap-2">
                <input
                  className="input-base flex-1 font-mono uppercase tracking-widest"
                  placeholder="COPA24"
                  value={joinCode}
                  maxLength={8}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                />
                <button type="submit" disabled={loading} className="btn-primary px-5 whitespace-nowrap">
                  Entrar
                </button>
              </form>
            </div>
          </div>

          {/* MY ROOMS */}
          {rooms.length > 0 && (
            <div className="mt-8 animate-fade-up-3">
              <h2 className="text-lg font-black uppercase tracking-widest text-muted mb-4">Minhas salas</h2>
              <div className="grid gap-3">
                {rooms.map(room => (
                  <div
                    key={room.id}
                    onClick={() => router.push(`/sala/${room.id}`)}
                    className="card p-5 flex items-center justify-between cursor-pointer hover:border-green/30 transition-all hover:translate-x-1 group"
                  >
                    <div>
                      <div className="font-bold text-base">{room.name}</div>
                      <div className="text-xs text-muted font-mono mt-0.5">
                        Código: <span className="text-gold tracking-widest">{room.code}</span>
                        {' · '}{room.member_count} jogadores
                        {room.my_points ? ` · ${room.my_points} pts` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={e => { e.stopPropagation(); copyLink(room.code) }}
                        className="text-xs text-muted hover:text-green transition-colors px-3 py-1.5 border border-white/[0.06] rounded-lg"
                      >
                        🔗 Convidar
                      </button>
                      <span className="text-muted group-hover:text-green transition-colors">→</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {rooms.length === 0 && (
            <div className="mt-8 text-center py-16 text-muted animate-fade-up-3">
              <div className="text-5xl mb-4">⚽</div>
              <p className="text-sm">Crie ou entre em uma sala para começar a apostar!</p>
            </div>
          )}
        </div>
      </main>
    </>
  )
}
