'use client'
// src/app/sala/[id]/SalaClient.tsx
import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Navbar from '@/components/ui/Navbar'
import AddCoinsModal from '@/components/ui/AddCoinsModal'
import MatchCard from '@/components/game/MatchCard'
import GroupTableCard from '../../../components/game/GroupTableCard'
import KnockoutBracket from '@/components/game/KnockoutBracket'
import AchievementsCard from '@/components/ui/AchievementsCard'
import type { User, Room, Match, Bet, LeaderboardEntry, GroupBet, GroupTeamInfo } from '@/types'
import { formatCoins, getAvatarColor, getAvatarTextColor, isKnockoutBetReleased } from '@/lib/utils'

// Lista de jogos que valem 2x pontos
// Formato: "HOME_ABBR-AWAY_ABBR" (qualquer ordem)
const DOUBLE_POINTS_MATCHES = [
  'COD-UZB', // RDC Democrática do Congo x Uzbequistão
  'UZB-COD', // Uzbequistão x RDC Democrática do Congo
  'CPV-KSA',
  'KSA-CPV',
  'IRN-NZL',
  'NZL-IRN',
  'AUT-JOR',
  'JOR-AUT',
  'JOR-ALG',
  'ALG-JOR',
  'BIH-QAT',
  'QAT-BIH',
  'USA-AUS',
  'AUS-USA',
]

// Sala que tem 2x habilitado
const DOUBLE_POINTS_ROOM_CODES = ['FY4CXF']

