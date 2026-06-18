// src/app/api/matches/cleanup/route.ts
// Remove jogos antigos (com match_code sem prefixo FD) e mantém os novos da Football-Data.org
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const db = supabaseAdmin()

    // Deleta jogos que não começam com "FD"
    const { data: deleted, error } = await db
      .from('matches')
      .delete()
      .not('match_code', 'like', 'FD%')
      .select('match_code')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      message: `${deleted?.length || 0} jogos antigos removidos`,
      deleted_codes: deleted?.map(m => m.match_code) || []
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}