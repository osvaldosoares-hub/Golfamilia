// src/app/api/seed/route.ts
// Rota para popular o banco de dados com jogos da Copa 2026
// Chame GET /api/seed para rodar (apenas uma vez)

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const WC_API_URL = 'https://api.wc2026api.com/matches'
const WC_API_TOKEN = process.env.WC2026_API_TOKEN!

// Mapa de códigos de país para bandeiras emoji
const FLAG_MAP: Record<string, string> = {
  MEX: '🇲🇽', KOR: '🇰🇷', RSA: '🇿🇦', CAN: '🇨🇦', USA: '🇺🇸',
  BRA: '🇧🇷', ARG: '🇦🇷', GER: '🇩🇪', FRA: '🇫🇷', ESP: '🇪🇸',
  ENG: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', POR: '🇵🇹', NED: '🇳🇱', BEL: '🇧🇪', CRO: '🇭🇷',
  URU: '🇺🇾', COL: '🇨🇴', JPN: '🇯🇵', AUS: '🇦🇺', SEN: '🇸🇳',
  SUI: '🇨🇭', DEN: '🇩🇰', WAL: '🏴󠁧󠁢󠁷󠁬󠁳󠁿', IRN: '🇮🇷', SRB: '🇷🇸',
  CMR: '🇨🇲', MAR: '🇲🇦', TUN: '🇹🇳', POL: '🇵🇱', KSA: '🇸🇦',
  ECU: '🇪🇨', QAT: '🇶🇦', GHA: '🇬🇭', CRC: '🇨🇷', PAR: '🇵🇾',
  EGY: '🇪🇬', NGA: '🇳🇬', ALG: '🇩🇿', CHI: '🇨🇱', PER: '🇵🇪',
  BOL: '🇧🇴', VEN: '🇻🇪', ITA: '🇮🇹', SWE: '🇸🇪', NOR: '🇳🇴',
  AUT: '🇦🇹', CZE: '🇨🇿', UKR: '🇺🇦', SCO: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', TUR: '🇹🇷',
  RUS: '🇷🇺', JAM: '🇯🇲', HON: '🇭🇳', SLV: '🇸🇻', CUW: '🇨🇼',
  TRI: '🇹🇹', PAN: '🇵🇦', CUB: '🇨🇺', HAI: '🇭🇹', NZL: '🇳🇿',
  ISR: '🇮🇱', IRL: '🇮🇪', ROU: '🇷🇴', HUN: '🇭🇺', SVK: '🇸🇰',
  SVN: '🇸🇮', BIH: '🇧🇦', MNE: '🇲🇪', MKD: '🇲🇰', ALB: '🇦🇱',
  FIN: '🇫🇮', ISL: '🇮🇸', GRE: '🇬🇷', BUL: '🇧🇬', CGO: '🇨🇬',
  COD: '🇨🇩', CIV: '🇨🇮', MLI: '🇲🇱', BFA: '🇧🇫', GUI: '🇬🇳',
  GAB: '🇬🇦', BEN: '🇧🇯', TOG: '🇹🇬', CPV: '🇨🇻', MOZ: '🇲🇿',
  ZAM: '🇿🇲', UGA: '🇺🇬', TAN: '🇹🇿', KEN: '🇰🇪', NAM: '🇳🇦',
  ZIM: '🇿🇼', ANG: '🇦🇴', LBY: '🇱🇾', SDN: '🇸🇩', ETH: '🇪🇹',
  CHN: '🇨🇳', IND: '🇮🇳', IDN: '🇮🇩', THA: '🇹🇭', VIE: '🇻🇳',
  MAS: '🇲🇾', PHI: '🇵🇭', SGP: '🇸🇬', UZB: '🇺🇿', IRQ: '🇮🇶',
  SYR: '🇸🇾', JOR: '🇯🇴', LBN: '🇱🇧', OMA: '🇴🇲', UAE: '🇦🇪',
  BHR: '🇧🇭', KUW: '🇰🇼', YEM: '🇾🇪', AFG: '🇦🇫', PRK: '🇰🇵',
}

function getFlag(code: string): string {
  return FLAG_MAP[code] || '🏳️'
}

// Mapeia "round" da API para "phase" do nosso schema
function mapPhase(round: string): string {
  const mapping: Record<string, string> = {
    group: 'group',
    round_of_32: 'r32',
    round_of_16: 'r16',
    quarter_final: 'qf',
    semi_final: 'sf',
    third_place: 'third',
    final: 'final',
  }
  return mapping[round] || round
}

// Mapeia "status" da API para o nosso schema
function mapStatus(status: string): string {
  const mapping: Record<string, string> = {
    scheduled: 'open',
    live: 'locked',
    completed: 'finished',
    postponed: 'open',
  }
  return mapping[status] || 'open'
}

interface ApiMatch {
  id: number
  match_number: number
  round: string
  group_name: string | null
  home_team: string
  home_team_code: string
  away_team: string
  away_team_code: string
  kickoff_utc: string
  home_score: number | null
  away_score: number | null
  status: string
  stadium: string
  stadium_city: string
}

export async function GET() {
  try {
    // Buscar jogos da API
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

    // Converter para formato do nosso banco
    const rows = apiMatches.map((m) => {
      const kickoff = new Date(m.kickoff_utc)
      // Formatar data como "11 Jun" e hora como "19:00"
      const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
      const matchDate = `${kickoff.getUTCDate()} ${months[kickoff.getUTCMonth()]}`
      const matchTime = `${String(kickoff.getUTCHours()).padStart(2, '0')}:${String(kickoff.getUTCMinutes()).padStart(2, '0')}`

      return {
        match_code: `${m.group_name || mapPhase(m.round).toUpperCase()}${m.match_number}`,
        phase: mapPhase(m.round),
        group_label: m.group_name || null,
        home_team: m.home_team,
        home_flag: getFlag(m.home_team_code),
        home_abbr: m.home_team_code,
        away_team: m.away_team,
        away_flag: getFlag(m.away_team_code),
        away_abbr: m.away_team_code,
        match_date: matchDate,
        match_time: matchTime,
        home_score: m.home_score,
        away_score: m.away_score,
        status: mapStatus(m.status),
      }
    })

    // Limpar tabela existente e inserir novos dados (upsert por match_code)
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
