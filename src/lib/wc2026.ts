// src/lib/wc2026.ts
// Football-Data.org v4 integration for Copa do Mundo 2026
// Maps Football-Data.org data to the app's DB schema

import { getCompetitionMatches, type FootballDataMatch } from '@/services/footballDataApi'

// WC = FIFA World Cup (Football-Data.org competition code)
// For 2026 World Cup, this is the expected code
export const WC_COMPETITION_CODE = 'WC'

export interface ApiMatch {
  id: number
  match_number: number
  round: string
  group_name: string | null
  home_team: string | null
  home_team_code: string | null
  away_team: string | null
  away_team_code: string | null
  kickoff_utc: string
  home_score: number | null
  away_score: number | null
  status: string
  phase?: string | null
  stadium: string
  stadium_city: string
}

export const WC_API_URL = 'https://api.football-data.org/v4/competitions/WC/matches'

import { checkRateLimit, incrementRateLimit } from './rate-limiter'

/**
 * Fetches matches from Football-Data.org v4 API with rate limiting
 */
export async function fetchFromWcApi(): Promise<ApiMatch[] | null> {
  const rateCheck = await checkRateLimit()
  if (!rateCheck.allowed) {
    console.warn(`[RateLimiter] Limite diário excedido. Reset em ${rateCheck.resetAt}. Pulando fetch.`)
    return null
  }

  try {
    const response = await getCompetitionMatches(WC_COMPETITION_CODE)
    await incrementRateLimit()

    // Map Football-Data.org matches to ApiMatch format
    const matches: ApiMatch[] = (response.matches || []).map((match: FootballDataMatch) => ({
      id: match.id,
      match_number: match.matchday || 0,
      round: mapRoundFromStage(match.stage, match.group),
      group_name: mapGroupName(match.group),
      home_team: match.homeTeam?.name || null,
      home_team_code: match.homeTeam?.tla || null,
      away_team: match.awayTeam?.name || null,
      away_team_code: match.awayTeam?.tla || null,
      kickoff_utc: match.utcDate,
      home_score: match.score?.fullTime?.home,
      away_score: match.score?.fullTime?.away,
      status: mapFootballDataStatus(match.status),
      phase: match.status || null,
      stadium: '',
      stadium_city: '',
    }))

    return matches
  } catch (error) {
    console.error('[FootballData] Erro ao buscar dados:', error)
    return null
  }
}

/**
 * Maps Football-Data.org group name to just the letter
 * e.g. "GROUP_H" -> "H", "GROUP_1" -> "1"
 */
function mapGroupName(group: string | null): string | null {
  if (!group) return null
  // "GROUP_H" -> "H", "GROUP_1" -> "1", "GROUP_A" -> "A"
  const match = group.match(/^GROUP_([A-Z0-9]+)$/i)
  if (match) return match[1].toUpperCase()
  // If it's already a single letter like "H", return as-is
  if (/^[A-Z0-9]$/i.test(group)) return group.toUpperCase()
  // Fallback: return as-is
  return group
}

/**
 * Maps Football-Data.org stage/group to the app's round format
 */
function mapRoundFromStage(stage: string, group: string | null): string {
  const normalizedStage = (stage || '').toUpperCase()

  // Group stage
  if (normalizedStage === 'GROUP_STAGE' || normalizedStage === 'GROUP') {
    return 'group'
  }

  // Preliminary/Preliminary round
  if (normalizedStage?.includes('PRELIMINARY') || normalizedStage?.includes('QUALIFYING')) {
    return 'group'
  }

  // Knockout stages
  const mapping: Record<string, string> = {
    'ROUND_OF_32': 'r32',
    'ROUND_OF_16': 'r16',
    'QUARTER_FINALS': 'qf',
    'SEMI_FINALS': 'sf',
    'THIRD_PLACE': 'third',
    'FINAL': 'final',
  }

  return mapping[normalizedStage] || normalizedStage.toLowerCase()
}

/**
 * Maps Football-Data.org match status to the app's status format
 */
function mapFootballDataStatus(status: string): string {
  const normalized = (status || '').toUpperCase()

  const mapping: Record<string, string> = {
    'SCHEDULED': 'scheduled',
    'TIMED': 'scheduled',
    'IN_PLAY': 'live',
    'PAUSED': 'live',
    'FINISHED': 'finished',
    'POSTPONED': 'scheduled',
    'CANCELLED': 'scheduled',
    'AWARDED': 'finished',
  }

  return mapping[normalized] || 'scheduled'
}

