import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { finalizeMatchAndScore } from '@/lib/match-finalize'
import { mapApiMatchToDbRow, fetchFromWcApi } from '@/lib/wc2026'

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
  // Permite requisições do frontend sem autorização (dados públicos de jogos)
  // Para sync externo (cron), usar x-sync-secret
  const isExternalCall = !!req.headers.get('x-sync-secret') || !!req.headers.get('authorization')
  if (isExternalCall && !isAuthorized(req)) {
    return NextResponse.json({ error: 'Não autorizado para sincronização' }, { status: 401 })
  }

  try {
    const db = supabaseAdmin()
    let apiSuccess = false
    let syncedRows: SyncedMatch[] = []

    // 1. Tenta buscar da API externa
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
      const beforeScoreMap = new Map<string, { home_score: number | null; away_score: number | null }>()
      beforeSync?.forEach((match) => {
        beforeStatusMap.set(match.match_code, match.status)
        beforeScoreMap.set(match.match_code, { home_score: match.home_score, away_score: match.away_score })
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
          source: 'api',
          synced_matches: syncedRows.length,
          finalized_matches: finalizedNow,
          processed_bets: betsProcessed,
        }
      })
    }

    // 2. Se a API externa falhou, buscar jogos no banco que têm placar
    //    e ainda têm bets com pontos não calculados (points_earned IS NULL)
    //    Isso cobre tanto jogos com status != finished quanto jogos que o usuário
    //    atualizou manualmente no banco (incluindo status = finished)
    const { data: matchesWithScores } = await db
      .from('matches')
      .select('id, match_code, status, home_score, away_score')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .returns<ExistingMatchStatus[]>()

    if (!matchesWithScores || matchesWithScores.length === 0) {
      return NextResponse.json(
        { error: 'Não foi possível obter dados da API externa (limite diário ou erro HTTP) e não há jogos com placar no banco' },
        { status: 502 }
      )
    }

    // Filtrar apenas jogos que têm bets com points_earned = null (precisam ser processados)
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
        { error: 'Não foi possível obter dados da API externa (limite diário ou erro HTTP). Nenhuma aposta pendente para processar.' },
        { status: 502 }
      )
    }

    let finalizedNow = 0
    let betsProcessed = 0

    for (const match of pendingMatches) {
      const homeScore = match.home_score
      const awayScore = match.away_score
      if (homeScore == null || awayScore == null) continue

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
        source: 'manual',
        synced_matches: 0,
        finalized_matches: finalizedNow,
        processed_bets: betsProcessed,
      }
    })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno de sincronização'
    const stack = err instanceof Error ? err.stack : ''
    console.error('[Sync] Erro completo:', { message, stack })
    if (err instanceof Error && err.cause) {
      console.error('[Sync] Causa:', err.cause)
    }
    return NextResponse.json({ error: message, detail: stack }, { status: 500 })
  }
}