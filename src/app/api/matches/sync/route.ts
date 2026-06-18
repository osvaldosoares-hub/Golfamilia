import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { finalizeMatchAndScore } from '@/lib/match-finalize'
import { mapApiMatchToDbRow, fetchFromWcApi } from '@/lib/wc2026'

export const dynamic = 'force-dynamic'

interface ExistingMatchStatus {
  id: string
  match_code: string
  status: string
  home_score: number | null
  away_score: number | null
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
  const isExternalCall = !!req.headers.get('x-sync-secret') || !!req.headers.get('authorization')
  if (isExternalCall && !isAuthorized(req)) {
    return NextResponse.json({ error: 'Não autorizado para sincronização' }, { status: 401 })
  }

  try {
    const db = supabaseAdmin()
    let apiSuccess = false
    let syncedRows: SyncedMatch[] = []

    const apiMatches = await fetchFromWcApi()

    if (apiMatches) {
      apiSuccess = true
      const rows = apiMatches.map(mapApiMatchToDbRow)
      const matchCodes = rows.map((row) => row.match_code)

      const { data: beforeSync } = await db
        .from('matches')
        .select('id, match_code, status, home_score, away_score')
        .in('match_code', matchCodes)
        .returns<ExistingMatchStatus[]>()

      const beforeStatusMap = new Map<string, string>()
      beforeSync?.forEach((match) => {
        beforeStatusMap.set(match.match_code, match.status)
      })

      const { data: upsertedRows, error: upsertError } = await db
        .from('matches')
        .upsert(rows, { onConflict: 'match_code' })
        .select('id, match_code, status, home_score, away_score')
        .returns<SyncedMatch[]>()

      if (upsertError) {
        return NextResponse.json({ error: upsertError.message }, { status: 500 })
      }

      syncedRows = upsertedRows || []

      let finalizedNow = 0
      let betsProcessed = 0

      for (const match of syncedRows) {
        const wasFinished = beforeStatusMap.get(match.match_code) === 'finished'
        const isFinished = match.status === 'finished'
        const becameFinished = isFinished && !wasFinished
        const homeScore = match.home_score
        const awayScore = match.away_score
        const hasScores = homeScore != null && awayScore != null

        if (!hasScores) continue
        if (!becameFinished && !(isFinished && homeScore != null && awayScore != null)) continue

        const result = await finalizeMatchAndScore(db, match.id, homeScore, awayScore, { allowAlreadyFinished: true })
        finalizedNow++
        betsProcessed += result.betsProcessed
      }

      return NextResponse.json({
        data: { source: 'api', synced_matches: syncedRows.length, finalized_matches: finalizedNow, processed_bets: betsProcessed }
      })
    }

    // Fallback: process matches with scores that have pending bets
    const { data: matchesWithScores } = await db
      .from('matches')
      .select('id, match_code, status, home_score, away_score')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .returns<ExistingMatchStatus[]>()

    if (!matchesWithScores || matchesWithScores.length === 0) {
      return NextResponse.json(
        { error: 'API externa indisponível e sem jogos com placar no banco' },
        { status: 502 }
      )
    }

    const pendingMatches: ExistingMatchStatus[] = []
    for (const match of matchesWithScores) {
      const { count } = await db
        .from('bets')
        .select('id', { count: 'exact', head: true })
        .eq('match_id', match.id)
        .is('points_earned', null)

      if (count && count > 0) {
        pendingMatches.push(match)
      }
    }

    if (pendingMatches.length === 0) {
      return NextResponse.json(
        { error: 'API externa indisponível. Nenhuma aposta pendente para processar.' },
        { status: 502 }
      )
    }

    let finalizedNow = 0
    let betsProcessed = 0

    for (const match of pendingMatches) {
      const homeScore = match.home_score
      const awayScore = match.away_score
      if (homeScore == null || awayScore == null) continue

      const result = await finalizeMatchAndScore(db, match.id, homeScore, awayScore, { allowAlreadyFinished: true })
      finalizedNow++
      betsProcessed += result.betsProcessed
    }

    return NextResponse.json({
      data: { source: 'manual', synced_matches: 0, finalized_matches: finalizedNow, processed_bets: betsProcessed }
    })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno de sincronização'
    console.error('[Sync] Erro:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}