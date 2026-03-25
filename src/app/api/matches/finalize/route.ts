// src/app/api/matches/finalize/route.ts
// Finaliza um jogo e calcula pontos de todas as apostas
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  

  const { match_id, home_score, away_score } = await req.json()
  
  if (!match_id || home_score == null || away_score == null) {
    return NextResponse.json({ error: 'match_id, home_score e away_score obrigatórios' }, { status: 400 })
  }

  const db = supabaseAdmin()

  // Get match
  const { data: match } = await db
    .from('matches')
    .select('*')
    .eq('id', match_id)
    .single()

  if (!match) return NextResponse.json({ error: 'Jogo não encontrado' }, { status: 404 })
  if (match.status === 'finished') {
    return NextResponse.json({ error: 'Jogo já finalizado' }, { status: 400 })
  }

  // Determine real qualifier
  const realQualifier =
    home_score > away_score ? match.home_abbr :
    away_score > home_score ? match.away_abbr :
    'DRAW'

  // Update match as finished
  const { data: updatedMatch, error } = await db
    .from('matches')
    .update({
      home_score,
      away_score,
      qualifier: realQualifier,
      status: 'finished',
    })
    .eq('id', match_id)
    
  // Get ALL bets for this match (across all rooms)
  const { data: bets } = await db
    .from('bets')
    .select('id, room_id, user_id, predicted_home, predicted_away, predicted_qualifier')
    .eq('match_id', match_id)

  if (!bets || bets.length === 0) {
    return NextResponse.json({ data: { message: 'Jogo finalizado, sem apostas.' } })
  }

  // Get all rooms that have bets on this match (to know pts values)
  const roomIds = Array.from(new Set(bets.map(b => b.room_id)))
  const { data: rooms } = await db
    .from('rooms')
    .select('id, pts_exact, pts_winner')
    .in('id', roomIds)

  const roomMap: Record<string, { pts_exact: number; pts_winner: number }> = {}
  rooms?.forEach(r => { roomMap[r.id] = r })

  // Calculate points for each bet
  for (const bet of bets) {
    const room = roomMap[bet.room_id]
    if (!room) continue

    let points = 0

    // Placar exato
    if (bet.predicted_home === home_score && bet.predicted_away === away_score) {
      points += room.pts_exact
    }

    // Vencedor certo (acertou quem ganhou ou empate)
    const predictedWinner =
      bet.predicted_home > bet.predicted_away ? match.home_abbr :
      bet.predicted_away > bet.predicted_home ? match.away_abbr :
      'DRAW'

    if (predictedWinner === realQualifier) {
      points += room.pts_winner
    }

    
   

    // Update bet with points earned
    await db
      .from('bets')
      .update({ points_earned: points })
      .eq('id', bet.id)

    // Update total_points on room_members
    if (points > 0) {
      const { data: member } = await db
        .from('room_members')
        .select('total_points')
        .eq('room_id', bet.room_id)
        .eq('user_id', bet.user_id)
        .single()

      if (member) {
        await db
          .from('room_members')
          .update({ total_points: member.total_points + points })
          .eq('room_id', bet.room_id)
          .eq('user_id', bet.user_id)
      }
    }
  }

  return NextResponse.json({
    data: {
      message: `Jogo finalizado! ${bets.length} apostas calculadas.`,
      result: { home_score, away_score, qualifier: realQualifier },
    }
  })
}
