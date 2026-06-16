import type { SupabaseClient } from '@supabase/supabase-js'

// Sala que tem 2x habilitado
const DOUBLE_POINTS_ROOM_CODES = ['FY4CXF']

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

function isDoublePointsMatch(homeAbbr: string, awayAbbr: string, roomCode: string): boolean {
  // Só aplica 2x se a sala for a sala especial
  if (!DOUBLE_POINTS_ROOM_CODES.includes(roomCode)) return false
  
  const code = `${homeAbbr}-${awayAbbr}`
  return DOUBLE_POINTS_MATCHES.includes(code)
}

interface MatchRow {
  id: string
  status: string
  phase: string
  group_label: string | null
  home_abbr: string
  away_abbr: string
}

interface BetRow {
  id: string
  room_id: string
  user_id: string
  predicted_home: number
  predicted_away: number
  predicted_qualifier: string | null
}

interface RoomPointsRow {
  id: string
  code: string
  pts_exact: number
  pts_winner: number
}

interface GroupMatchRow {
  status: string
  home_abbr: string
  away_abbr: string
  home_score: number | null
  away_score: number | null
}

interface GroupBetRow {
  id: string
  room_id: string
  user_id: string
  first_team: string
  second_team: string
  third_team: string
}

interface RoomMemberRow {
  user_id: string
}

interface BetPointsRow {
  user_id: string
  points_earned: number | null
}

interface GroupBetPointsRow {
  user_id: string
  points_earned: number | null
}

function groupTablePointsFromSequence(isFirstCorrect: boolean, isSecondCorrect: boolean, isThirdCorrect: boolean): number {
  const correctCount = [isFirstCorrect, isSecondCorrect, isThirdCorrect].filter(Boolean).length

  if (correctCount === 1) return 2
  if (correctCount === 2) return 4
  if (correctCount === 3) return 10
  return 0
}

function qualifierFromScore(homeScore: number, awayScore: number, homeAbbr: string, awayAbbr: string): string {
  const normalizedHome = homeAbbr?.trim() || 'HOME'
  const normalizedAway = awayAbbr?.trim() || 'AWAY'

  if (homeScore > awayScore) return normalizedHome
  if (awayScore > homeScore) return normalizedAway
  return 'DRAW'
}

function buildGroupRanking(matches: GroupMatchRow[]): string[] {
  const table = new Map<string, { pts: number; gd: number; gf: number }>()

  const ensureTeam = (abbr: string) => {
    if (!table.has(abbr)) {
      table.set(abbr, { pts: 0, gd: 0, gf: 0 })
    }
    return table.get(abbr)!
  }

  for (const match of matches) {
    const home = ensureTeam(match.home_abbr)
    const away = ensureTeam(match.away_abbr)

    if (match.home_score == null || match.away_score == null) continue

    home.gf += match.home_score
    away.gf += match.away_score
    home.gd += match.home_score - match.away_score
    away.gd += match.away_score - match.home_score

    if (match.home_score > match.away_score) {
      home.pts += 3
    } else if (match.away_score > match.home_score) {
      away.pts += 3
    } else {
      home.pts += 1
      away.pts += 1
    }
  }

  return Array.from(table.entries())
    .sort((a, b) => {
      if (b[1].pts !== a[1].pts) return b[1].pts - a[1].pts
      if (b[1].gd !== a[1].gd) return b[1].gd - a[1].gd
      if (b[1].gf !== a[1].gf) return b[1].gf - a[1].gf
      return a[0].localeCompare(b[0])
    })
    .map(([abbr]) => abbr)
}

/**
 * Deduplica uma lista de apostas mantendo apenas a mais recente por (room_id, user_id).
 * Assume que registros com id maior são mais recentes.
 */
function deduplicateBetsByUser<T extends { id: string; room_id: string; user_id: string }>(bets: T[]): T[] {
  const latest = new Map<string, T>()
  for (const bet of bets) {
    const key = `${bet.room_id}:${bet.user_id}`
    const existing = latest.get(key)
    if (!existing || bet.id > existing.id) {
      latest.set(key, bet)
    }
  }
  return Array.from(latest.values())
}

