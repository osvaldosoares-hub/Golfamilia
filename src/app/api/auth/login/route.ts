// src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'
import { signToken, setSessionCookie } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Preencha e-mail e senha' }, { status: 400 })
    }

    const db = supabaseAdmin()
    const { data: user } = await db
      .from('users')
      .select('id, nickname, email, password_hash, coins, avatar_color')
      .eq('email', email)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'E-mail ou senha incorretos' }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return NextResponse.json({ error: 'E-mail ou senha incorretos' }, { status: 401 })
    }

    const token = await signToken({ userId: user.id, nickname: user.nickname, email: user.email })
    setSessionCookie(token)

    const { password_hash: _, ...safeUser } = user
    return NextResponse.json({ data: safeUser })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
