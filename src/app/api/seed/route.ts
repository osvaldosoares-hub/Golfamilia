// src/app/api/seed/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { mapApiMatchToDbRow, fetchFromWcApi } from '@/lib/wc2026'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const apiMatches = await fetchFromWcApi()

    if (!apiMatches) {
      return NextResponse.json(
        { error: 'Não foi possível obter dados da API externa (limite diário ou erro HTTP)' },
        { status: 502 }
      )
    }
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