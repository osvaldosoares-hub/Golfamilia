// src/app/lobby/page.tsx
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import LobbyClient from './LobbyClient'

export default async function LobbyPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const db = supabaseAdmin()

  // Get user
  const { data: user } = await db
    .from('users')
    .select('id, nickname, email, coins, avatar_color, created_at')
    .eq('id', session.userId)
    .single()

  if (!user) redirect('/login')

  // Get user rooms
  const { data: memberships } = await db
    .from('room_members')
    .select('room_id, coins_in_room')
    .eq('user_id', session.userId)
  
  let rooms: any[] = []
  if (memberships?.length) {
    const roomIds = memberships.map(m => m.room_id)
    const { data: roomsData, error } = await db
      .from('rooms')
      .select('id, code, name, owner_id, is_active, created_at')
      .in('id', roomIds)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    
    // Member counts
    const { data: memberCounts } = await db
      .from('room_members')
      .select('room_id')
      .in('room_id', roomIds)

    const countMap: Record<string, number> = {}
    memberCounts?.forEach(m => { countMap[m.room_id] = (countMap[m.room_id] || 0) + 1 })

    const membershipMap: Record<string, any> = {}
    memberships.forEach(m => { membershipMap[m.room_id] = m })

    rooms = (roomsData || []).map(r => ({
      ...r,
      member_count: countMap[r.id] || 0,
      my_points: membershipMap[r.id]?.total_points || 0,
    }))
  }
  

  return <LobbyClient user={user} initialRooms={rooms} />
}
