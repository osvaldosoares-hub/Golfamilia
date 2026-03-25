// src/app/api/group-bets/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/group-bets?room_id=xxx — get my group bets in a room
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const roomId = req.nextUrl.searchParams.get('room_id')
  if (!roomId) return NextResponse.json({ error: 'room_id obrigatório' }, { status: 400 })

  const db = supabaseAdmin()

  const { data: member } = await db
    .from('room_members')
    .select('id')
    .eq('room_id', roomId)
    .eq('user_id', session.userId)
    .single()

  if (!member) return NextResponse.json({ error: 'Não é membro desta sala' }, { status: 403 })

  const { data: groupBets } = await db
    .from('group_bets')
    .select('*')
    .eq('room_id', roomId)
    .eq('user_id', session.userId)

  return NextResponse.json({ data: groupBets || [] })
}

// POST /api/group-bets — place or update a group position bet
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { room_id, group_label, first_team, second_team, third_team } = await req.json()

  if (!room_id || !group_label || !first_team || !second_team || !third_team) {
    return NextResponse.json({ error: 'Todos os campos são obrigatórios' }, { status: 400 })
  }

  // Validate no duplicates
  if (first_team === second_team || first_team === third_team || second_team === third_team) {
    return NextResponse.json({ error: 'Seleções devem ser diferentes' }, { status: 400 })
  }

  const db = supabaseAdmin()

  // Verify membership
  const { data: member } = await db
    .from('room_members')
    .select('id')
    .eq('room_id', room_id)
    .eq('user_id', session.userId)
    .single()

  if (!member) return NextResponse.json({ error: 'Não é membro desta sala' }, { status: 403 })

  // Check if group still has open matches (can't bet after group is locked)
  const { data: openMatches } = await db
    .from('matches')
    .select('id')
    .eq('phase', 'group')
    .eq('group_label', group_label)
    .eq('status', 'open')
    .limit(1)

  if (!openMatches || openMatches.length === 0) {
    return NextResponse.json({ error: 'Apostas encerradas para este grupo' }, { status: 400 })
  }

  // Upsert
  const { data: existing } = await db
    .from('group_bets')
    .select('id')
    .eq('room_id', room_id)
    .eq('user_id', session.userId)
    .eq('group_label', group_label)
    .single()

  let bet, betError

  if (existing) {
    const result = await db
      .from('group_bets')
      .update({
        first_team,
        second_team,
        third_team,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single()
    bet = result.data
    betError = result.error
  } else {
    const result = await db
      .from('group_bets')
      .insert({
        room_id,
        user_id: session.userId,
        group_label,
        first_team,
        second_team,
        third_team,
      })
      .select()
      .single()
    bet = result.data
    betError = result.error
  }

  if (betError) return NextResponse.json({ error: betError.message }, { status: 500 })

  return NextResponse.json({ data: bet })
}
