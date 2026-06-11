'use client'
// src/components/game/GroupTableCard.tsx
import { useState, useEffect } from 'react'
import type { GroupBet, GroupTeamInfo, Match } from '@/types'

interface Props {
  groupLabel: string
  teams: GroupTeamInfo[]
  existingBet?: GroupBet
  actualTop3?: string[]
  onBet: (data: { first_team: string; second_team: string; third_team: string }) => Promise<void>
  locked?: boolean
  groupMatches?: Match[] // Jogos do grupo para verificar lock
}

export default function GroupTableCard({ groupLabel, teams, existingBet, actualTop3, onBet, locked = false, groupMatches = [] }: Props) {
  const [first, setFirst] = useState(existingBet?.first_team || '')
  const [second, setSecond] = useState(existingBet?.second_team || '')
  const [third, setThird] = useState(existingBet?.third_team || '')
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)

  // Verifica se algum jogo do grupo já começou ou terminou
  const groupLocked = locked || (() => {
    if (groupMatches.length === 0) return false
    const now = new Date()
    return groupMatches.some(m => {
      if (m.status === 'finished' || m.status === 'live') return true
      if (m.status === 'locked') return true
      // Verifica se o jogo começou (menos de 1h para o início)
      const matchTime = new Date(`${m.match_date}T${m.match_time}:00`)
      const msUntilStart = matchTime.getTime() - now.getTime()
      return msUntilStart <= 0
    })
  })()

  useEffect(() => {
    // Se o grupo trava enquanto usuário está editando, sai do modo edição
    if (groupLocked && editing) {
      setEditing(false)
    }
  }, [groupLocked, editing])

  const hasBet = !!existingBet && !editing
  const canSubmit = first && second && third && first !== second && first !== third && second !== third
  const canAutoCalculate = !!actualTop3 && actualTop3.length >= 3
  const isLocked = locked || (!existingBet && locked)

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

  function handleAutoCalculate() {
    if (!canAutoCalculate) return
    setFirst(actualTop3![0] || '')
    setSecond(actualTop3![1] || '')
    setThird(actualTop3![2] || '')
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
        </div>
      </div>
    )
  }

// Override da variavel isLocked para usar o groupLocked dinamico
  const isGroupLocked = groupLocked

  const positions = [
    { label: '1º Lugar', value: first, setter: setFirst, color: 'border-gold/30 focus:border-gold/60', position: 'first' as const },
    { label: '2º Lugar', value: second, setter: setSecond, color: 'border-white/20 focus:border-white/40', position: 'second' as const },
    { label: '3º Lugar', value: third, setter: setThird, color: 'border-amber-600/30 focus:border-amber-600/60', position: 'third' as const },
  ]

  return (
    <div className={`card overflow-hidden transition-all ${isGroupLocked ? 'border-red/20' : 'hover:border-white/20'}`}>
      <div className={`h-[2px] ${isGroupLocked ? 'bg-red' : 'bg-white/[0.04]'}`} />
      <div className="p-4">
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs font-bold text-muted uppercase tracking-widest">📊 Grupo {groupLabel}</span>
          {isGroupLocked ? (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-red/10 text-red">🔒 Encerrado</span>
          ) : (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-white/[0.06] text-muted">🕐 Aberto</span>
          )}
        </div>

        <div className="space-y-2 mb-3">
          {positions.map(({ label, value, setter, color, position }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-xs text-muted w-16 flex-shrink-0">{label}</span>
              <select
                value={value}
                onChange={(e) => setter(e.target.value)}
                disabled={isGroupLocked}
                className={`flex-1 px-3 py-2 bg-dark-3 border rounded-xl text-sm outline-none transition-colors appearance-none cursor-pointer ${color} ${isGroupLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
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

        {!isGroupLocked ? (
          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={handleAutoCalculate}
              disabled={!canAutoCalculate || loading}
              className="w-full py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-30 bg-blue/20 border border-blue/40 text-blue hover:bg-blue/30 disabled:hover:bg-blue/20"
            >
              🧮 Calcular minha aposta
            </button>

            {!canAutoCalculate && (
              <p className="text-[10px] text-muted text-center px-2">
                Ainda não há dados suficientes para calcular automaticamente.
                Você pode escolher sua aposta manualmente.
              </p>
            )}

            <button
              onClick={handleSubmit}
              disabled={!canSubmit || loading}
              className="w-full py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-30 bg-green/20 border border-green/40 text-green hover:bg-green/30 disabled:hover:bg-green/20"
            >
              {loading ? '⏳ Salvando...' : '✅ Confirmar palpite'}
            </button>
          </div>
        ) : (
          <div className="text-xs text-muted text-center py-2 bg-dark-3 rounded-xl">
            ⏱ Apostas encerradas para este grupo.
          </div>
        )}
      </div>
    </div>
  )
}
