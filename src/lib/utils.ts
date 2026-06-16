// src/lib/utils.ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('')
}

export const AVATAR_COLORS = [
  '#00D26A', '#FFD700', '#3B82F6', '#FF4757',
  '#A855F7', '#F97316', '#EC4899', '#14B8A6',
  '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16',
]

export function getAvatarColor(index: number): string {
  return AVATAR_COLORS[index % AVATAR_COLORS.length]
}

export function getAvatarTextColor(bg: string): string {
  const lightColors = ['#FFD700', '#00D26A', '#F97316', '#84CC16', '#14B8A6']
  return lightColors.includes(bg) ? '#000' : '#fff'
}

export function formatCoins(n: number): string {
  return n?.toLocaleString('pt-BR')
}

export const KNOCKOUT_RELEASE_DATE_NUMBER = 20260627

function getDatePartsInSaoPaulo(date: Date) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const parts = formatter.formatToParts(date)
  const year = Number(parts.find(p => p.type === 'year')?.value || '0')
  const month = Number(parts.find(p => p.type === 'month')?.value || '0')
  const day = Number(parts.find(p => p.type === 'day')?.value || '0')

  return { year, month, day }
}

export function getDateNumberInSaoPaulo(date: Date = new Date()): number {
  const { year, month, day } = getDatePartsInSaoPaulo(date)
  return year * 10000 + month * 100 + day
}

export function isKnockoutBetReleased(date: Date = new Date()): boolean {
  return getDateNumberInSaoPaulo(date) >= KNOCKOUT_RELEASE_DATE_NUMBER
}

/** Get the next upcoming match that starts within the specified minutes */
export function getNextUpcomingMatch(matches: any[], withinMinutes: number = 60): any | null {
  const now = Date.now()
  for (const match of matches) {
    // Skip finished or live matches
    if (match.status === 'finished' || match.status === 'live') continue
    
    const kickoffTime = parseMatchDateTime(match.match_date, match.match_time)
    const msUntilKickoff = kickoffTime.getTime() - now

    // Match starts within the specified minutes (and hasn't started yet)
    if (msUntilKickoff > 0 && msUntilKickoff <= withinMinutes * 60 * 1000) {
      return match
    }
  }
  return null
}

export function getPhaseLabel(phase: string): string {
  const labels: Record<string, string> = {
    r32: '16 avos',
    r16: 'Oitavas',
    qf: 'Quartas',
    sf: 'Semifinal',
    third: '3o lugar',
    final: 'Final',
  }

  return labels[phase] || phase
}

const MONTH_MAP: Record<string, number> = {
  Jan: 0, Fev: 1, Mar: 2, Abr: 3, Mai: 4, Jun: 5,
  Jul: 6, Ago: 7, Set: 8, Out: 9, Nov: 10, Dez: 11,
}

// Global lockout: 15:00 today (São Paulo time) = 18:00 UTC
const GLOBAL_LOCKOUT_TIME = new Date('2026-06-11T18:00:00Z')

/** Extrai componentes de data e hora de strings como "11 Jun" e "16:00" */
// Os dados no banco já estão em horário Brasília (convertidos pelo seed)
function extractTimeComponents(matchDate: string, matchTime: string) {
  const [dayStr, monthStr] = matchDate.split(' ')
  const [hoursStr, minutesStr] = matchTime.split(':')

  let hours = parseInt(hoursStr, 10) - 3

  if (hours < 0) {
    hours += 24
  }

  return {
    day: parseInt(dayStr, 10),
    monthIndex: MONTH_MAP[monthStr] ?? 0,
    hours,
    minutes: parseInt(minutesStr, 10)
  }
}

/** Formata horário do jogo para display em horário brasileiro */
// Os dados no banco já estão em Brasília, não precisa converter
export function formatMatchTimeForDisplay(matchDate: string, matchTime: string): string {
  const { day, monthIndex, hours, minutes } = extractTimeComponents(matchDate, matchTime)
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  const hourStr = String(hours).padStart(2, '0')
  const minStr = String(minutes).padStart(2, '0')
  return `${day} ${months[monthIndex]} ${hourStr}:${minStr}`
}

/** Parse match_date ("11 Jun") + match_time ("16:00") para Date */
// Os dados no banco já estão em Brasília
export function parseMatchDateTime(matchDate: string, matchTime: string): Date {
  const { day, monthIndex, hours, minutes } = extractTimeComponents(matchDate, matchTime)
  // Criar data usando horário de Brasília (ano fixo 2026)
  return new Date(2026, monthIndex, day, hours, minutes)
}

/** Returns milliseconds until lockout.
// As apostas só encerram na hora do início do jogo */
export function msUntilLockout(matchDate: string, matchTime: string): number {
  const kickoffTime = parseMatchDateTime(matchDate, matchTime)
  return kickoffTime.getTime() - Date.now()
}

/** Returns true if bets should be blocked (at match time) */
export function isBetLocked(matchDate: string, matchTime: string): boolean {
  return msUntilLockout(matchDate, matchTime) <= 0
}

export function calcPoints(
  predicted_home: number,
  predicted_away: number,
  predicted_qualifier: string | undefined,
  actual_home: number,
  actual_away: number,
  actual_qualifier: string | undefined,
  pts_exact: number,
  pts_winner: number,
  pts_qualifier: number
): number {
  let pts = 0

  // Placar exato
  if (predicted_home === actual_home && predicted_away === actual_away) {
    pts += pts_exact
  } else {
    // Vencedor correto
    const predWinner =
      predicted_home > predicted_away ? 'home'
      : predicted_away > predicted_home ? 'away'
      : 'draw'
    const actualWinner =
      actual_home > actual_away ? 'home'
      : actual_away > actual_home ? 'away'
      : 'draw'
    if (predWinner === actualWinner) pts += pts_winner
  }

  // Classificado correto
  if (predicted_qualifier && actual_qualifier && predicted_qualifier === actual_qualifier) {
    pts += pts_qualifier
  }

  return pts
}
