'use client'
// src/components/game/MatchCard.tsx
import { useState, useEffect } from 'react'
import type { Match, Bet } from '@/types'
import { msUntilLockout } from '@/lib/utils'

interface BetData {
  predicted_home: number
  predicted_away: number
  predicted_qualifier?: string
}

interface BetStats {
  total: number
  counts: Record<string, number>
  avg_home: number | null
  avg_away: number | null
  scores_count: number
}

interface Props {
  match: Match
  existingBet?: Bet
  onBet: (data: BetData) => Promise<void>
  betStats?: BetStats
}

export default function MatchCard({ match, existingBet, onBet, betStats }: Props) {
  const [scoreH, setScoreH] = useState<string>(existingBet ? String(existingBet.predicted_home) : '')
  const [scoreA, setScoreA] = useState<string>(existingBet ? String(existingBet.predicted_away) : '')
  const [qualifier, setQualifier] = useState<string>(existingBet?.predicted_qualifier || '')
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [timeLeft, setTimeLeft] = useState<number>(() => msUntilLockout(match.match_date, match.match_time))

  // Countdown timer — update every second when < 2 hours
  useEffect(() => {
    const ms = msUntilLockout(match.match_date, match.match_time)
    setTimeLeft(ms)
    if (ms <= 0 || ms > 2 * 60 * 60 * 1000) return
    const interval = setInterval(() => {
      const remaining = msUntilLockout(match.match_date, match.match_time)
      setTimeLeft(remaining)
      if (remaining <= 0) clearInterval(interval)
    }, 1000)
    return () => clearInterval(interval)
  }, [match.match_date, match.match_time])

  const timeLocked = timeLeft <= 0
  const hasBet = !!existingBet && !editing
  const locked = match.status !== 'open' || timeLocked

  const canSubmit = scoreH !== '' && scoreA !== ''

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    try {
      await onBet({
        predicted_home: parseInt(scoreH),
        predicted_away: parseInt(scoreA),
        predicted_qualifier: qualifier || undefined,
      })
      setEditing(false)
    } finally {
      setLoading(false)
    }
  }

  // Derive qualifier from score when changed
  useEffect(() => {
    const h = parseInt(scoreH)
    const a = parseInt(scoreA)
    if (!isNaN(h) && !isNaN(a) && !qualifier) {
      if (h > a) setQualifier(match.home_abbr)
      else if (a > h) setQualifier(match.away_abbr)
      else setQualifier('DRAW')
    }
  }, [scoreH, scoreA])

  // Format countdown string
  const countdownLabel = (() => {
    if (timeLeft <= 0) return null
    if (timeLeft > 60 * 60 * 1000) return null // only show when < 1h
    const mins = Math.floor(timeLeft / 60000)
    const secs = Math.floor((timeLeft % 60000) / 1000)
    return `⏱ ${mins}:${String(secs).padStart(2, '0')}`
  })()

  return (
    <div className={`card overflow-hidden transition-all ${hasBet ? 'border-green/20' : 'hover:border-white/20'}`}>
      <div className={`h-[2px] ${hasBet ? 'bg-green' : timeLocked ? 'bg-red' : 'bg-white/[0.04]'}`} />

      <div className="p-5">
        {/* Meta */}
        <div className="flex justify-between items-center mb-4">
          <span className="text-xs text-muted font-mono">
            ⚽ Grupo {match.group_label} · {match.match_date} {match.match_time}
          </span>
          <div className="flex items-center gap-1.5">
            {countdownLabel && !locked && (
              <div className="text-xs font-bold px-2.5 py-1 rounded-full bg-gold/10 text-gold animate-pulse">
                {countdownLabel}
              </div>
            )}
            <div className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              locked ? 'bg-red/10 text-red' :
              hasBet ? 'bg-green/10 text-green' :
              'bg-white/[0.06] text-muted'
            }`}>
              {locked ? '🔒 Encerrado' : hasBet ? '✅ Aposta feita' : '🕐 Aberto'}
            </div>
          </div>
        </div>

        {/* Teams + Score */}
        <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center mb-4">
          {/* Home */}
          <div className="text-center">
            <div className="text-4xl mb-1">{match.home_flag}</div>
            <div className="text-sm font-bold truncate">{match.home_team}</div>
            <div className="text-xs text-muted">{match.home_abbr}</div>
          </div>

          {/* Score inputs */}
          <div className="flex flex-col items-center gap-1">
            <div className="text-[10px] text-muted uppercase tracking-widest mb-1">Placar</div>
            <div className="flex items-center gap-2">
              {hasBet ? (
                <div className="flex items-center gap-2">
                  <div className="w-12 h-12 flex items-center justify-center bg-dark-3 border border-green/20 rounded-xl font-mono text-xl font-bold text-green">
                    {existingBet!.predicted_home}
                  </div>
                  <span className="text-muted text-xl font-bold">:</span>
                  <div className="w-12 h-12 flex items-center justify-center bg-dark-3 border border-green/20 rounded-xl font-mono text-xl font-bold text-green">
                    {existingBet!.predicted_away}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    className="score-input"
                    value={scoreH}
                    min={0} max={20}
                    placeholder="0"
                    disabled={locked}
                    onChange={e => setScoreH(e.target.value)}
                  />
                  <span className="text-muted text-xl font-bold">:</span>
                  <input
                    type="number"
                    className="score-input"
                    value={scoreA}
                    min={0} max={20}
                    placeholder="0"
                    disabled={locked}
                    onChange={e => setScoreA(e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Away */}
          <div className="text-center">
            <div className="text-4xl mb-1">{match.away_flag}</div>
            <div className="text-sm font-bold truncate">{match.away_team}</div>
            <div className="text-xs text-muted">{match.away_abbr}</div>
          </div>
        </div>
          
        {/* Bet distribution bar */}
        {betStats && betStats.total > 0 && (() => {
          const homeCount = betStats.counts[match.home_abbr] || 0
          const drawCount = betStats.counts['DRAW'] || 0
          const awayCount = betStats.counts[match.away_abbr] || 0
          const total = betStats.total
          const homePct = Math.round((homeCount / total) * 100)
          const drawPct = Math.round((drawCount / total) * 100)
          const awayPct = 100 - homePct - drawPct

          return (
            <div className="mb-4">
              <div className="flex justify-between text-[10px] text-muted uppercase tracking-widest mb-1.5">
                <span>📊 Palpites da sala ({total})</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] mb-1">
                <span className="font-bold text-blue">{match.home_abbr} {homePct}%</span>
                <span className="flex-1" />
                <span className="font-bold text-muted">Empate {drawPct}%</span>
                <span className="flex-1" />
                <span className="font-bold text-red text-right">{match.away_abbr} {awayPct}%</span>
              </div>
              <div className="flex h-2 rounded-full overflow-hidden bg-dark-3 border border-white/[0.06]">
                {homePct > 0 && (
                  <div
                    className="bg-blue transition-all duration-500"
                    style={{ width: `${homePct}%` }}
                  />
                )}
                {drawPct > 0 && (
                  <div
                    className="bg-white/20 transition-all duration-500"
                    style={{ width: `${drawPct}%` }}
                  />
                )}
                {awayPct > 0 && (
                  <div
                    className="bg-red transition-all duration-500"
                    style={{ width: `${awayPct}%` }}
                  />
                )}
              </div>
              {betStats.scores_count > 0 && betStats.avg_home != null && betStats.avg_away != null && (
                <div className="mt-2 text-[11px] text-muted">
                  📈 Média de placar: <span className="text-white font-bold">{betStats.avg_home}</span>
                  <span className="mx-1">x</span>
                  <span className="text-white font-bold">{betStats.avg_away}</span>
                  <span className="ml-1 text-[10px]">({betStats.scores_count} palpites)</span>
                </div>
              )}
            </div>
          )
        })()}

        {/* Qualifier + Bet amount */}
        {!locked && (
          <>
            {/* Show bet summary if placed */}
            {hasBet ? (
              <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <div className="text-xs text-muted">Classificado:</div>
                  <div className="text-xs font-bold text-white">
                    {existingBet!.predicted_qualifier === 'DRAW' ? '🤝 Empate/Ambos' :
                     existingBet!.predicted_qualifier === match.home_abbr ? `${match.home_flag} ${match.home_abbr}` :
                     `${match.away_flag} ${match.away_abbr}`}
                  </div>
                </div>
                <button
                  onClick={() => setEditing(true)}
                  className="text-xs text-muted hover:text-white border border-white/[0.08] rounded-lg px-3 py-1.5 transition-colors"
                >
                  ✏️ Editar
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="pt-3 border-t border-white/[0.06] space-y-3">
                {/* Qualifier */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted">Quem se Ganha?</span>
                  <div className="flex gap-1.5">
                    {[
                      { value: match.home_abbr, label: `${match.home_flag} ${match.home_abbr}` },
                      { value: 'DRAW', label: '🤝 Empate' },
                      { value: match.away_abbr, label: `${match.away_flag} ${match.away_abbr}` },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setQualifier(opt.value)}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-all font-bold ${
                          qualifier === opt.value
                            ? 'bg-green/10 border-green/40 text-green'
                            : 'bg-dark-3 border-white/[0.08] text-muted hover:border-white/20'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Submit */}
                <div className="flex items-center justify-end">
                  <button
                    type="submit"
                    disabled={!canSubmit || loading}
                    className="btn-primary text-sm py-2 px-4"
                  >
                    {loading ? '...' : editing ? 'Atualizar ✅' : 'Confirmar ✅'}
                  </button>
                </div>
              </form>
            )}
          </>
        )}

        {locked && (
          <div className="pt-3 border-t border-white/[0.06] text-xs text-muted text-center">
            {timeLocked && match.status === 'open'
              ? '⏱ Apostas encerradas — menos de 1h para o início do jogo'
              : 'Apostas encerradas para este jogo'}
          </div>
        )}
      </div>
    </div>
  )
}
