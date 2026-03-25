// src/app/api/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'
import { signToken, setSessionCookie } from '@/lib/auth'
import { AVATAR_COLORS } from '@/lib/utils'

export async function POST(req: NextRequest) {
  try {
    const { nickname, email, password } = await req.json()

    if (!nickname || !email || !password) {
      return NextResponse.json({ error: 'Preencha todos os campos' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Senha mínima de 6 caracteres' }, { status: 400 })
    }
    if (nickname.length < 2) {
      return NextResponse.json({ error: 'Apelido muito curto' }, { status: 400 })
    }

    const db = supabaseAdmin()

    // Check duplicates
    const { data: existing } = await db
      .from('users')
      .select('id')
      .or(`email.eq.${email},nickname.eq.${nickname}`)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'E-mail ou apelido já cadastrado' }, { status: 409 })
    }

    const password_hash = await bcrypt.hash(password, 12)
    const avatar_color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]

    const { data: user, error } = await db
      .from('users')
      .insert({ nickname, email, password_hash, avatar_color, coins: 0 })
      .select('id, nickname, email, coins, avatar_color')
      .single()

    if (error || !user) {
      console.error(error)
      return NextResponse.json({ error: 'Erro ao criar conta' }, { status: 500 })
    }

    const token = await signToken({ userId: user.id, nickname: user.nickname, email: user.email })
    setSessionCookie(token)

    return NextResponse.json({ data: user })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
