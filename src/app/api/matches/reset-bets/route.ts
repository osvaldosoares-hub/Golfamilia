// src/app/api/matches/reset-bets/route.ts
// Libera apostas baseado no horário de Brasília:
// - Jogos não iniciados: aberto para apostas
// - Jogos em andamento (1H ou 2H): aberto para apostas
// - Jogos finalizados: bloqueado (sem apostas)
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { parseMatchDateTime } from '@/lib/utils'

interface Match {
  id: string
  match_code: string
  match_date: string
  match_time: string
  status: string
  match_phase: string | null
}

function getTimeInSaoPaulo(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
}

export async function GET() {
  try {
    const db = supabaseAdmin()
    const now = getTimeInSaoPaulo()

    // Obter todos os jogos
    const { data: matches, error: matchError } = await db
      .from('matches')
      .select('id, match_code, match_date, match_time, status, match_phase')
      .returns<Match[]>()

    if (matchError) {
      return NextResponse.json({ error: matchError.message }, { status: 500 })
    }

    if (!matches || matches.length === 0) {
      return NextResponse.json({
        message: 'Nenhum jogo encontrado',
        total_matches: 0,
      })
    }

    let openCount = 0
    let lockedCount = 0
    const updates: Array<{ id: string; status: 'open' | 'locked'; reason: string }> = []

    // Processar cada jogo
    for (const match of matches) {
      try {
        const kickoffTime = parseMatchDateTime(match.match_date, match.match_time)
        const isFinished = match.status === 'finished'
        const isLive = match.status === 'live'
        const isFirstHalf = match.match_phase === '1H'
        const isSecondHalf = match.match_phase === '2H'
        const hasStarted = now >= kickoffTime
        const isOngoing = isLive && (isFirstHalf || isSecondHalf)

        let newStatus: 'open' | 'locked'
        let reason: string

        if (isFinished) {
          // Jogos finalizados não podem ter mais apostas
          newStatus = 'locked'
          reason = 'Jogo finalizado'
          lockedCount++
        } else if (isOngoing) {
          // Jogo em andamento (1H ou 2H) - deixar aberto
          newStatus = 'open'
          reason = `Em andamento (${isFirstHalf ? '1º tempo' : '2º tempo'})`
          openCount++
        } else if (hasStarted && !isOngoing) {
          // Jogo começou mas não tem phase info - considerar como em progresso
          newStatus = 'open'
          reason = 'Em andamento'
          openCount++
        } else {
          // Jogo ainda não começou
          newStatus = 'open'
          reason = `Inicia em ${kickoffTime.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`
          openCount++
        }

        updates.push({ id: match.id, status: newStatus, reason })
      } catch (err) {
        console.error(`Erro ao processar jogo ${match.match_code}:`, err)
        continue
      }
    }

    // Aplicar as atualizações de status
    for (const update of updates) {
      await db
        .from('matches')
        .update({ status: update.status })
        .eq('id', update.id)
    }

    return NextResponse.json({
      message: `✅ Apostas gerenciadas com base na hora de Brasília!`,
      total_matches: matches.length,
      open_count: openCount,
      locked_count: lockedCount,
      details: updates.slice(0, 10).map(u => `${u.id.slice(0, 8)}... → ${u.status} (${u.reason})`),
      note: 'Jogos abertos até o início + durante o jogo (1H e 2H). Jogos finalizados bloqueados.'
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}