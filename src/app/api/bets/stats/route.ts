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
    .select('match_id, predicted_qualifier, predicted_home, predicted_away')
    .eq('room_id', roomId)

  // Aggregate: for each match, count bets per qualifier and compute average score
  const stats: Record<string, {
    total: number
    counts: Record<string, number>
    avg_home: number | null
    avg_away: number | null
    scores_count: number
    _sum_home: number
    _sum_away: number
  }> = {}

  for (const bet of allBets || []) {
    if (!stats[bet.match_id]) {
      stats[bet.match_id] = {
        total: 0,
        counts: {},
        avg_home: null,
        avg_away: null,
        scores_count: 0,
        _sum_home: 0,
        _sum_away: 0,
      }
    }

    if (typeof bet.predicted_home === 'number' && typeof bet.predicted_away === 'number') {
      stats[bet.match_id]._sum_home += bet.predicted_home
      stats[bet.match_id]._sum_away += bet.predicted_away
      stats[bet.match_id].scores_count++
    }

    if (!bet.predicted_qualifier) {
      continue
    }

    stats[bet.match_id].total++
    stats[bet.match_id].counts[bet.predicted_qualifier] =
      (stats[bet.match_id].counts[bet.predicted_qualifier] || 0) + 1
  }

  for (const matchId of Object.keys(stats)) {
    const item = stats[matchId]
    if (item.scores_count > 0) {
      item.avg_home = Number((item._sum_home / item.scores_count).toFixed(1))
      item.avg_away = Number((item._sum_away / item.scores_count).toFixed(1))
    }

    delete (item as { _sum_home?: number })._sum_home
    delete (item as { _sum_away?: number })._sum_away
  }

  return NextResponse.json({ data: stats })
}
