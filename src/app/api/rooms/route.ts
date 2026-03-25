// src/app/api/rooms/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { generateRoomCode } from '@/lib/utils'

// GET /api/rooms — list my rooms
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const db = supabaseAdmin()

  const { data: memberships } = await db
    .from('room_members')
    .select('room_id, coins_in_room, total_points')
    .eq('user_id', session.userId)

  if (!memberships?.length) return NextResponse.json({ data: [] })

  const roomIds = memberships.map(m => m.room_id)

  const { data: rooms } = await db
    .from('rooms')
    .select('id, code, name, owner_id, is_active, created_at')
    .in('id', roomIds)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  // Count members per room
  const { data: memberCounts } = await db
    .from('room_members')
    .select('room_id')
    .in('room_id', roomIds)

  const countMap: Record<string, number> = {}
  memberCounts?.forEach(m => {
    countMap[m.room_id] = (countMap[m.room_id] || 0) + 1
  })

  const membershipMap: Record<string, { coins_in_room: number; total_points: number }> = {}
  memberships.forEach(m => { membershipMap[m.room_id] = m })

  const result = rooms?.map(r => ({
    ...r,
    member_count: countMap[r.id] || 0,
    coins_in_room: membershipMap[r.id]?.coins_in_room || 0,
    my_points: membershipMap[r.id]?.total_points || 0,
  }))

  return NextResponse.json({ data: result || [] })
}

// POST /api/rooms — create room
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { name } = await req.json()

  if (!name || name.trim().length < 2) {
    return NextResponse.json({ error: 'Nome da sala muito curto' }, { status: 400 })
  }

  const db = supabaseAdmin()

  // Generate unique code
  let code = generateRoomCode()
  let attempts = 0
  while (attempts < 5) {
    const { data: existing } = await db.from('rooms').select('id').eq('code', code).single()
    if (!existing) break
    code = generateRoomCode()
    attempts++
  }

  const { data: room, error } = await db
    .from('rooms')
    .insert({ code, name: name.trim(), owner_id: session.userId, is_active: true })
    .select()
    .single()

  if (error || !room) {
    console.error(error)
    return NextResponse.json({ error: 'Erro ao criar sala' }, { status: 500 })
  }

  // Add owner as member
  const { error: memberError } = await db.from('room_members').insert({
    room_id: room.id,
    user_id: session.userId,
    coins_in_room: 0,
   
  })

  if (memberError) {
    console.error(memberError)
    return NextResponse.json({ error: 'Erro ao adicionar membro' }, { status: 500 })
  }
  console.log(`Sala criada: ${room.name} (${room.code}) por ${session.nickname}`)
  return NextResponse.json({ data: room }, { status: 201 })
}
