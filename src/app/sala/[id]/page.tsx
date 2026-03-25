// src/app/sala/[id]/page.tsx
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import SalaClient from './SalaClient'

export default async function SalaPage({ params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const db = supabaseAdmin()

  // Get room + verify membership
  const { data: room } = await db
    .from('rooms')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!room) redirect('/lobby')

  const { data: myMembership } = await db
    .from('room_members')
    .select('*')
    .eq('room_id', params.id)
    .eq('user_id', session.userId)
    .single()

  if (!myMembership) redirect('/lobby')

  // Get user
  const { data: user } = await db
    .from('users')
    .select('id, nickname, email, coins, avatar_color, created_at')
    .eq('id', session.userId)
    .single()

  if (!user) redirect('/login')

  // Members + leaderboard
  const { data: members } = await db
    .from('room_members')
    .select('user_id, coins_in_room, total_points, joined_at')
    .eq('room_id', params.id)
    .order('total_points', { ascending: false })

  const userIds = (members || []).map(m => m.user_id)
  const { data: users } = await db
    .from('users')
    .select('id, nickname, avatar_color, coins')
    .in('id', userIds)

  const userMap: Record<string, any> = {}
  users?.forEach(u => { userMap[u.id] = u })

  const leaderboard = (members || []).map((m, i) => ({
    user_id: m.user_id,
    nickname: userMap[m.user_id]?.nickname || '?',
    avatar_color: userMap[m.user_id]?.avatar_color || '#00D26A',
    total_points: m.total_points,
    coins_in_room: m.coins_in_room,
    bets_count: 0,
    rank: i + 1,
    is_me: m.user_id === session.userId,
  }))

  // Matches
  const { data: matches } = await db
    .from('matches')
    .select('*')
    .order('match_date', { ascending: true })
    .order('match_time', { ascending: true })

  // My bets in this room
  const { data: bets } = await db
    .from('bets')
    .select('*')
    .eq('room_id', params.id)
    .eq('user_id', session.userId)

  return (
    <SalaClient
      user={user}
      room={room}
      leaderboard={leaderboard}
      matches={matches || []}
      initialBets={bets || []}
      myCoinsInRoom={myMembership.coins_in_room}
    />
  )
}
