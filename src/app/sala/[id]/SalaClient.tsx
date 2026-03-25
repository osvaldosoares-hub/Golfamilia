'use client'
// src/app/sala/[id]/SalaClient.tsx
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Navbar from '@/components/ui/Navbar'
import AddCoinsModal from '@/components/ui/AddCoinsModal'
import MatchCard from '@/components/game/MatchCard'
import type { User, Room, Match, Bet, LeaderboardEntry } from '@/types'
import { formatCoins, getAvatarColor, getAvatarTextColor } from '@/lib/utils'

interface Props {
  user: User
  room: Room
  leaderboard: LeaderboardEntry[]
  matches: Match[]
  initialBets: Bet[]
  myCoinsInRoom: number
}

export default function SalaClient({ user, room, leaderboard, matches, initialBets, myCoinsInRoom }: Props) {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState(user)
  const [bets, setBets] = useState<Record<string, Bet>>(
    Object.fromEntries(initialBets.map(b => [b.match_id, b]))
  )
  const [showCoins, setShowCoins] = useState(false)
  const [coinsInRoom, setCoinsInRoom] = useState(myCoinsInRoom)
  const [roomBetAmount, setRoomBetAmount] = useState('')
  const [roomBetLoading, setRoomBetLoading] = useState(false)

  // Group matches
  const grouped = useMemo(() => {
    const map: Record<string, Match[]> = {}
    matches.forEach(m => {
      const key = m.phase === 'group' ? `Grupo ${m.group_label}` : m.phase
      if (!map[key]) map[key] = []
      map[key].push(m)
    })
    return map
  }, [matches])

  function copyCode() {
    navigator.clipboard.writeText(room.code).catch(() => {})
    toast.success(`📋 Código ${room.code} copiado!`)
  }
  function copyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/sala/join/${room.code}`)
    toast.success('🔗 Link de convite copiado!')
  }

  async function handleRoomBet() {
    const amount = parseInt(roomBetAmount)
    if (!amount || amount < 1) { toast.error('Valor inválido'); return }
    if (amount > currentUser.coins) { toast.error('GolCoins insuficientes!'); return }
    setRoomBetLoading(true)
    try {
      const res = await fetch(`/api/rooms/${room.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coins_bet: amount }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error || 'Erro'); return }
      setCoinsInRoom(json.data.coins_in_room)
      setCurrentUser(u => ({ ...u, coins: u.coins - amount }))
      setRoomBetAmount('')
      toast.success(`🪙 +${formatCoins(amount)} GolCoins apostados nesta sala!`)
    } finally {
      setRoomBetLoading(false)
    }
  }

  async function handleBet(matchId: string, data: {
    predicted_home: number
    predicted_away: number
    predicted_qualifier?: string
  }) {
    const res = await fetch('/api/bets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room_id: room.id, match_id: matchId, ...data }),
    })
    const json = await res.json()
    if (!res.ok) { toast.error(json.error || 'Erro ao salvar palpite'); return }

    setBets(prev => ({ ...prev, [matchId]: json.data }))
    toast.success('✅ Palpite confirmado!')
  }

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

      <main className="min-h-screen bg-field bg-grid pt-16">
        <div className="max-w-7xl mx-auto px-4 py-8">

          {/* Room header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 animate-fade-up">
            <div>
              <div className="flex items-center gap-3">
                <button onClick={() => router.push('/lobby')} className="text-muted hover:text-white transition-colors text-sm">← Lobby</button>
                <h1 className="text-3xl font-black tracking-widest">{room.name}</h1>
              </div>
              <p className="text-xs text-muted mt-1">
                {leaderboard.length} jogadores · Fase de grupos · Copa do Mundo 2026
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="bg-dark-2 border border-white/[0.08] rounded-xl px-4 py-2.5 flex items-center gap-3">
                <div>
                  <div className="text-[10px] text-muted uppercase tracking-widest">Código</div>
                  <div className="font-mono text-lg font-black text-gold tracking-widest">{room.code}</div>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={copyCode} className="text-xs text-muted hover:text-white border border-white/[0.08] rounded-lg px-2.5 py-1.5 transition-colors">📋</button>
                  <button onClick={copyLink} className="text-xs text-green border border-green/20 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-green/10">🔗 Link</button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr] gap-6">

            {/* LEFT: Leaderboard + pontuação */}
            <div className="space-y-4 animate-fade-up-1">
              {/* Pontuação da sala */}
              <div className="card p-5">
                <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-blue to-green" />
                <p className="text-xs font-bold text-muted uppercase tracking-widest mb-3">⚙️ Regras da sala</p>
                <div className="space-y-1.5">
                  {[
                    { label: 'Placar exato', pts: room.pts_exact, icon: '🎯' },
                    { label: 'Vencedor certo', pts: room.pts_winner, icon: '✅' },
                    
                  ].map(r => (
                    <div key={r.label} className="flex justify-between items-center text-sm">
                      <span className="text-muted">{r.icon} {r.label}</span>
                      <span className="font-mono font-bold text-green">{r.pts} pts</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-white/[0.06] flex justify-between items-center">
                  <span className="text-xs text-muted">🏦 Total apostado na sala</span>
                  <span className="font-mono font-bold text-gold text-sm">🪙 {formatCoins(leaderboard.reduce((sum, e) => sum + e.coins_in_room, 0))}</span>
                </div>
              </div>

              {/* Room bet */}
              <div className="card p-5 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-gold to-green" />
                <p className="text-xs font-bold text-muted uppercase tracking-widest mb-3">🪙 Aposta da sala</p>
                <div className="bg-dark-3 rounded-xl p-4 text-center mb-3">
                  <div className="text-2xl font-black text-gold font-mono">{formatCoins(coinsInRoom)}</div>
                  <div className="text-[10px] text-muted uppercase tracking-widest mt-1">GolCoins apostados</div>
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={1}
                    placeholder="100"
                    value={roomBetAmount}
                    onChange={e => setRoomBetAmount(e.target.value)}
                    disabled={roomBetLoading}
                    className="flex-1 px-3 py-2 bg-dark-3 border border-white/[0.08] rounded-xl text-gold font-mono text-sm text-center outline-none focus:border-gold/50 transition-colors disabled:opacity-50"
                  />
                  <button
                    disabled={roomBetLoading || !roomBetAmount || parseInt(roomBetAmount) < 1}
                    onClick={handleRoomBet}
                    className="px-4 py-2 bg-gold/20 border border-gold/40 rounded-xl text-gold text-sm font-bold hover:bg-gold/30 disabled:opacity-50 transition-all"
                  >
                    {roomBetLoading ? '...' : 'Apostar'}
                  </button>
                </div>
                <p className="text-[10px] text-muted mt-2 text-center">Você pode apostar mais a qualquer momento</p>
              </div>

              {/* Leaderboard */}
              <div className="card p-5 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-gold to-red" />
                <p className="text-xs font-bold text-muted uppercase tracking-widest mb-4">🏆 Ranking</p>
                <div className="space-y-1">
                  {leaderboard.map((entry, i) => {
                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`
                    return (
                      <div
                        key={entry.user_id}
                        className={`flex items-center gap-3 p-2 rounded-xl transition-colors ${entry.is_me ? 'bg-green/[0.06]' : 'hover:bg-white/[0.02]'}`}
                      >
                        <span className="text-sm w-6 text-center">{medal}</span>
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background: entry.avatar_color, color: getAvatarTextColor(entry.avatar_color) }}
                        >
                          {entry.nickname[0].toUpperCase()}
                        </div>
                        <span className={`flex-1 text-sm font-medium truncate ${entry.is_me ? 'text-green font-bold' : ''}`}>
                          {entry.nickname}{entry.is_me ? ' (você)' : ''}
                        </span>
                        <span className="font-mono font-bold text-green text-sm">{entry.total_points}pts</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* RIGHT: Matches */}
            <div className="space-y-8 animate-fade-up-2">
              {Object.entries(grouped).map(([group, groupMatches]) => (
                <div key={group}>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="phase-badge">{group}</span>
                    <div className="flex-1 h-px bg-white/[0.06]" />
                  </div>
                  <div className="space-y-3">
                    {groupMatches.map(match => (
                      <MatchCard
                        key={match.id}
                        match={match}
                        existingBet={bets[match.id]}
                        onBet={(data) => handleBet(match.id, data)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
