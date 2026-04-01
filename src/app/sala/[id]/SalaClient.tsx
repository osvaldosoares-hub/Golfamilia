'use client'
// src/app/sala/[id]/SalaClient.tsx
import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Navbar from '@/components/ui/Navbar'
import AddCoinsModal from '@/components/ui/AddCoinsModal'
import MatchCard from '@/components/game/MatchCard'
import GroupTableCard from '../../../components/game/GroupTableCard'
import KnockoutBracket from '@/components/game/KnockoutBracket'
import type { User, Room, Match, Bet, LeaderboardEntry, GroupBet, GroupTeamInfo } from '@/types'
import { formatCoins, getAvatarColor, getAvatarTextColor, isKnockoutBetReleased } from '@/lib/utils'

interface Props {
  user: User
  room: Room
  leaderboard: LeaderboardEntry[]
  matches: Match[]
  initialBets: Bet[]
  initialGroupBets: GroupBet[]
  myCoinsInRoom: number
}

export default function SalaClient({ user, room, leaderboard, matches, initialBets, initialGroupBets, myCoinsInRoom }: Props) {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState(user)
  const [allMatches, setAllMatches] = useState(matches)
  const [bets, setBets] = useState<Record<string, Bet>>(
    Object.fromEntries(initialBets.map(b => [b.match_id, b]))
  )
  const [groupBets, setGroupBets] = useState<Record<string, GroupBet>>(
    Object.fromEntries(initialGroupBets.map(b => [b.group_label, b]))
  )
  const [showCoins, setShowCoins] = useState(false)
  const [coinsInRoom, setCoinsInRoom] = useState(myCoinsInRoom)
  const [roomBetAmount, setRoomBetAmount] = useState('')
  const [roomBetLoading, setRoomBetLoading] = useState(false)
  const [simulateLoading, setSimulateLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'matches' | 'knockout' | 'table'>('matches')
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const [knockoutReleased, setKnockoutReleased] = useState(() => isKnockoutBetReleased())
  const [betStats, setBetStats] = useState<Record<string, {
    total: number
    counts: Record<string, number>
    avg_home: number | null
    avg_away: number | null
    scores_count: number
  }>>({})

  // Fetch bet stats for the room
  useEffect(() => {
    fetch(`/api/bets/stats?room_id=${room.id}`)
      .then(r => r.json())
      .then(json => { if (json.data) setBetStats(json.data) })
      .catch(() => {})
  }, [room.id, bets])

  useEffect(() => {
    const interval = setInterval(() => {
      setKnockoutReleased(isKnockoutBetReleased())
    }, 60 * 1000)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      fetch('/api/matches')
        .then(r => r.json())
        .then(json => {
          if (json.data) setAllMatches(json.data)
        })
        .catch(() => {})
    }, 90 * 1000)

    return () => clearInterval(interval)
  }, [])

  function toggleGroup(group: string) {
    setOpenGroups(prev => ({ ...prev, [group]: !prev[group] }))
  }

  // Group matches (só fase de grupos por enquanto)
  const grouped = useMemo(() => {
    const map: Record<string, Match[]> = {}
    allMatches
      .filter(m => (m.phase || '').toLowerCase() === 'group')
      .forEach(m => {
        const key = `Grupo ${m.group_label}`
        if (!map[key]) map[key] = []
        map[key].push(m)
      })
    return map
  }, [allMatches])

  const knockoutMatches = useMemo(() => {
    return allMatches.filter(m => (m.phase || '').toLowerCase() !== 'group')
  }, [allMatches])

  // Teams per group (for table betting)
  const groupTeams = useMemo(() => {
    const map: Record<string, GroupTeamInfo[]> = {}
    allMatches
      .filter(m => (m.phase || '').toLowerCase() === 'group' && m.group_label)
      .forEach(m => {
        const g = m.group_label!
        if (!map[g]) map[g] = []
        const addTeam = (abbr: string, name: string, flag: string) => {
          if (abbr && !map[g].find(t => t.abbr === abbr)) {
            map[g].push({ abbr, name, flag })
          }
        }
        addTeam(m.home_abbr, m.home_team, m.home_flag)
        addTeam(m.away_abbr, m.away_team, m.away_flag)
      })
    return map
  }, [allMatches])

  const sortedGroupLabels = useMemo(() =>
    Object.keys(groupTeams).sort(), [groupTeams])

  const groupTop3ByLabel = useMemo(() => {
    const result: Record<string, string[] | undefined> = {}

    sortedGroupLabels.forEach((label) => {
      const groupMatches = allMatches.filter(
        (match) => (match.phase || '').toLowerCase() === 'group' && match.group_label === label
      )

      const isFinished =
        groupMatches.length > 0 &&
        groupMatches.every((match) => match.home_score != null && match.away_score != null)

      if (!isFinished) {
        result[label] = undefined
        return
      }

      const table = new Map<string, { pts: number; gd: number; gf: number }>()
      const ensureTeam = (abbr: string) => {
        if (!table.has(abbr)) {
          table.set(abbr, { pts: 0, gd: 0, gf: 0 })
        }
        return table.get(abbr)!
      }

      groupMatches.forEach((match) => {
        const home = ensureTeam(match.home_abbr)
        const away = ensureTeam(match.away_abbr)

        const homeScore = Number(match.home_score)
        const awayScore = Number(match.away_score)

        home.gf += homeScore
        away.gf += awayScore
        home.gd += homeScore - awayScore
        away.gd += awayScore - homeScore

        if (homeScore > awayScore) home.pts += 3
        else if (awayScore > homeScore) away.pts += 3
        else {
          home.pts += 1
          away.pts += 1
        }
      })

      result[label] = Array.from(table.entries())
        .sort((a, b) => {
          if (b[1].pts !== a[1].pts) return b[1].pts - a[1].pts
          if (b[1].gd !== a[1].gd) return b[1].gd - a[1].gd
          if (b[1].gf !== a[1].gf) return b[1].gf - a[1].gf
          return a[0].localeCompare(b[0])
        })
        .slice(0, 3)
        .map(([abbr]) => abbr)
    })

    return result
  }, [allMatches, sortedGroupLabels])

  const teamMetaByAbbr = useMemo(() => {
    const map: Record<string, { name: string; flag: string }> = {}

    Object.values(groupTeams).forEach(teams => {
      teams.forEach(team => {
        if (!team.abbr) return
        map[team.abbr] = { name: team.name, flag: team.flag }
      })
    })

    return map
  }, [groupTeams])

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

  async function handleGroupBet(groupLabel: string, data: {
    first_team: string
    second_team: string
    third_team: string
  }) {
    const res = await fetch('/api/group-bets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room_id: room.id, group_label: groupLabel, ...data }),
    })
    const json = await res.json()
    if (!res.ok) { toast.error(json.error || 'Erro ao salvar palpite'); return }

    setGroupBets(prev => ({ ...prev, [groupLabel]: json.data }))
    toast.success('✅ Palpite de tabela confirmado!')
  }

  async function handleSimulateNow() {
    setSimulateLoading(true)
    try {
      const [matchesRes, betsRes, groupBetsRes] = await Promise.all([
        fetch('/api/matches'),
        fetch(`/api/bets?room_id=${room.id}`),
        fetch(`/api/group-bets?room_id=${room.id}`),
      ])

      const [matchesJson, betsJson, groupBetsJson] = await Promise.all([
        matchesRes.json(),
        betsRes.json(),
        groupBetsRes.json(),
      ])

      if (matchesJson.data) setAllMatches(matchesJson.data)
      if (betsJson.data) {
        setBets(Object.fromEntries((betsJson.data as Bet[]).map(b => [b.match_id, b])))
      }
      if (groupBetsJson.data) {
        setGroupBets(Object.fromEntries((groupBetsJson.data as GroupBet[]).map(b => [b.group_label, b])))
      }

      toast.success('🔄 Simulação atualizada!')
    } catch {
      toast.error('Erro ao atualizar simulação')
    } finally {
      setSimulateLoading(false)
    }
  }
   // Log para depuração
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

      <main className="min-h-screen overflow-x-hidden bg-field bg-grid pt-16">
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
                    { label: 'Tabela — 1 posição', pts: 2, icon: '📊' },
                    { label: 'Tabela — 2 posições', pts: 4, icon: '📊' },
                    { label: 'Tabela — 3 posições', pts: 10, icon: '🏆' },
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

            {/* RIGHT: Tabs + Content */}
            <div className="space-y-6 animate-fade-up-2">
              {/* Tab switcher */}
              <div className="flex border border-white/[0.08] rounded-xl overflow-hidden">
                <button
                  onClick={() => setActiveTab('matches')}
                  className={`flex-1 py-2.5 text-sm font-bold transition-all ${activeTab === 'matches' ? 'bg-green text-black' : 'text-white/40 hover:text-white'}`}
                >
                  ⚽ Jogos
                </button>
                <button
                  onClick={() => setActiveTab('knockout')}
                  className={`flex-1 py-2.5 text-sm font-bold transition-all ${activeTab === 'knockout' ? 'bg-green text-black' : 'text-white/40 hover:text-white'}`}
                >
                  🏁 Mata-mata
                </button>
                <button
                  onClick={() => setActiveTab('table')}
                  className={`flex-1 py-2.5 text-sm font-bold transition-all ${activeTab === 'table' ? 'bg-green text-black' : 'text-white/40 hover:text-white'}`}
                >
                  📊 Tabela
                </button>
              </div>

              {/* Matches tab */}
              {activeTab === 'matches' && (
                <div className="space-y-8">
                  {Object.entries(grouped).map(([group, groupMatches]) => {
                    const isOpen = openGroups[group] ?? false
                    const betCount = groupMatches.filter(m => bets[m.id]).length
                    const label = groupMatches[0]?.group_label
                    const teams = label ? groupTeams[label] || [] : []
                    return (
                      <div key={group}>
                        <button
                          onClick={() => toggleGroup(group)}
                          className="w-full flex items-center gap-3 mb-2 group cursor-pointer"
                        >
                          <span className="phase-badge">{group}</span>
                          <div className="flex items-center gap-1 flex-wrap">
                            {teams.map(t => (
                              <span key={t.abbr} className="text-sm" title={t.name}>{t.name} --</span>
                            ))}
                          </div>
                          <span className="text-[10px] text-muted whitespace-nowrap">
                            {betCount}/{groupMatches.length} palpites
                          </span>
                          <div className="flex-1 h-px bg-white/[0.06]" />
                          <span className={`text-muted text-xs transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                            ▼
                          </span>
                        </button>
                        {isOpen && (
                          <div className="space-y-3 animate-fade-up">
                            {groupMatches.map(match => (
                              <MatchCard
                                key={match.id}
                                match={match}
                                existingBet={bets[match.id]}
                                onBet={(data) => handleBet(match.id, data)}
                                betStats={betStats[match.id]}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Knockout tab */}
              {activeTab === 'knockout' && (
                <div className="space-y-4">
                  <p className="text-xs text-muted">
                    A chave é atualizada conforme os confrontos oficiais forem definidos ao longo da Copa.
                    Os palpites desta fase ficam liberados a partir de 27/06.
                  </p>
                  <KnockoutBracket
                    matches={knockoutMatches}
                    bets={bets}
                    groupBets={groupBets}
                    teamMetaByAbbr={teamMetaByAbbr}
                    onBet={handleBet}
                    onSimulateNow={handleSimulateNow}
                    simulateLoading={simulateLoading}
                    isReleased={knockoutReleased}
                    betStats={betStats}
                  />
                </div>
              )}

              {/* Table tab */}
              {activeTab === 'table' && (
                <div className="space-y-6">
                  <p className="text-xs text-muted">
                    Aposte em quem termina em 1º, 2º e 3º lugar de cada grupo.
                    Quanto mais posições acertar, mais pontos você ganha!
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {sortedGroupLabels.map(label => (
                      <GroupTableCard
                        key={label}
                        groupLabel={label}
                        teams={groupTeams[label]}
                        existingBet={groupBets[label]}
                        actualTop3={groupTop3ByLabel[label]}
                        onBet={(data: { first_team: string; second_team: string; third_team: string }) => handleGroupBet(label, data)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
