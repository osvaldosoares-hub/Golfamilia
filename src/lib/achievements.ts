// src/lib/achievements.ts

export interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  color: string // gradient class
}

export interface AchievementWithUnlock extends Achievement {
  unlocked: boolean
  unlockedAt?: string
}

// Todas as conquistas disponíveis
export const ALL_ACHIEVEMENTS: Achievement[] = [
  // Primeiros passos
  { id: 'first_bet', name: 'Primeiro Palpite', description: 'Fez seu primeiro palpite', icon: '✅', color: 'from-green to-emerald-400' },
  { id: 'first_exact', name: 'Placar na Mosca', description: 'Acertou um placar exato', icon: '🎯', color: 'from-green to-gold' },
  { id: 'first_winner', name: 'Vencedor Certo', description: 'Acertou o vencedor de uma partida', icon: '🏆', color: 'from-gold to-green' },

  // Quantidade de palpites
  { id: 'bets_10', name: 'Apostador Iniciante', description: '10 palpites no total', icon: '📝', color: 'from-blue to-green' },
  { id: 'bets_50', name: 'Apostador Dedicado', description: '50 palpites no total', icon: '✍️', color: 'from-blue to-purple' },
  
  // Placar exato
  { id: 'exact_3', name: 'Pontaria Fina', description: '3 placares exatos', icon: '🎯', color: 'from-green to-cyan' },
  { id: 'exact_5', name: 'Sniper', description: '5 placares exatos', icon: '🔫', color: 'from-cyan to-blue' },
  { id: 'exact_10', name: 'Mestre dos Placares', description: '10 placares exatos', icon: '🧠', color: 'from-purple to-gold' },

  // Ranking
  { id: 'rank_first', name: 'Número 1 🥇', description: 'Chegou em 1º lugar no ranking', icon: '👑', color: 'from-gold to-amber' },
  { id: 'rank_top3', name: 'Pódio', description: 'Chegou no top 3', icon: '🥉', color: 'from-gold to-green' },
  { id: 'rank_top5', name: 'Respeitável', description: 'Ficou entre os 5 primeiros', icon: '📈', color: 'from-green to-blue' },
  { id: 'rank_climb_5', name: 'Subida Relâmpago', description: 'Subiu 5+ posições de uma vez', icon: '⬆️', color: 'from-green to-emerald' },

  // Grupo
  { id: 'group_first', name: 'Cartola do Grupo', description: 'Acertou as 3 posições de um grupo', icon: '📊', color: 'from-blue to-gold' },
  { id: 'group_podium', name: 'Quase Perfeito', description: 'Acertou 2 posições de um grupo', icon: '📋', color: 'from-blue to-green' },

]

export interface AchievementInput {
  totalBets: number
  exactScoreHits: number
  winnerHits: number
  groupBetHits3: number // grupos que acertou as 3 posições
  groupBetHits2: number // grupos que acertou 2 posições
  myRank: number | null
  rankClimb: number | null // quantas posições subiu (null = sem histórico)
  coinsInRoom: number
  hasKnockoutBet: boolean
  groupsWithBets: number
  totalGroups: number
}

export function checkAchievements(input: AchievementInput): AchievementWithUnlock[] {
  const unlocked: AchievementWithUnlock[] = ALL_ACHIEVEMENTS.map(a => ({ ...a, unlocked: false }))

  // first_bet
  if (input.totalBets >= 1) unlock(unlocked, 'first_bet')
  // first_exact
  if (input.exactScoreHits >= 1) unlock(unlocked, 'first_exact')
  // first_winner
  if (input.winnerHits >= 1) unlock(unlocked, 'first_winner')

  // bets milestones
  if (input.totalBets >= 10) unlock(unlocked, 'bets_10')
  if (input.totalBets >= 50) unlock(unlocked, 'bets_50')
  
  // exact milestones
  if (input.exactScoreHits >= 3) unlock(unlocked, 'exact_3')
  if (input.exactScoreHits >= 5) unlock(unlocked, 'exact_5')
  if (input.exactScoreHits >= 10) unlock(unlocked, 'exact_10')

  // ranking
  if (input.myRank !== null && input.myRank <= 1) unlock(unlocked, 'rank_first')
  if (input.myRank !== null && input.myRank <= 3) unlock(unlocked, 'rank_top3')
  if (input.myRank !== null && input.myRank <= 6) unlock(unlocked, 'rank_top5')
  if (input.rankClimb !== null && input.rankClimb >= 5) unlock(unlocked, 'rank_climb_5')

  // group bets
  if (input.groupBetHits3 >= 1) unlock(unlocked, 'group_first')
  if (input.groupBetHits2 >= 1) unlock(unlocked, 'group_podium')

  
  return unlocked
}

function unlock(list: AchievementWithUnlock[], id: string) {
  const ach = list.find(a => a.id === id)
  if (ach) ach.unlocked = true
}