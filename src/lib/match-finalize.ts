import type { SupabaseClient } from '@supabase/supabase-js'

interface MatchRow {
  id: string
  status: string
  home_abbr: string
  away_abbr: string
}

interface BetRow {
  id: string
  room_id: string
  user_id: string
  predicted_home: number
  predicted_away: number
}

interface RoomPointsRow {
  id: string
  pts_exact: number
  pts_winner: number
}

interface RoomMemberPointsRow {
  total_points: number
}

function qualifierFromScore(homeScore: number, awayScore: number, homeAbbr: string, awayAbbr: string): string {
  const normalizedHome = homeAbbr?.trim() || 'HOME'
  const normalizedAway = awayAbbr?.trim() || 'AWAY'

  if (homeScore > awayScore) return normalizedHome
  if (awayScore > homeScore) return normalizedAway
  return 'DRAW'
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
    .select('id, status, home_abbr, away_abbr')
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
    .select('id, room_id, user_id, predicted_home, predicted_away')
    .eq('match_id', matchId)
    .returns<BetRow[]>()

  if (!bets || bets.length === 0) {
    return {
      betsProcessed: 0,
      qualifier: realQualifier,
    }
  }

  const roomIds = Array.from(new Set(bets.map((bet) => bet.room_id)))
  const { data: rooms } = await db
    .from('rooms')
    .select('id, pts_exact, pts_winner')
    .in('id', roomIds)
    .returns<RoomPointsRow[]>()

  const roomMap: Record<string, RoomPointsRow> = {}
  rooms?.forEach((room) => {
    roomMap[room.id] = room
  })

  for (const bet of bets) {
    const room = roomMap[bet.room_id]
    if (!room) continue

    let points = 0

    if (bet.predicted_home === homeScore && bet.predicted_away === awayScore) {
      points += room.pts_exact
    }

    const predictedWinner = qualifierFromScore(
      bet.predicted_home,
      bet.predicted_away,
      match.home_abbr,
      match.away_abbr
    )

    if (predictedWinner === realQualifier) {
      points += room.pts_winner
    }

    await db
      .from('bets')
      .update({ points_earned: points })
      .eq('id', bet.id)

    if (points > 0) {
      const { data: member } = await db
        .from('room_members')
        .select('total_points')
        .eq('room_id', bet.room_id)
        .eq('user_id', bet.user_id)
        .single<RoomMemberPointsRow>()

      if (member) {
        await db
          .from('room_members')
          .update({ total_points: member.total_points + points })
          .eq('room_id', bet.room_id)
          .eq('user_id', bet.user_id)
      }
    }
  }

  return {
    betsProcessed: bets.length,
    qualifier: realQualifier,
  }
}