// src/app/api/bets/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { isBetLocked } from '@/lib/utils'

// GET /api/bets?room_id=xxx  — get my bets in a room
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const roomId = req.nextUrl.searchParams.get('room_id')
  if (!roomId) return NextResponse.json({ error: 'room_id obrigatório' }, { status: 400 })

  const db = supabaseAdmin()

  // Verify membership
  const { data: member } = await db
    .from('room_members')
    .select('id')
    .eq('room_id', roomId)
    .eq('user_id', session.userId)
    .single()

  if (!member) return NextResponse.json({ error: 'Não é membro desta sala' }, { status: 403 })

  const { data: bets } = await db
    .from('bets')
    .select('*, match:matches(*)')
    .eq('room_id', roomId)
    .eq('user_id', session.userId)

  return NextResponse.json({ data: bets || [] })
}

// POST /api/bets — place or update a bet
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { room_id, match_id, predicted_home, predicted_away, predicted_qualifier } = await req.json()

  if (!room_id || !match_id) {
    return NextResponse.json({ error: 'room_id e match_id obrigatórios' }, { status: 400 })
  }
  if (predicted_home == null || predicted_away == null) {
    return NextResponse.json({ error: 'Placar obrigatório' }, { status: 400 })
  }

  const db = supabaseAdmin()

  // Verify membership
  const { data: member } = await db
    .from('room_members')
    .select('id, coins_in_room')
    .eq('room_id', room_id)
    .eq('user_id', session.userId)
    .single()

  if (!member) return NextResponse.json({ error: 'Não é membro desta sala' }, { status: 403 })

  // Check match is still open
  const { data: match } = await db
    .from('matches')
    .select('id, status, match_date, match_time')
    .eq('id', match_id)
    .single()

  if (!match) return NextResponse.json({ error: 'Jogo não encontrado' }, { status: 404 })
  if (match.status !== 'open') return NextResponse.json({ error: 'Apostas encerradas para este jogo' }, { status: 400 })

  // Block bets 1 hour before kickoff
  if (isBetLocked(match.match_date, match.match_time)) {
    return NextResponse.json({ error: 'Apostas encerradas — menos de 1h para o início do jogo' }, { status: 400 })
  }

  // Check if existing bet
  const { data: existingBet } = await db
    .from('bets')
    .select('id')
    .eq('room_id', room_id)
    .eq('user_id', session.userId)
    .eq('match_id', match_id)
    .single()

  let bet, betError

  if (existingBet) {
    // Update existing bet
    const result = await db
      .from('bets')
      .update({
        predicted_home,
        predicted_away,
        predicted_qualifier,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingBet.id)
      .select()
      .single()
    bet = result.data
    betError = result.error
  } else {
    // Insert new bet
    const result = await db
      .from('bets')
      .insert({
        room_id,
        user_id: session.userId,
        match_id,
        predicted_home,
        predicted_away,
        predicted_qualifier,
        
      })
      .select()
      .single()
    bet = result.data
    betError = result.error
  }

  if (betError) {
    console.error(betError)
    return NextResponse.json({ error: 'Erro ao salvar aposta' }, { status: 500 })
  }

  return NextResponse.json({ data: bet })
}
