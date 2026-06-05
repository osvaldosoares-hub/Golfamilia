'use client'
// src/components/ui/AchievementsCard.tsx
import { useState, useMemo } from 'react'
import type { AchievementWithUnlock } from '@/lib/achievements'
import { ALL_ACHIEVEMENTS, checkAchievements } from '@/lib/achievements'
import type { LeaderboardEntry, Bet, GroupBet, Match } from '@/types'

interface Props {
  leaderboard: LeaderboardEntry[]
  bets: Record<string, Bet>
  groupBets: Record<string, GroupBet>
  allMatches: Match[]
  coinsInRoom: number
  myRank: number
  previousRank: number | null
}

export default function AchievementsCard({ leaderboard, bets, groupBets, allMatches, coinsInRoom, myRank, previousRank }: Props) {
  const [showAll, setShowAll] = useState(false)

  const achievements = useMemo(() => {
    const betList = Object.values(bets)
    const groupBetList = Object.values(groupBets)

    // Conta acertos
    let exactScoreHits = 0
    let winnerHits = 0

    betList.forEach(b => {
      const match = allMatches.find(m => m.id === b.match_id)
      if (!match) return
      const h = match.home_score
      const a = match.away_score
      if (h == null || a == null) return

      // Placar exato
      if (Number(b.predicted_home) === h && Number(b.predicted_away) === a) {
        exactScoreHits++
      }

      // Vencedor
      const predWinner = b.predicted_home > b.predicted_away ? 'home' : b.predicted_away > b.predicted_home ? 'away' : 'draw'
      const actualWinner = h > a ? 'home' : a > h ? 'away' : 'draw'
      if (predWinner === actualWinner) {
        winnerHits++
      }
    })

    // Conta acertos de grupo (simplificado: só sabe se acertou se o bet existir e tiver points_earned)
    let groupBetHits3 = 0
    let groupBetHits2 = 0
    groupBetList.forEach(gb => {
      if (gb.points_earned && gb.points_earned >= 10) groupBetHits3++
      else if (gb.points_earned && gb.points_earned >= 4) groupBetHits2++
    })

    // Grupos com palpite
    const groupsWithBets = new Set(groupBetList.map(gb => gb.group_label)).size
    const totalGroups = new Set(allMatches.filter(m => m.phase === 'group').map(m => m.group_label)).size

    // Aposta no mata-mata
    const hasKnockoutBet = betList.some(b => {
      const match = allMatches.find(m => m.id === b.match_id)
      return match && match.phase && match.phase !== 'group'
    })

    // Subiu de posição?
    const rankClimb = previousRank != null ? previousRank - myRank : null

    return checkAchievements({
      totalBets: betList.length,
      exactScoreHits,
      winnerHits,
      groupBetHits3,
      groupBetHits2,
      myRank,
      rankClimb,
      coinsInRoom,
      hasKnockoutBet,
      groupsWithBets,
      totalGroups,
    })
  }, [bets, groupBets, allMatches, coinsInRoom, myRank, previousRank])

  const unlockedCount = achievements.filter(a => a.unlocked).length
  const totalCount = achievements.length

  const displayAchievements = showAll ? achievements : achievements.filter(a => a.unlocked).slice(0, 5)

  return (
    <div className="card p-5 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-purple to-gold" />
      <p className="text-xs font-bold text-muted uppercase tracking-widest mb-4">🏅 Conquistas</p>

      <div className="text-center mb-4">
        <span className="text-2xl font-black text-gold">{unlockedCount}</span>
        <span className="text-muted text-sm"> / {totalCount}</span>
        <div className="w-full bg-dark-3 rounded-full h-2 mt-2 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-purple to-gold transition-all duration-500"
            style={{ width: `${(unlockedCount / totalCount) * 100}%` }}
          />
        </div>
      </div>

      <div className="space-y-2">
        {displayAchievements.map(ach => (
          <div
            key={ach.id}
            className={`flex items-center gap-3 p-2.5 rounded-xl transition-all ${
              ach.unlocked
                ? 'bg-gradient-to-r opacity-100'
                : 'opacity-30 grayscale'
            }`}
            style={ach.unlocked ? { background: `linear-gradient(135deg, rgba(var(--color), 0.1), transparent)` } : {}}
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base bg-gradient-to-br ${ach.color}`}>
              {ach.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold truncate">{ach.name}</div>
              <div className="text-[10px] text-muted truncate">{ach.description}</div>
            </div>
            <span className={`text-xs ${ach.unlocked ? 'text-green' : 'text-muted'}`}>
              {ach.unlocked ? '🔓' : '🔒'}
            </span>
          </div>
        ))}
      </div>

      {(unlockedCount > 5 || !showAll) && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full text-xs text-muted hover:text-white mt-3 pt-3 border-t border-white/[0.06] transition-colors"
        >
          {showAll ? 'Mostrar só as desbloqueadas' : `Ver todas (${totalCount})`}
        </button>
      )}
    </div>
  )
}