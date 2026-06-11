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

// Global lockout: At first match kickoff of the tournament
// Mexico vs Africa (R32/1) - kickoff at 16:00 UTC on June 11, 2026 (4hrs Brasília / 7hrs São Paulo)
// All bets lock when the first match kicks off
const GLOBAL_LOCKOUT_TIME = new Date('2026-06-11T16:00:00Z')

/** Parse match_date ("11 Jun") + match_time ("19:00") into a UTC Date for 2026 */
export function parseMatchDateTime(matchDate: string, matchTime: string): Date {
  const [dayStr, monthStr] = matchDate.split(' ')
  const [hourStr, minStr] = matchTime.split(':')
  const month = MONTH_MAP[monthStr] ?? 0
  return new Date(Date.UTC(2026, month, parseInt(dayStr), parseInt(hourStr), parseInt(minStr)))
}

/** Returns milliseconds until lockout.
 * Uses global lockout time (1h before first match) for ALL matches.
 * Negative = already locked. */
export function msUntilLockout(_matchDate: string, _matchTime: string): number {
  // All bets lock at the same time: 1 hour before first match (15:00 UTC / 3hrs Brasília)
  return GLOBAL_LOCKOUT_TIME.getTime() - Date.now()
}

/** Returns true if bets should be blocked (less than 1h before kickoff) */
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
