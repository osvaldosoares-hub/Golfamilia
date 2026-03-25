// src/app/api/user/me/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const db = supabaseAdmin()
  const { data: user } = await db
    .from('users')
    .select('id, nickname, email, coins, avatar_color, created_at')
    .eq('id', session.userId)
    .single()

  if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  return NextResponse.json({ data: user })
}

// Add coins
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { amount } = await req.json()
  if (!amount || amount <= 0 || amount > 10000) {
    return NextResponse.json({ error: 'Quantidade inválida (máx 10000 por vez)' }, { status: 400 })
  }

  const db = supabaseAdmin()

  // Get current coins
  const { data: user } = await db
    .from('users')
    .select('coins')
    .eq('id', session.userId)
    .single()

  if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

  const newCoins = user.coins + amount
  const { data: updated } = await db
    .from('users')
    .update({ coins: newCoins })
    .eq('id', session.userId)
    .select('coins')
    .single()

  return NextResponse.json({ data: { coins: updated?.coins } })
}