function isDoublePointsMatch(match: Match, roomCode: string): boolean {
  // Só aplica 2x se a sala for a sala especial
  if (!DOUBLE_POINTS_ROOM_CODES.includes(roomCode)) return false
  
  const code = `${match.home_abbr}-${match.away_abbr}`
  return DOUBLE_POINTS_MATCHES.includes(code)
}

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
  const [isLoadingMatches, setIsLoadingMatches] = useState(false)
  const [rankPhrase, setRankPhrase] = useState('')

  // Calcula resumo do desempenho do usuário na sala
  const roundSummary = useMemo(() => {
    const myEntry = leaderboard.find(e => e.is_me)
    const myPoints = myEntry?.total_points ?? 0
    const myRank = leaderboard.findIndex(e => e.is_me) + 1
    return { myPoints, myRank, totalPlayers: leaderboard.length }
  }, [leaderboard])

  // Seta frase após montagem no cliente para evitar erro de hidratação
  useEffect(() => {
    if (roundSummary.totalPlayers > 0) {
      setRankPhrase(rankPhrases(roundSummary.myRank, roundSummary.totalPlayers))
    }
  }, [roundSummary.myRank, roundSummary.totalPlayers])
  const [activeTab, setActiveTab] = useState<'matches' | 'knockout' | 'table'>('matches')
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const [groupRoundIndex, setGroupRoundIndex] = useState<Record<string, number>>({})
  const [knockoutReleased, setKnockoutReleased] = useState(() => isKnockoutBetReleased())
  const [betStats, setBetStats] = useState<Record<string, {
    total: number
    counts: Record<string, number>
    avg_home: number | null
    avg_away: number | null
    scores_count: number
  }>>({})
  const [previousPositions, setPreviousPositions] = useState<Record<string, number>>({})
  const [hasLeaderboardHistory, setHasLeaderboardHistory] = useState(false)
  const [previousGroupTablePositions, setPreviousGroupTablePositions] = useState<Record<string, Record<string, number>>>({})
  const [hasGroupTableHistory, setHasGroupTableHistory] = useState(false)
  const leaderboardSnapshotRef = useRef<Record<string, number>>({})
  const groupTableSnapshotRef = useRef<Record<string, Record<string, number>>>({})
  const snapshotUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  useEffect(() => {
    const currentPositions: Record<string, number> = {}
    leaderboard.forEach((entry, index) => {
      currentPositions[entry.user_id] = index
    })

    if (Object.keys(leaderboardSnapshotRef.current).length === 0) {
      leaderboardSnapshotRef.current = currentPositions
      setPreviousPositions(currentPositions)
      return
    }

    setHasLeaderboardHistory(true)
    setPreviousPositions(leaderboardSnapshotRef.current)

    if (snapshotUpdateTimeoutRef.current) clearTimeout(snapshotUpdateTimeoutRef.current)
    snapshotUpdateTimeoutRef.current = setTimeout(() => {
      leaderboardSnapshotRef.current = currentPositions
    }, 1500)
  }, [leaderboard])

  function toggleGroup(group: string) {
    setOpenGroups(prev => ({ ...prev, [group]: !prev[group] }))
  }

  function goToPrevRound(group: string, totalRounds: number) {
    setGroupRoundIndex(prev => {
      const current = prev[group] ?? 0
      const next = current <= 0 ? totalRounds - 1 : current - 1
      return { ...prev, [group]: next }
    })
  }

  function goToNextRound(group: string, totalRounds: number) {
    setGroupRoundIndex(prev => {
      const current = prev[group] ?? 0
      const next = current >= totalRounds - 1 ? 0 : current + 1
      return { ...prev, [group]: next }
    })
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

// Helper function to get head-to-head stats between two teams
  function getHeadToHeadStats(team1: string, team2: string, matches: Match[], bets: Record<string, Bet>) {
    const h2hMatches = matches.filter(m => 
      (m.home_abbr === team1 && m.away_abbr === team2) ||
      (m.home_abbr === team2 && m.away_abbr === team1)
    )
    
    if (h2hMatches.length === 0) return null
    
    let team1Pts = 0
    let team2Pts = 0
    let team1Gd = 0
    let team2Gd = 0
    let team1Gf = 0
    let team2Gf = 0
    
    h2hMatches.forEach(match => {
      let homeScore: number | null = null
      let awayScore: number | null = null
      
      if (match.home_score != null && match.away_score != null) {
        homeScore = Number(match.home_score)
        awayScore = Number(match.away_score)
      } else {
        const bet = bets[match.id]
        if (bet && bet.predicted_home != null && bet.predicted_away != null) {
          homeScore = Number(bet.predicted_home)
          awayScore = Number(bet.predicted_away)
        }
      }
      
      if (homeScore == null || awayScore == null) return
      
      const homeAbbr = match.home_abbr
      const awayAbbr = match.away_abbr
      
      if (homeAbbr === team1) {
        team1Gf += homeScore
        team2Gf += awayScore
        team1Gd += homeScore - awayScore
        team2Gd += awayScore - homeScore
        if (homeScore > awayScore) team1Pts += 3
        else if (awayScore > homeScore) team2Pts += 1
        else { team1Pts += 1; team2Pts += 1 }
      } else {
        team2Gf += homeScore
        team1Gf += awayScore
        team2Gd += homeScore - awayScore
        team1Gd += awayScore - homeScore
        if (homeScore > awayScore) team2Pts += 3
        else if (awayScore > homeScore) team1Pts += 1
        else { team1Pts += 1; team2Pts += 1 }
      }
    })
    
    return { team1Pts, team2Pts, team1Gd, team2Gd, team1Gf, team2Gf }
  }

// Teams per group (for table betting)
  // Normaliza keys para maiúsculas para garantir ordenação alfabética correta
  const groupTeams = useMemo(() => {
    const map: Record<string, GroupTeamInfo[]> = {}
    allMatches
      .filter(m => (m.phase || '').toLowerCase() === 'group' && m.group_label)
      .forEach(m => {
        const g = (m.group_label || '').toUpperCase()
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

// Ordena grupos alfabeticamente (A, B, C, D, ...)
  const sortedGroupLabels = useMemo(() =>
    Object.keys(groupTeams).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })), [groupTeams])

  const groupTop3ByLabel = useMemo(() => {
    const result: Record<string, string[] | undefined> = {}

    sortedGroupLabels.forEach((label) => {
      const groupLabelUpper = label.toUpperCase()
      const groupMatches = allMatches.filter(
        (match) => (match.phase || '').toLowerCase() === 'group' && (match.group_label || '').toUpperCase() === groupLabelUpper
      )

      if (groupMatches.length === 0) {
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

      let hasData = false

      groupMatches.forEach((match) => {
        ensureTeam(match.home_abbr)
        ensureTeam(match.away_abbr)

        let homeScore: number | null = null
        let awayScore: number | null = null

        if (match.home_score != null && match.away_score != null) {
          homeScore = Number(match.home_score)
          awayScore = Number(match.away_score)
        } else {
          const bet = bets[match.id]
          if (bet && bet.predicted_home != null && bet.predicted_away != null) {
            homeScore = Number(bet.predicted_home)
            awayScore = Number(bet.predicted_away)
          }
        }

        if (homeScore == null || awayScore == null) return
        hasData = true

        const home = table.get(match.home_abbr)!
        const away = table.get(match.away_abbr)!

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

      if (!hasData) {
        result[label] = undefined
        return
      }

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
  }, [allMatches, sortedGroupLabels, bets])

// Rank best third-place teams across all groups: pts > gd > gf
  // Uses actual results when available, falls back to user's predicted scores (bets)
  const bestThirdPlace = useMemo(() => {
    const thirdPlaceTeams: Array<{ group: string; abbr: string; pts: number; gd: number; gf: number }> = []

    sortedGroupLabels.forEach(label => {
      const groupLabelUpper = label.toUpperCase()
      const groupMatches = allMatches.filter(
        m => (m.phase || '').toLowerCase() === 'group' && (m.group_label || '').toUpperCase() === groupLabelUpper
      )
      if (groupMatches.length === 0) return

      const table = new Map<string, { pts: number; gd: number; gf: number }>()
      const ensureTeam = (abbr: string) => {
        if (!table.has(abbr)) table.set(abbr, { pts: 0, gd: 0, gf: 0 })
        return table.get(abbr)!
      }

      let hasData = false
      groupMatches.forEach(m => {
        ensureTeam(m.home_abbr)
        ensureTeam(m.away_abbr)

        // Use actual score if available, otherwise use user's predicted score
        let hScore: number | null = null
        let aScore: number | null = null

        if (m.home_score != null && m.away_score != null) {
          hScore = m.home_score
          aScore = m.away_score
        } else {
          const bet = bets[m.id]
          if (bet && bet.predicted_home != null && bet.predicted_away != null) {
            hScore = Number(bet.predicted_home)
            aScore = Number(bet.predicted_away)
          }
        }

        if (hScore == null || aScore == null) return
        hasData = true
        const home = table.get(m.home_abbr)!
        const away = table.get(m.away_abbr)!
        home.gf += hScore
        away.gf += aScore
        home.gd += hScore - aScore
        away.gd += aScore - hScore
        if (hScore > aScore) home.pts += 3
        else if (aScore > hScore) away.pts += 3
        else { home.pts += 1; away.pts += 1 }
      })

      if (!hasData) return

      const ranked = Array.from(table.entries())
        .sort((a, b) => {
          if (b[1].pts !== a[1].pts) return b[1].pts - a[1].pts
          if (b[1].gd !== a[1].gd) return b[1].gd - a[1].gd
          if (b[1].gf !== a[1].gf) return b[1].gf - a[1].gf
          return a[0].localeCompare(b[0])
        })

      if (ranked.length >= 3) {
        thirdPlaceTeams.push({
          group: label,
          abbr: ranked[2][0],
          pts: ranked[2][1].pts,
          gd: ranked[2][1].gd,
          gf: ranked[2][1].gf,
        })
      }
    })

    thirdPlaceTeams.sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts
      if (b.gd !== a.gd) return b.gd - a.gd
      if (b.gf !== a.gf) return b.gf - a.gf
      return a.group.localeCompare(b.group)
    })

    return thirdPlaceTeams.slice(0, 8)
}, [allMatches, sortedGroupLabels, bets])

  const groupTableRowsByLabel = useMemo(() => {
    const result: Record<string, Array<{ abbr: string; pts: number; gd: number; gf: number; played: number; wins: number; draws: number; losses: number }>> = {}

    sortedGroupLabels.forEach((label) => {
      const groupLabelUpper = label.toUpperCase()
      const groupMatches = allMatches.filter(
        (match) => (match.phase || '').toLowerCase() === 'group' && (match.group_label || '').toUpperCase() === groupLabelUpper
      )

      const table = new Map<string, { pts: number; gd: number; gf: number; played: number; wins: number; draws: number; losses: number }>()
      const ensureTeam = (abbr: string) => {
        if (!table.has(abbr)) {
          table.set(abbr, { pts: 0, gd: 0, gf: 0, played: 0, wins: 0, draws: 0, losses: 0 })
        }
        return table.get(abbr)!
      }

      groupMatches.forEach((match) => {
        const home = ensureTeam(match.home_abbr)
        const away = ensureTeam(match.away_abbr)

        let homeScore: number | null = null
        let awayScore: number | null = null

        if (match.home_score != null && match.away_score != null) {
          homeScore = Number(match.home_score)
          awayScore = Number(match.away_score)
        } else {
          const bet = bets[match.id]
          if (bet && bet.predicted_home != null && bet.predicted_away != null) {
            homeScore = Number(bet.predicted_home)
            awayScore = Number(bet.predicted_away)
          }
        }

        if (homeScore == null || awayScore == null) return

        home.played += 1
        away.played += 1
        home.gf += homeScore
        away.gf += awayScore
        home.gd += homeScore - awayScore
        away.gd += awayScore - homeScore

        if (homeScore > awayScore) {
          home.pts += 3
          home.wins += 1
          away.losses += 1
        } else if (awayScore > homeScore) {
          away.pts += 3
          away.wins += 1
          home.losses += 1
        } else {
          home.pts += 1
          away.pts += 1
          home.draws += 1
          away.draws += 1
        }
      })

result[label] = Array.from(table.entries())
        .map(([abbr, data]) => ({ abbr, ...data }))
        .sort((a, b) => {
          const teamA = a.abbr, teamB = b.abbr
          
          // 1. Points
          if (b.pts !== a.pts) return b.pts - a.pts
          
          // 2. Goal difference
          if (b.gd !== a.gd) return b.gd - a.gd
          
          // 3. Goals scored
          if (b.gf !== a.gf) return b.gf - a.gf
          
          // 4-6. Head-to-head criteria (only if they played against each other)
          const h2h = getHeadToHeadStats(teamA, teamB, groupMatches, bets)
          if (h2h) {
            // Head-to-head points
            if (h2h.team2Pts !== h2h.team1Pts) return h2h.team2Pts - h2h.team1Pts
            // Head-to-head goal difference
            if (h2h.team2Gd !== h2h.team1Gd) return h2h.team2Gd - h2h.team1Gd
            // Head-to-head goals scored
            if (h2h.team2Gf !== h2h.team1Gf) return h2h.team2Gf - h2h.team1Gf
          }
          
          // Final tiebreaker: alphabetical
          return teamA.localeCompare(teamB)
        })
    })

    return result
  }, [allMatches, sortedGroupLabels, bets])

  useEffect(() => {
    const currentGroupPositions: Record<string, Record<string, number>> = {}

    sortedGroupLabels.forEach((label) => {
      const rows = groupTableRowsByLabel[label] || []
      const positions: Record<string, number> = {}
      rows.forEach((row, index) => {
        positions[row.abbr] = index
      })
      currentGroupPositions[label] = positions
    })

    if (Object.keys(groupTableSnapshotRef.current).length === 0) {
      groupTableSnapshotRef.current = currentGroupPositions
      setPreviousGroupTablePositions(currentGroupPositions)
      return
    }

    setHasGroupTableHistory(true)
    setPreviousGroupTablePositions(groupTableSnapshotRef.current)

    if (snapshotUpdateTimeoutRef.current) clearTimeout(snapshotUpdateTimeoutRef.current)
    snapshotUpdateTimeoutRef.current = setTimeout(() => {
      groupTableSnapshotRef.current = currentGroupPositions
    }, 1500)
  }, [groupTableRowsByLabel, sortedGroupLabels])

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

    // Atualiza bets imediatamente para a tabela atualizar em tempo real
    setBets(prev => ({ ...prev, [matchId]: json.data }))
    
    // Marca o grupo como aberto para mostrar a tabela atualizada
    const match = allMatches.find(m => m.id === matchId)
    if (match?.group_label) {
      const groupKey = `Grupo ${match.group_label}`
      setOpenGroups(prev => ({ ...prev, [groupKey]: true }))
    }
    
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
  function rankPhrases(rank: number, total: number): string {
    const phrases = [
      // Último lugar
      { maxPct: 0.1, phrases: [
        'Você é o pior apostador da história pior que bilas promax 📉',
        'Parece que você chutou no escuro... e errou tudo 🦇',
        'Parabéns, você conseguiu ser o último! Você é pior que bilinhas👏',
        'Até um palpite aleatório seria melhor que isso 🤡',
        "Você é pior que o zahree de Vitoguro"
      ]},
      // Lá embaixo
      { maxPct: 0.3, phrases: [
        'Wow, você conseguiu passar de ruim pra "menos pior" 🎉',
        'Se isso fosse prova, você teria repetido de ano 📚',
        'Tá quase tão ruim quanto o Ragebait Felipe... quase 🥴',
        'Pelo menos não é o último? Ou talvez seja questão de tempo ⏳',
      ]},
      // Meio da tabela
      { maxPct: 0.6, phrases: [
        'Meio de tabela. O famoso "tá dando pro gasto" 🤷',
        'Nem bom, nem ruim... medíocre. Mas com carinho 💅',
        'Você está na zona da medíocridade, confortável aí? 🛋️',
        'Se futebol fosse música, você seria um Luan Santana Mediano 🎸',
      ]},
      // Quase no topo
      { maxPct: 0.85, phrases: [
        'Quase lá!',
        'Tá chegando perto, mas ainda falta muito 🌅',
        'Você até que tá bem... pra quem não sabe nada de futebol ⚽',
        'Respeitável. Mas respeito não ganha campeonato 🏆',
      ]},
      // Topo
      { maxPct: 1, phrases: [
        'Olha o paredão! Alguém estudou os jogos 📚🧠',
        'Você é o Pelé das apostas! Ou pelo menos o KAUE DAS APOSTAS... 🐐',
        'Se virar técnico, a seleção não perde uma 🇧🇷🏆',
        'Desconfio que você é o próprio ELIEL LIRA das apostas 👀',
      ]},
    ]

    const pct = rank / total
    for (const tier of phrases) {
      if (pct <= tier.maxPct) {
        return tier.phrases[Math.floor(Math.random() * tier.phrases.length)]
      }
    }

    return `Você está em ${rank}º de ${total}`
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

          <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr_280px] gap-6">

            {/* LEFT: Regras + Aposta + Conquistas (1º no mobile, 1ª coluna no desktop) */}
            <div className="space-y-4 animate-fade-up-1 order-1 xl:order-1">
              {/* Pontuação da sala */}
              <div className="card p-5">
                <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-blue to-green" />
                <p className="text-xs font-bold text-muted uppercase tracking-widest mb-3">⚙️ Regras da sala</p>
                <div className="space-y-1.5">
                  {[
                    { label: 'Placar exato', pts: room.pts_exact, icon: '🎯' },
                    { label: 'Vencedor certo', pts: room.pts_winner, icon: '✅' },
                    { label: 'Tabela — 1 posição ', pts: 2, icon: '📊' },
                    { label: 'Tabela — 2 posições ', pts: 4, icon: '📊' },
                    { label: 'Tabela — 3 posições ', pts: 10, icon: '🏆' },
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

             

              <AchievementsCard
                leaderboard={leaderboard}
                bets={bets}
                groupBets={groupBets}
                allMatches={allMatches}
                coinsInRoom={coinsInRoom}
                myRank={roundSummary.myRank}
                previousRank={previousPositions[currentUser.id] != null ? previousPositions[currentUser.id] + 1 : null}
              />
            </div>

            {/* CENTER: Match content (tabs + games) — último no mobile, centro no desktop */}
            <div className="space-y-6 animate-fade-up-2 order-3 xl:order-2">
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
                  {sortedGroupLabels.map((label) => {
                    const group = `Grupo ${label}`
                    const groupMatches = grouped[group] || []
                    const isOpen = openGroups[group] ?? false
                    const betCount = groupMatches.filter(m => bets[m.id]).length
                    const teams = groupTeams[label] || []
                    const rounds: Match[][] = []
                    for (let i = 0; i < groupMatches.length; i += 2) {
                      rounds.push(groupMatches.slice(i, i + 2))
                    }
                    const totalRounds = rounds.length || 1
                    const currentRound = Math.min(groupRoundIndex[group] ?? 0, totalRounds - 1)
                    const currentRoundMatches = rounds[currentRound] || []
                    const tableRows = groupTableRowsByLabel[label] || []
                    const groupPreviousPositions = previousGroupTablePositions[label] || {}

                    return (
                      <div key={group}>
                        <button
                          onClick={() => toggleGroup(group)}
                          className="w-full flex items-center gap-3 mb-2 group cursor-pointer"
                        >
                          <span className="phase-badge">{group}</span>
                          <div className="flex items-center gap-1 flex-wrap">
                            {teams.map(t => (
                              <span key={t.abbr} className="text-sm" title={t.name}>{t.flag} {t.name} —</span>
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
                          <div className="space-y-4 animate-fade-up">
                            {/* Tabela em linha (horizontal) */}
                            <div className="card overflow-hidden">
                              <div className="h-[2px] bg-white/[0.06]" />
                              <div className="p-3 overflow-x-auto">
                                <div className="grid grid-cols-[40px_1fr_repeat(7,40px)] gap-1 text-[10px] font-bold text-muted mb-2 px-1 min-w-max">
                                  <span>#</span>
                                  <span>Seleção</span>
                                  <span className="text-center">P</span>
                                  <span className="text-center">J</span>
                                  <span className="text-center">V</span>
                                  <span className="text-center">E</span>
                                  <span className="text-center">D</span>
                                  <span className="text-center">SG</span>
                                  <span className="text-center">GF</span>
                                </div>
                                <div className="gap-2 min-w-max">
                                  {tableRows.map((row, idx) => {
                                    const teamMeta = teamMetaByAbbr[row.abbr]
                                    const prevGroupPosition = groupPreviousPositions[row.abbr]
                                    let groupMovement: { icon: string; className: string; title: string } | null = null
                                    if (hasGroupTableHistory && prevGroupPosition != null) {
                                      if (idx < prevGroupPosition) {
                                        groupMovement = { icon: '⬆️', className: 'text-green', title: 'Subiu na classificação do grupo' }
                                      } else if (idx > prevGroupPosition) {
                                        groupMovement = { icon: '⬇️', className: 'text-red', title: 'Desceu na classificação do grupo' }
                                      } else {
                                        groupMovement = { icon: '➖', className: 'text-muted', title: 'Permaneceu na mesma posição do grupo' }
                                      }
                                    }
                                    return (
                                      <div key={row.abbr} className="grid grid-cols-[40px_1fr_repeat(7,40px)] gap-1 items-center px-2 py-2 rounded-lg bg-white/[0.02] min-w-[320px]">
                                        <span className="text-sm font-bold">{idx + 1}º</span>
                                        <span className="flex items-center gap-1">
                                          <span>{teamMeta?.flag} {teamMeta?.name}</span>
                                          {groupMovement && (
                                            <span className={`text-xs ${groupMovement.className}`} title={groupMovement.title}>
                                              {groupMovement.icon}
                                            </span>
                                          )}
                                        </span>
                                        <span className="text-center text-sm">{row?.pts ?? 0}</span>
                                        <span className="text-center text-sm">{row?.played ?? 0}</span>
                                        <span className="text-center text-sm">{row?.wins ?? 0}</span>
                                        <span className="text-center text-sm">{row?.draws ?? 0}</span>
                                        <span className="text-center text-sm">{row?.losses ?? 0}</span>
                                        <span className="text-center text-sm">{row?.gd ?? 0}</span>
                                        <span className="text-center text-sm">{row?.gf ?? 0}</span>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            </div>

                            {/* Navegação por rodada + jogos */}
                            <div className="space-y-3">
                              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                                <button
                                  type="button"
                                  onClick={() => goToPrevRound(group, totalRounds)}
                                  className="text-2xl text-muted hover:text-white transition-colors px-2"
                                  aria-label={`Rodada anterior ${group}`}
                                >
                                  ‹
                                </button>
                                <div className="text-center">
                                  <p className="text-sm font-bold"> {currentRound + 1}ª Rodada</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => goToNextRound(group, totalRounds)}
                                  className="text-2xl text-green hover:text-green/80 transition-colors px-2"
                                  aria-label={`Próxima rodada ${group}`}
                                >
                                  ›
                                </button>
                              </div>
                              <div className="space-y-3">
                                {currentRoundMatches.map(match => (
                                  <MatchCard
                                    key={match.id}
                                    match={match}
                                    existingBet={bets[match.id]}
                                    onBet={(data) => handleBet(match.id, data)}
                                    betStats={betStats[match.id]}
                                    isDoublePoints={isDoublePointsMatch(match, room.code)}
                                  />
                                ))}
                              </div>
                            </div>
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
                    bestThirdPlace={bestThirdPlace}
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

            {/* RIGHT: Performance + Ranking — 2º no mobile, 3ª coluna no desktop */}
            <div className="space-y-4 animate-fade-up-1 order-2 xl:order-3">
              {/* Sua Performance */}
              <div className="card p-5 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-green to-emerald-400" />
                <p className="text-xs font-bold text-muted uppercase tracking-widest mb-4">🎯 Sua Performance</p>
                <div className="flex items-center justify-between gap-4 mb-3">
                  <div className="flex-1 text-center">
                    <div className="text-3xl font-black text-green font-mono">{roundSummary.myPoints}</div>
                    <div className="text-[10px] text-muted uppercase tracking-widest mt-1">pontos</div>
                  </div>
                  <div className="w-px h-12 bg-white/[0.08]" />
                  <div className="flex-1 text-center">
                    <div className="text-3xl font-black text-gold font-mono">#{roundSummary.myRank}º</div>
                    <div className="text-[10px] text-muted uppercase tracking-widest mt-1">posição</div>
                  </div>
                </div>
                <p className="text-center text-xs font-bold text-green/80 italic mt-1 min-h-[1em]">
                  {rankPhrase}
                </p>
              </div>

              {/* Leaderboard */}
              <div className="card p-5 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-gold to-red" />
                <p className="text-xs font-bold text-muted uppercase tracking-widest mb-4">🏆 Ranking</p>
                <div className="space-y-1">
                  {leaderboard.map((entry, i) => {
                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`
                    const prevPosition = previousPositions[entry.user_id]
                    let movementIndicator: { icon: string; className: string; title: string } | null = null
                    if (hasLeaderboardHistory && prevPosition != null) {
                      if (i < prevPosition) {
                        movementIndicator = { icon: '⬆️', className: 'text-green', title: 'Subiu no ranking' }
                      } else if (i > prevPosition) {
                        movementIndicator = { icon: '⬇️', className: 'text-red', title: 'Desceu no ranking' }
                      } else {
                        movementIndicator = { icon: '➖', className: 'text-muted', title: 'Permaneceu na mesma posição' }
                      }
                    }
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
                        {movementIndicator && (
                          <span className={`text-sm ${movementIndicator.className}`} title={movementIndicator.title}>
                            {movementIndicator.icon}
                          </span>
                        )}
                        <span className="font-mono font-bold text-green text-sm">{entry.total_points}pts</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