async function recalcRoomTotals(db: SupabaseClient, roomIds: string[]) {
  if (roomIds.length === 0) return

  for (const roomId of roomIds) {
    const { data: members } = await db
      .from('room_members')
      .select('user_id, base_points') // ← troca total_points por base_points
      .eq('room_id', roomId)
      .returns<Array<RoomMemberRow & { base_points: number | null }>>()

    if (!members || members.length === 0) continue

    const { data: betPoints } = await db
      .from('bets')
      .select('user_id, points_earned')
      .eq('room_id', roomId)
      .not('points_earned', 'is', null)
      .returns<BetPointsRow[]>()

    const { data: groupPoints } = await db
      .from('group_bets')
      .select('user_id, points_earned')
      .eq('room_id', roomId)
      .not('points_earned', 'is', null)
      .returns<GroupBetPointsRow[]>()

    const totals = new Map<string, number>()
    // ← inicializa já com o base_points de cada membro
    members.forEach((member) => totals.set(member.user_id, member.base_points ?? 0))

    betPoints?.forEach((row) => {
      if (row.points_earned == null) return
      totals.set(row.user_id, (totals.get(row.user_id) || 0) + row.points_earned)
    })

    groupPoints?.forEach((row) => {
      if (row.points_earned == null) return
      totals.set(row.user_id, (totals.get(row.user_id) || 0) + row.points_earned)
    })

    for (const member of members) {
      await db
        .from('room_members')
        .update({ total_points: totals.get(member.user_id) || 0 })
        .eq('room_id', roomId)
        .eq('user_id', member.user_id)
    }
  }
}

