// src/app/api/matches/fix-times/route.ts
// Corrige horários subtraindo 3 horas (UTC -> Brasília)
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const db = supabaseAdmin()

  // Pegar todos os jogos com hora
  const { data: matches, error: fetchError } = await db
    .from('matches')
    .select('id, match_date, match_time')
    .not('match_time', 'is', null)

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!matches || matches.length === 0) {
    return NextResponse.json({ data: { updated: 0, message: 'Nenhum jogo encontrado' } })
  }

  let updated = 0
  const months: Record<string, number> = {
    'Jan': 0, 'Fev': 1, 'Mar': 2, 'Abr': 3, 'Mai': 4, 'Jun': 5,
    'Jul': 6, 'Ago': 7, 'Set': 8, 'Out': 9, 'Nov': 10, 'Dez': 11
  }

  for (const match of matches) {
    const [day, monthName] = match.match_date.split(' ')
    const month = months[monthName]
    const [hours, minutes] = match.match_time.split(':').map(Number)

    // Criar data em UTC
    const date = new Date()
    date.setUTCHours(hours, minutes, 0, 0)
    // Ajustar para UTC-3 (subtrair 3 horas)
    date.setUTCHours(hours - 3)
    // Tratar se passar para dia anterior
    if (date.getUTCHours() < 0) {
      date.setUTCDate(date.getUTCDate() - 1)
      date.setUTCHours(date.getUTCHours() + 24)
    }

    const newTime = `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`
    const dayNum = date.getUTCDate()
    const newMonth = Object.keys(months).find(key => months[key] === date.getUTCMonth())

    if (newMonth) {
      const newDate = `${dayNum} ${newMonth}`
      
      await db
        .from('matches')
        .update({ match_time: newTime, match_date: newDate })
        .eq('id', match.id)

      updated++
    }
  }

  return NextResponse.json({
    data: {
      updated,
      message: `${updated} horários atualizados para horário de Brasília (UTC-3)`
    }
  })
}
