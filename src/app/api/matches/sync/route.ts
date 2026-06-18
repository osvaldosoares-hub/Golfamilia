import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  return NextResponse.json({
    data: {
      message: 'Sincronização automática desativada. Os dados dos matches agora são gerenciados manualmente pelo Supabase.',
      sync_disabled: true
    }
  })
}
