// src/app/api/matches/finalize/route.ts
// Finaliza um jogo e calcula pontos de todas as apostas
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { finalizeMatchAndScore } from '@/lib/match-finalize'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { match_id, home_score, away_score } = await req.json()

  if (!match_id || home_score == null || away_score == null) {
    return NextResponse.json({ error: 'match_id, home_score e away_score obrigatórios' }, { status: 400 })
  }

  const db = supabaseAdmin()
  try {
    const result = await finalizeMatchAndScore(db, match_id, home_score, away_score)
    
    if (result.betsProcessed === 0) {
      return NextResponse.json({ data: { message: 'Jogo finalizado, sem apostas.' } })
    }

    return NextResponse.json({
      data: {
        message: `Jogo finalizado! ${result.betsProcessed} apostas calculadas.`,
        result: { home_score, away_score, qualifier: result.qualifier },
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao finalizar jogo'

    if (message === 'Jogo não encontrado') {
      return NextResponse.json({ error: message }, { status: 404 })
    }
    if (message === 'Jogo já finalizado') {
      return NextResponse.json({ error: message }, { status: 400 })
    }

    return NextResponse.json({ error: message }, { status: 500 })
  }
}