// src/app/api/rooms/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const db = supabaseAdmin()
  const roomId = params.id

  // Get room
  const { data: room } = await db
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .single()

  if (!room) return NextResponse.json({ error: 'Sala não encontrada' }, { status: 404 })

  // Check membership
  const { data: myMembership } = await db
    .from('room_members')
    .select('*')
    .eq('room_id', roomId)
    .eq('user_id', session.userId)
    .single()

  if (!myMembership) return NextResponse.json({ error: 'Você não é membro desta sala' }, { status: 403 })

  // Get all members with user info
  const { data: members } = await db
    .from('room_members')
    .select('id, user_id, coins_in_room, total_points, joined_at')
    .eq('room_id', roomId)
    .order('total_points', { ascending: false })

  const userIds = members?.map(m => m.user_id) || []
  const { data: users } = await db
    .from('users')
    .select('id, nickname, avatar_color, coins')
    .in('id', userIds)

  const userMap: Record<string, { nickname: string; avatar_color: string; coins: number }> = {}
  users?.forEach(u => { userMap[u.id] = u })

  const leaderboard = members?.map((m, i) => ({
    user_id: m.user_id,
    nickname: userMap[m.user_id]?.nickname || 'Anônimo',
    avatar_color: userMap[m.user_id]?.avatar_color || '#00D26A',
    total_points: m.total_points,
    coins_in_room: m.coins_in_room,
    rank: i + 1,
    is_me: m.user_id === session.userId,
  })) || []

  return NextResponse.json({
    data: {
      room,
      leaderboard,
      my_membership: myMembership,
      my_user: {
        ...userMap[session.userId],
        id: session.userId,
      },
    }
  })
}

// PATCH /api/rooms/[id] — bet coins on room
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { coins_bet } = await req.json()
  if (!coins_bet || coins_bet < 1) {
    return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })
  }

  const db = supabaseAdmin()
  const roomId = params.id

  // Get user coins
  const { data: user } = await db
    .from('users')
    .select('coins')
    .eq('id', session.userId)
    .single()

  if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  if (user.coins < coins_bet) {
    return NextResponse.json({ error: 'GolCoins insuficientes' }, { status: 400 })
  }

  // Get membership
  const { data: member } = await db
    .from('room_members')
    .select('id, coins_in_room')
    .eq('room_id', roomId)
    .eq('user_id', session.userId)
    .single()

  if (!member) return NextResponse.json({ error: 'Não é membro desta sala' }, { status: 403 })

  // Deduct coins from user
  await db
    .from('users')
    .update({ coins: user.coins - coins_bet })
    .eq('id', session.userId)

  // Add coins to room membership
  const newCoinsInRoom = member.coins_in_room + coins_bet
  await db
    .from('room_members')
    .update({ coins_in_room: newCoinsInRoom })
    .eq('room_id', roomId)
    .eq('user_id', session.userId)

  return NextResponse.json({ data: { coins_in_room: newCoinsInRoom } })
}
