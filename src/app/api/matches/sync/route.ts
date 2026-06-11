import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { finalizeMatchAndScore } from '@/lib/match-finalize'
import { ApiMatch, mapApiMatchToDbRow, WC_API_URL } from '@/lib/wc2026'

interface ExistingMatchStatus {
  id: string
  match_code: string
  status: string
}

interface SyncedMatch {
  id: string
  match_code: string
  status: string
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

export async function GET(req: NextRequest) {
  // Permite requisições do frontend sem autorização (dados públicos de jogos)
  // Para sync externo (cron), usar x-sync-secret
  const isExternalCall = !!req.headers.get('x-sync-secret') || !!req.headers.get('authorization')
  if (isExternalCall && !isAuthorized(req)) {
    return NextResponse.json({ error: 'Não autorizado para sincronização' }, { status: 401 })
  }

  const token = process.env.WC2026_API_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'WC2026_API_TOKEN não configurado' }, { status: 500 })
  }

  try {
    const response = await fetch(WC_API_URL, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `API externa retornou ${response.status}` },
        { status: 502 }
      )
    }

    const apiMatches: ApiMatch[] = await response.json()
    const rows = apiMatches.map(mapApiMatchToDbRow)
    const matchCodes = rows.map((row) => row.match_code)
    const db = supabaseAdmin()

    const { data: beforeSync } = await db
      .from('matches')
      .select('id, match_code, status')
      .in('match_code', matchCodes)
      .returns<ExistingMatchStatus[]>()

    const beforeStatusMap = new Map<string, string>()
    beforeSync?.forEach((match) => {
      beforeStatusMap.set(match.match_code, match.status)
    })

    const { data: syncedRows, error: upsertError } = await db
      .from('matches')
      .upsert(rows, { onConflict: 'match_code' })
      .select('id, match_code, status, home_score, away_score')
      .returns<SyncedMatch[]>()

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    let finalizedNow = 0
    let betsProcessed = 0

    for (const match of syncedRows || []) {
      const wasFinished = beforeStatusMap.get(match.match_code) === 'finished'
      const becameFinished = match.status === 'finished' && !wasFinished
      const homeScore = match.home_score
      const awayScore = match.away_score
      const hasScores = homeScore != null && awayScore != null

      if (!becameFinished || !hasScores) continue

      const result = await finalizeMatchAndScore(
        db,
        match.id,
        homeScore,
        awayScore,
        { allowAlreadyFinished: true }
      )

      finalizedNow++
      betsProcessed += result.betsProcessed
    }

    return NextResponse.json({
      data: {
        synced_matches: syncedRows?.length || 0,
        finalized_matches: finalizedNow,
        processed_bets: betsProcessed,
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno de sincronização'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
