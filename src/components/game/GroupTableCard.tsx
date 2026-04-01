'use client'
// src/components/game/GroupTableCard.tsx
import { useState } from 'react'
import type { GroupBet, GroupTeamInfo } from '@/types'

interface Props {
  groupLabel: string
  teams: GroupTeamInfo[]
  existingBet?: GroupBet
  actualTop3?: string[]
  onBet: (data: { first_team: string; second_team: string; third_team: string }) => Promise<void>
}

export default function GroupTableCard({ groupLabel, teams, existingBet, actualTop3, onBet }: Props) {
  const [first, setFirst] = useState(existingBet?.first_team || '')
  const [second, setSecond] = useState(existingBet?.second_team || '')
  const [third, setThird] = useState(existingBet?.third_team || '')
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)

  const hasBet = !!existingBet && !editing
  const canSubmit = first && second && third && first !== second && first !== third && second !== third

  function availableFor(position: 'first' | 'second' | 'third') {
    const selected = { first, second, third }
    return teams.filter((team) => {
      if (position === 'first') return team.abbr !== selected.second && team.abbr !== selected.third
      if (position === 'second') return team.abbr !== selected.first && team.abbr !== selected.third
      return team.abbr !== selected.first && team.abbr !== selected.second
    })
  }

  async function handleSubmit() {
    if (!canSubmit) return
    setLoading(true)
    try {
      await onBet({ first_team: first, second_team: second, third_team: third })
      setEditing(false)
    } finally {
      setLoading(false)
    }
  }

  function getTeam(abbr: string) {
    return teams.find((team) => team.abbr === abbr)
  }

  function renderPositionRow(pos: string, abbr: string | undefined, color: string, key: string) {
    const team = getTeam(abbr || '')
    return (
      <div key={key} className="flex items-center gap-3 bg-dark-3 rounded-xl px-3 py-2">
        <span className={`text-sm font-black ${color} w-6`}>{pos}</span>
        <span className="text-lg">{team?.flag || '🏳️'}</span>
        <span className="text-sm font-medium">{team?.name || abbr || '-'}</span>
        <span className="text-xs text-muted ml-auto font-mono">{abbr || '-'}</span>
      </div>
    )
  }

  if (hasBet) {
    const betPositions = [
      { pos: '1º', abbr: existingBet.first_team, color: 'text-gold' },
      { pos: '2º', abbr: existingBet.second_team, color: 'text-silver' },
      { pos: '3º', abbr: existingBet.third_team, color: 'text-amber-600' },
    ]

    const resultPositions = [
      { pos: '1º', abbr: actualTop3?.[0], color: 'text-gold' },
      { pos: '2º', abbr: actualTop3?.[1], color: 'text-silver' },
      { pos: '3º', abbr: actualTop3?.[2], color: 'text-amber-600' },
    ]

    return (
      <div className="card overflow-hidden border-green/20">
        <div className="h-[2px] bg-green" />
        <div className="p-4">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold text-muted uppercase tracking-widest">📊 Grupo {groupLabel}</span>
            <div className="flex items-center gap-2">
              {existingBet.points_earned != null && (
                <span className="text-xs font-mono font-bold text-green">+{existingBet.points_earned}pts</span>
              )}
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-green/10 text-green">✅ Aposta feita</span>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-[10px] text-muted uppercase tracking-widest mb-1.5">Sua aposta</div>
              <div className="space-y-2">
                {betPositions.map(({ pos, abbr, color }) => renderPositionRow(pos, abbr, color, `bet-${pos}`))}
              </div>
            </div>

            <div>
              <div className="text-[10px] text-muted uppercase tracking-widest mb-1.5">Classificação do grupo</div>
              {actualTop3 ? (
                <div className="space-y-2">
                  {resultPositions.map(({ pos, abbr, color }) => renderPositionRow(pos, abbr, color, `result-${pos}`))}
                </div>
              ) : (
                <div className="text-xs text-muted bg-dark-3 rounded-xl px-3 py-2">Aguardando fim dos jogos do grupo.</div>
              )}
            </div>
          </div>

          <button
            onClick={() => setEditing(true)}
            className="mt-3 w-full text-xs text-muted hover:text-white border border-white/[0.08] rounded-xl py-2 transition-colors"
          >
            ✏️ Editar palpite
          </button>
        </div>
      </div>
    )
  }

  const positions = [
    { label: '1º Lugar', value: first, setter: setFirst, color: 'border-gold/30 focus:border-gold/60', position: 'first' as const },
    { label: '2º Lugar', value: second, setter: setSecond, color: 'border-white/20 focus:border-white/40', position: 'second' as const },
    { label: '3º Lugar', value: third, setter: setThird, color: 'border-amber-600/30 focus:border-amber-600/60', position: 'third' as const },
  ]

  return (
    <div className="card overflow-hidden hover:border-white/20 transition-all">
      <div className="h-[2px] bg-white/[0.04]" />
      <div className="p-4">
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs font-bold text-muted uppercase tracking-widest">📊 Grupo {groupLabel}</span>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-white/[0.06] text-muted">🕐 Aberto</span>
        </div>

        <div className="space-y-2 mb-3">
          {positions.map(({ label, value, setter, color, position }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-xs text-muted w-16 flex-shrink-0">{label}</span>
              <select
                value={value}
                onChange={(e) => setter(e.target.value)}
                className={`flex-1 px-3 py-2 bg-dark-3 border rounded-xl text-sm outline-none transition-colors appearance-none cursor-pointer ${color}`}
              >
                <option value="">Selecione...</option>
                {availableFor(position).map((team) => (
                  <option key={team.abbr} value={team.abbr}>
                    {team.flag} {team.name} ({team.abbr})
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {actualTop3 && (
          <div className="mb-3">
            <div className="text-[10px] text-muted uppercase tracking-widest mb-1.5">Classificação atual</div>
            <div className="space-y-2">
              {[
                { pos: '1º', abbr: actualTop3[0], color: 'text-gold' },
                { pos: '2º', abbr: actualTop3[1], color: 'text-silver' },
                { pos: '3º', abbr: actualTop3[2], color: 'text-amber-600' },
              ].map(({ pos, abbr, color }) => renderPositionRow(pos, abbr, color, `open-${pos}`))}
            </div>
          </div>
        )}

        <div className="text-[10px] text-muted mb-3 space-y-0.5">
          <div>🎯 Acertou 1 posição = <span className="text-green font-bold">2 pts</span></div>
          <div>🎯 Acertou 2 posições = <span className="text-green font-bold">4 pts</span></div>
          <div>🏆 Acertou as 3 posições = <span className="text-gold font-bold">10 pts</span></div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!canSubmit || loading}
          className="w-full py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-30 bg-green/20 border border-green/40 text-green hover:bg-green/30 disabled:hover:bg-green/20"
        >
          {loading ? '⏳ Salvando...' : '✅ Confirmar palpite'}
        </button>
      </div>
    </div>
  )
}
