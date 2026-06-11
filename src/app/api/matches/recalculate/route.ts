import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { finalizeMatchAndScore } from '@/lib/match-finalize'

interface RecalcMatchRow {
  id: string
  home_score: number | null
  away_score: number | null
}

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.MATCH_SYNC_SECRET
  if (!secret) return true

  const headerSecret = req.headers.get('x-sync-secret')
  if (headerSecret && headerSecret === secret) return true

  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    return token === secret
  }

  return false
}

export async function POST(req: NextRequest) {
  // Permite requisições do frontend sem autorização
  const isExternalCall = !!req.headers.get('x-sync-secret') || !!req.headers.get('authorization')
  if (isExternalCall && !isAuthorized(req)) {
    return NextResponse.json({ error: 'Não autorizado para recálculo' }, { status: 401 })
  }

  const db = supabaseAdmin()
  const { match_id, group_label } = (await req.json().catch(() => ({}))) as {
    match_id?: string
    group_label?: string
  }

  try {
    let query = db
      .from('matches')
      .select('id, home_score, away_score')
      .eq('status', 'finished')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)

    if (match_id) {
      query = query.eq('id', match_id)
    }

    if (group_label) {
      query = query.eq('phase', 'group').eq('group_label', group_label)
    }

    const { data: matches, error } = await query.returns<RecalcMatchRow[]>()
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let recalculatedMatches = 0
    let betsProcessed = 0

    for (const match of matches || []) {
      if (match.home_score == null || match.away_score == null) continue

      const result = await finalizeMatchAndScore(
        db,
        match.id,
        match.home_score,
        match.away_score,
        { allowAlreadyFinished: true }
      )

      recalculatedMatches++
      betsProcessed += result.betsProcessed
    }

    return NextResponse.json({
      data: {
        recalculated_matches: recalculatedMatches,
        processed_bets: betsProcessed,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao recalcular pontuação'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
