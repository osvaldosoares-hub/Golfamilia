// src/app/api/seed/route.ts
// Rota para popular o banco de dados com jogos da Copa 2026
// Chame GET /api/seed para rodar (apenas uma vez)

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { ApiMatch, mapApiMatchToDbRow, WC_API_URL } from '@/lib/wc2026'

const WC_API_TOKEN = process.env.WC2026_API_TOKEN!

export async function GET() {
  try {
    const res = await fetch(WC_API_URL, {
      headers: { Authorization: `Bearer ${WC_API_TOKEN}` },
      cache: 'no-store',
    })

    if (!res.ok) {
      return NextResponse.json(
        { error: `API retornou ${res.status}` },
        { status: 502 }
      )
    }

    const apiMatches: ApiMatch[] = await res.json()
    const db = supabaseAdmin()

    const rows = apiMatches.map(mapApiMatchToDbRow)

    const { data, error } = await db
      .from('matches')
      .upsert(rows, { onConflict: 'match_code' })
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      message: `${rows.length} jogos importados com sucesso!`,
      count: rows.length,
      data,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
