// src/app/api/rooms/[id]/recalc-leaderboard/route.ts
// Recalcula pontos de todos os membros da sala com base nos jogos com placar (live ou finished)
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// Jogos que valem 2x pontos
const DOUBLE_POINTS_MATCHES = [
  'COD-UZB', 'UZB-COD', 'CPV-KSA', 'KSA-CPV',
  'IRN-NZL', 'NZL-IRN', 'AUT-JOR', 'JOR-AUT',
  'JOR-ALG', 'ALG-JOR', 'BIH-QAT', 'QAT-BIH',
  'USA-AUS', 'AUS-USA',
]

function isDoublePointsMatch(homeAbbr: string, awayAbbr: string): boolean {
  const code = `${homeAbbr}-${awayAbbr}`
  return DOUBLE_POINTS_MATCHES.includes(code)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const db = supabaseAdmin()
  const roomId = params.id

  // Verificar membresia
  const { data: myMembership } = await db
    .from('room_members')
    .select('id')
    .eq('room_id', roomId)
    .eq('user_id', session.userId)
    .single()

  if (!myMembership) return NextResponse.json({ error: 'Não é membro desta sala' }, { status: 403 })

  // Pegar configuração de pontos da sala
  const { data: room } = await db
    .from('rooms')
    .select('id, code, pts_exact, pts_winner')
    .eq('id', roomId)
    .single()

  if (!room) return NextResponse.json({ error: 'Sala não encontrada' }, { status: 404 })

  // Pegar todos os jogos com placar (ao vivo OU finalizados)
  const { data: matches } = await db
    .from('matches')
    .select('id, home_abbr, away_abbr, home_score, away_score, status')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null)
    .in('status', ['live', 'finished'])

  if (!matches || matches.length === 0) {
    return NextResponse.json({ data: { recalculated: 0, message: 'Nenhum jogo com placar disponível' } })
  }

  const matchIds = matches.map(m => m.id)

  // Pegar todas as bets da sala para esses jogos
  const { data: bets } = await db
    .from('bets')
    .select('id, user_id, match_id, predicted_home, predicted_away, predicted_qualifier, points_earned')
    .eq('room_id', roomId)
    .in('match_id', matchIds)

  if (!bets || bets.length === 0) {
    return NextResponse.json({ data: { recalculated: 0, message: 'Nenhuma aposta para recalcular' } })
  }

  // Indexar matches por id
  const matchMap = new Map<string, typeof matches[0]>()
  matches.forEach(m => matchMap.set(m.id, m))

  // Calcular pontos por usuário
  const pointsByUser = new Map<string, number>()

  for (const bet of bets) {
    const match = matchMap.get(bet.match_id)
    if (!match) continue
    if (match.home_score == null || match.away_score == null) continue

    const predictedHome = Number(bet.predicted_home)
    const predictedAway = Number(bet.predicted_away)
    const realHome = Number(match.home_score)
    const realAway = Number(match.away_score)

    // Calcular qualificador real
    let realQualifier = 'DRAW'
    if (realHome > realAway) realQualifier = match.home_abbr
    else if (realAway > realHome) realQualifier = match.away_abbr

    // Calcular qualificador do palpite
    let predictedQualifier = bet.predicted_qualifier
    if (!predictedQualifier) {
      if (predictedHome > predictedAway) predictedQualifier = match.home_abbr
      else if (predictedAway > predictedHome) predictedQualifier = match.away_abbr
      else predictedQualifier = 'DRAW'
    }

let points = 0
    if (predictedHome === realHome && predictedAway === realAway) {
      points = room.pts_exact + room.pts_winner
    } else if (predictedQualifier === realQualifier) {
      points = room.pts_winner
    }

    // Aplicar 2x se for jogo especial E sala FY4CXF
    if (isDoublePointsMatch(match.home_abbr, match.away_abbr) && room.code === 'FY4CXF') {
      console.log(`[DEBUG] 2x aplicado: ${match.home_abbr}-${match.away_abbr}, pts antes: ${points}`)
      points = points * 2
      console.log(`[DEBUG] pts depois do 2x: ${points}`)
    }

    const current = pointsByUser.get(bet.user_id) || 0
    pointsByUser.set(bet.user_id, current + points)
  }

  // Atualizar total_points de cada membro
  await Promise.all(
  Array.from(pointsByUser.entries()).map(async ([userId, points=0]) => {
    // Busca o base_points do membro
    const { data: member } = await db
      .from('room_members')
      .select('base_points')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .single()

    const base = member?.base_points ?? 0

    await db
      .from('room_members')
      .update({ total_points: base + points }) // ← soma histórico + novo
      .eq('room_id', roomId)
      .eq('user_id', userId)
  })
)

  return NextResponse.json({
    data: {
      recalculated: pointsByUser.size,
      users_updated: Array.from(pointsByUser.entries()).map(([userId, pts]) => ({ userId, pts })),
    }
  })
}