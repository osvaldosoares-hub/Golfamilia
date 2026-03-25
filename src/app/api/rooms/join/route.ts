// src/app/api/rooms/join/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { code } = await req.json()
  if (!code) return NextResponse.json({ error: 'Código obrigatório' }, { status: 400 })

  const db = supabaseAdmin()

  const { data: room } = await db
    .from('rooms')
    .select('id, code, name, owner_id, is_active')
    .eq('code', code.toUpperCase())
    .single()
  
  if (!room) return NextResponse.json({ error: 'Sala não encontrada' }, { status: 404 })
  if (!room.is_active) return NextResponse.json({ error: 'Sala encerrada' }, { status: 400 })

  // Check already member
  const { data: existing } = await db
    .from('room_members')
    .select('id')
    .eq('room_id', room.id)
    .eq('user_id', session.userId)
    .single()

  if (existing) {
    return NextResponse.json({ data: room }) // already in, just return room
  }

  const { data: member, error: memberError } = await db.from('room_members').insert({
    room_id: room.id,
    user_id: session.userId,
    coins_in_room: 0,
    
  }).select().single()
 if (memberError) {
    console.error(memberError)
    return NextResponse.json({ error: 'Erro ao adicionar membro' }, { status: 500 })
  }
  return NextResponse.json({ data: room })
}