const FLAG_MAP: Record<string, string> = {
  MEX: '🇲🇽', KOR: '🇰🇷', RSA: '🇿🇦', CAN: '🇨🇦', USA: '🇺🇸',
  BRA: '🇧🇷', ARG: '🇦🇷', GER: '🇩🇪', FRA: '🇫🇷', ESP: '🇪🇸',
  ENG: '🏴', POR: '🇵🇹', NED: '🇳🇱', BEL: '🇧🇪', CRO: '🇭🇷',
  URU: '🇺🇾', COL: '🇨🇴', JPN: '🇯🇵', AUS: '🇦🇺', SEN: '🇸🇳',
  SUI: '🇨🇭', DEN: '🇩🇰', WAL: '🏴', IRN: '🇮🇷', SRB: '🇷🇸',
  CMR: '🇨🇲', MAR: '🇲🇦', TUN: '🇹🇳', POL: '🇵🇱', KSA: '🇸🇦',
  ECU: '🇪🇨', QAT: '🇶🇦', GHA: '🇬🇭', CRC: '🇨🇷', PAR: '🇵🇾',
  EGY: '🇪🇬', NGA: '🇳🇬', ALG: '🇩🇿', CHI: '🇨🇱', PER: '🇵🇪',
  BOL: '🇧🇴', VEN: '🇻🇪', ITA: '🇮🇹', SWE: '🇸🇪', NOR: '🇳🇴',
  AUT: '🇦🇹', CZE: '🇨🇿', UKR: '🇺🇦', SCO: '🏴', TUR: '🇹🇷',
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

export function mapPhase(round: string): string {
  const normalized = (round || '').trim().toLowerCase()
  const mapping: Record<string, string> = {
    group: 'group',
    groups: 'group',
    r32: 'r32',
    round_of_32: 'r32',
    round32: 'r32',
    'round of 32': 'r32',
    r16: 'r16',
    round_of_16: 'r16',
    round16: 'r16',
    'round of 16': 'r16',
    qf: 'qf',
    quarter_final: 'qf',
    quarterfinal: 'qf',
    'quarter-final': 'qf',
    sf: 'sf',
    semi_final: 'sf',
    semifinal: 'sf',
    'semi-final': 'sf',
    third: 'third',
    third_place: 'third',
    'third place': 'third',
    final: 'final',
  }
  return mapping[normalized] || normalized
}

export function mapStatus(status: string, phase?: string | null): string {
  const normalizedStatus = (status || '').toLowerCase().trim()

  // Se o jogo está "live" mas a fase é "FT" (Full Time), consideramos como finished
  // Apenas se a fase for exatamente FT (Full Time) - não ET (Extra Time) ou PEN (Pênaltis)
  // porque esses ainda podem ter emoção!
  if (normalizedStatus === 'live' && phase && phase.toUpperCase() === 'FT') {
    return 'finished'
  }

  const mapping: Record<string, string> = {
    scheduled: 'scheduled',
    live: 'live',
    finished: 'finished',
    completed: 'finished',
    postponed: 'scheduled',
  }
  return mapping[normalizedStatus] || 'scheduled'
}

function normalizeTeamAbbr(rawAbbr: string | null | undefined, teamName: string | null | undefined): string {
  if (rawAbbr && rawAbbr.trim().length > 0) return rawAbbr.trim().toUpperCase()

  const lettersOnly = (teamName ?? '').replace(/[^A-Za-z]/g, '').toUpperCase()
  if (lettersOnly.length >= 3) return lettersOnly.slice(0, 3)
  if (lettersOnly.length > 0) return lettersOnly
  return 'UNK'
}

function buildMatchCode(match: ApiMatch): string {
  // Usa o ID único da Football-Data.org para garantir match_code único
  return `FD${match.id}`
}

export function mapApiMatchToDbRow(match: ApiMatch) {
  const kickoff = new Date(match.kickoff_utc)
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  const matchDate = `${kickoff.getUTCDate()} ${months[kickoff.getUTCMonth()]}`
  const matchTime = `${String(kickoff.getUTCHours()).padStart(2, '0')}:${String(kickoff.getUTCMinutes()).padStart(2, '0')}`

  const homeAbbr = normalizeTeamAbbr(match.home_team_code, match.home_team)
  const awayAbbr = normalizeTeamAbbr(match.away_team_code, match.away_team)

  return {
    match_code: buildMatchCode(match),
    phase: mapPhase(match.round),
    group_label: match.group_name || null,
    home_team: match.home_team ?? 'A definir',
    home_flag: getFlag(homeAbbr),
    home_abbr: homeAbbr,
    away_team: match.away_team ?? 'A definir',
    away_flag: getFlag(awayAbbr),
    away_abbr: awayAbbr,
    match_date: matchDate,
    match_time: matchTime,
    home_score: match.home_score,
    away_score: match.away_score,
    status: mapStatus(match.status, match.phase),
    match_phase: match.phase || null,
  }
}