export async function finalizeMatchAndScore(
  db: SupabaseClient,
  matchId: string,
  homeScore: number,
  awayScore: number,
  options?: { allowAlreadyFinished?: boolean }
) {
  const { data: match } = await db
    .from('matches')
    .select('id, status, phase, group_label, home_abbr, away_abbr')
    .eq('id', matchId)
    .single<MatchRow>()

  if (!match) {
    throw new Error('Jogo não encontrado')
  }

  if (match.status === 'finished' && !options?.allowAlreadyFinished) {
    throw new Error('Jogo já finalizado')
  }

  const realQualifier = qualifierFromScore(homeScore, awayScore, match.home_abbr, match.away_abbr)

  await db
    .from('matches')
    .update({
      home_score: homeScore,
      away_score: awayScore,
      qualifier: realQualifier,
      status: 'finished',
    })
    .eq('id', matchId)

  const { data: bets } = await db
    .from('bets')
    .select('id, room_id, user_id, predicted_home, predicted_away, predicted_qualifier')
    .eq('match_id', matchId)
    .returns<BetRow[]>()

  const rawBetsList = bets || []

  // Deduplicar: manter apenas a aposta mais recente por (room_id, user_id)
  const betsList = deduplicateBetsByUser(rawBetsList)

  // Zerar points_earned das bets duplicadas descartadas para não contarem no total da sala
  const keptIds = new Set(betsList.map((b) => b.id))
  const discardedBets = rawBetsList.filter((b) => !keptIds.has(b.id))
  for (const discarded of discardedBets) {
    await db
      .from('bets')
      .update({ points_earned: null })
      .eq('id', discarded.id)
  }

  const roomIds = Array.from(new Set(betsList.map((bet) => bet.room_id)))
  const { data: rooms } = await db
    .from('rooms')
    .select('id, code, pts_exact, pts_winner')
    .in('id', roomIds)
    .returns<RoomPointsRow[]>()

  const roomMap: Record<string, RoomPointsRow> = {}
  rooms?.forEach((room) => {
    roomMap[room.id] = room
  })

  for (const bet of betsList) {
    const room = roomMap[bet.room_id]
    if (!room) continue

    const predictedHome = Number(bet.predicted_home)
    const predictedAway = Number(bet.predicted_away)
    const realHome = Number(homeScore)
    const realAway = Number(awayScore)

    const winnerFromScore = qualifierFromScore(
      predictedHome,
      predictedAway,
      match.home_abbr,
      match.away_abbr
    )

    const winnerPick = bet.predicted_qualifier ?? winnerFromScore

    let points = 0
    if (predictedHome === realHome && predictedAway === realAway) {
      points = room.pts_exact + room.pts_winner
    } else if (winnerPick === realQualifier) {
      points = room.pts_winner
    }

// Aplicar multiplicador 2x para jogos especiais
    const is2x = isDoublePointsMatch(match.home_abbr, match.away_abbr, room.code)
    console.log(`[DEBUG] Jogo ${match.home_abbr}-${match.away_abbr}, Sala ${room.code}, 2x: ${is2x}, pts antes: ${points}`)
    if (is2x) {
      points = points * 2
      console.log(`[DEBUG] pts depois do 2x: ${points}`)
    }

    await db
      .from('bets')
      .update({ points_earned: points })
      .eq('id', bet.id)
  }

  const roomIdsToRecalc = new Set<string>(roomIds)

  if (match.phase === 'group' && match.group_label) {
    const { data: groupMatches } = await db
      .from('matches')
      .select('status, home_abbr, away_abbr, home_score, away_score')
      .eq('phase', 'group')
      .eq('group_label', match.group_label)
      .returns<GroupMatchRow[]>()

    const isGroupFinished =
      !!groupMatches &&
      groupMatches.length > 0 &&
      groupMatches.every(
        (groupMatch) =>
          groupMatch.status === 'finished' &&
          groupMatch.home_score != null &&
          groupMatch.away_score != null
      )

    if (isGroupFinished && groupMatches) {
      const ranking = buildGroupRanking(groupMatches)
      const top1 = ranking[0]
      const top2 = ranking[1]
      const top3 = ranking[2]

      const { data: groupBets } = await db
        .from('group_bets')
        .select('id, room_id, user_id, first_team, second_team, third_team')
        .eq('group_label', match.group_label)
        .returns<GroupBetRow[]>()

      const rawGroupBets = groupBets || []

      // Deduplicar palpites de grupo: manter apenas o mais recente por (room_id, user_id)
      const deduplicatedGroupBets = deduplicateBetsByUser(rawGroupBets)

      // Zerar points_earned dos palpites de grupo duplicados descartados
      const keptGroupIds = new Set(deduplicatedGroupBets.map((b) => b.id))
      const discardedGroupBets = rawGroupBets.filter((b) => !keptGroupIds.has(b.id))
      for (const discarded of discardedGroupBets) {
        await db
          .from('group_bets')
          .update({ points_earned: null })
          .eq('id', discarded.id)
      }

      const groupRoomIds = Array.from(new Set(deduplicatedGroupBets.map((bet) => bet.room_id)))
      if (groupRoomIds.length > 0) {
        const { data: groupRooms } = await db
          .from('rooms')
          .select('id')
          .in('id', groupRoomIds)
          .returns<Array<{ id: string }>>()

        const groupRoomSet = new Set<string>()
        groupRooms?.forEach((room) => groupRoomSet.add(room.id))

        for (const groupBet of deduplicatedGroupBets) {
          if (!groupRoomSet.has(groupBet.room_id)) continue

          const isFirstCorrect = groupBet.first_team === top1
          const isSecondCorrect = groupBet.second_team === top2
          const isThirdCorrect = groupBet.third_team === top3

          const points = groupTablePointsFromSequence(isFirstCorrect, isSecondCorrect, isThirdCorrect)

          await db
            .from('group_bets')
            .update({ points_earned: points })
            .eq('id', groupBet.id)

          roomIdsToRecalc.add(groupBet.room_id)
        }
      }
    }
  }

  await recalcRoomTotals(db, Array.from(roomIdsToRecalc))

  return {
    betsProcessed: betsList.length,
    qualifier: realQualifier,
  }
}