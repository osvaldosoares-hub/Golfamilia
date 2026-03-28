export interface ApiMatch {
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

export const WC_API_URL = 'https://api.wc2026api.com/matches'

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

export function mapStatus(status: string): string {
  const mapping: Record<string, string> = {
    scheduled: 'open',
    live: 'locked',
    completed: 'finished',
    postponed: 'open',
  }
  return mapping[status] || 'open'
}

function normalizeTeamAbbr(rawAbbr: string | null | undefined, teamName: string): string {
  if (rawAbbr && rawAbbr.trim().length > 0) return rawAbbr.trim().toUpperCase()

  const lettersOnly = teamName.replace(/[^A-Za-z]/g, '').toUpperCase()
  if (lettersOnly.length >= 3) return lettersOnly.slice(0, 3)
  if (lettersOnly.length > 0) return lettersOnly
  return 'UNK'
}

function buildMatchCode(match: ApiMatch): string {
  const phaseOrGroup = match.group_name || mapPhase(match.round).toUpperCase()
  return `${phaseOrGroup}${match.match_number}`
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
    home_team: match.home_team,
    home_flag: getFlag(homeAbbr),
    home_abbr: homeAbbr,
    away_team: match.away_team,
    away_flag: getFlag(awayAbbr),
    away_abbr: awayAbbr,
    match_date: matchDate,
    match_time: matchTime,
    home_score: match.home_score,
    away_score: match.away_score,
    status: mapStatus(match.status),
  }
}