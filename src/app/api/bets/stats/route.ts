// src/app/api/bets/stats/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/bets/stats?room_id=xxx  — bet distribution per match in a room
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

  // Get all bets in this room (all users)
  const { data: allBets } = await db
    .from('bets')
    .select('match_id, predicted_qualifier')
    .eq('room_id', roomId)

  // Aggregate: for each match, count bets per qualifier
  const stats: Record<string, { total: number; counts: Record<string, number> }> = {}

  for (const bet of allBets || []) {
    if (!bet.predicted_qualifier) continue
    if (!stats[bet.match_id]) {
      stats[bet.match_id] = { total: 0, counts: {} }
    }
    stats[bet.match_id].total++
    stats[bet.match_id].counts[bet.predicted_qualifier] =
      (stats[bet.match_id].counts[bet.predicted_qualifier] || 0) + 1
  }

  return NextResponse.json({ data: stats })
}
