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
