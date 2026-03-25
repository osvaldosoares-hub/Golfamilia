// src/app/sala/join/[code]/page.tsx
// Handles invite links: /sala/join/COPA24
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'

export default async function JoinByCodePage({ params }: { params: { code: string } }) {
  const session = await getSession()
  if (!session) {
    redirect(`/login?redirect=/sala/join/${params.code}`)
  }

  const db = supabaseAdmin()
  const code = params.code.toUpperCase()

  const { data: room } = await db
    .from('rooms')
    .select('id, code, name, is_active')
    .eq('code', code)
    .single()

  if (!room || !room.is_active) redirect('/lobby')

  // Auto-join
  const { data: existing } = await db
    .from('room_members')
    .select('id')
    .eq('room_id', room.id)
    .eq('user_id', session.userId)
    .single()

  if (!existing) {
    await db.from('room_members').insert({
      room_id: room.id,
      user_id: session.userId,
      coins_in_room: 0,
      total_points: 0,
    })
  }

  redirect(`/sala/${room.id}`)
}
