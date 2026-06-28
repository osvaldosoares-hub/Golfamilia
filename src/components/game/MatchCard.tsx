'use client'
// src/components/game/MatchCard.tsx
import { useState, useEffect } from 'react'
import type { Match, Bet } from '@/types'
import { msUntilLockout, formatMatchTimeForDisplay, getCorrectedMatchTime } from '@/lib/utils'

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
  isDoublePoints?: boolean
  userId?: string
}

// Whitelist de usuários que podem fazer apostas mesmo após o bloqueio global
const BETTING_WHITELIST = new Set([
  'adf4ff21-e1b5-4fdb-ac43-6eda9a8aab5b'
])

export default function MatchCard({ match, existingBet, onBet, betStats, isDoublePoints, userId }: Props) {
  const [scoreH, setScoreH] = useState<string>(existingBet ? String(existingBet.predicted_home) : '')
  const [scoreA, setScoreA] = useState<string>(existingBet ? String(existingBet.predicted_away) : '')
  const [qualifier, setQualifier] = useState<string>(existingBet?.predicted_qualifier || '')
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [timeLeft, setTimeLeft] = useState<number>(() => msUntilLockout(match.match_date, match.match_time))

// Countdown timer — update every second when < 1 hour
  useEffect(() => {
    const ms = msUntilLockout(match.match_date, match.match_time)
    setTimeLeft(ms)
    if (ms <= 0 || ms > 60 * 60 * 1000) return
    const interval = setInterval(() => {
      const remaining = msUntilLockout(match.match_date, match.match_time)
      setTimeLeft(remaining)
      if (remaining <= 0) clearInterval(interval)
    }, 1000)
    return () => clearInterval(interval)
  }, [match.match_date, match.match_time])

const timeLocked = timeLeft <= 0
  const hasBet = !!existingBet && !editing
  const isLive = match.status === 'live'
  const isScheduled = match.status === 'scheduled'
  const isFinished = match.status === 'finished' || (match.home_score != null && match.away_score != null)
  
  // Verifica se o usuário está na whitelist
  const isUserWhitelisted = userId && BETTING_WHITELIST.has(userId)
  
// Bloqueia se:
  // 1. Jogo foi finalizado (acabou)
  // 2. Jogo está ao vivo (começou)
  // 3. O horário do jogo já passou (timeLeft <= 0), mesmo que status não foi atualizado no banco
  const locked = isFinished || isLive || timeLocked

  // If the match gets locked/finished while the user is editing, return to view mode.
  useEffect(() => {
    if (locked && editing) {
      setEditing(false)
    }
  }, [locked, editing])

  const canSubmit = scoreH !== '' && scoreA !== ''

const hasRealResult = match.status === 'finished' && match.home_score != null && match.away_score != null
  const hasRealResultOrLive = (match.status === 'finished' || match.status === 'live') && match.home_score != null && match.away_score != null

  const realWinnerLabel = (() => {
    if (!hasRealResult) return null
    if (match.qualifier === 'DRAW') return '🤝 Empate'
    if (match.qualifier === match.home_abbr) return `${match.home_flag} ${match.home_abbr}`
    if (match.qualifier === match.away_abbr) return `${match.away_flag} ${match.away_abbr}`
    return match.qualifier || '—'
  })()

  const predictedWinnerLabel = (() => {
    if (!existingBet?.predicted_qualifier) return null
    if (existingBet.predicted_qualifier === 'DRAW') return '🤝 Empate'
    if (existingBet.predicted_qualifier === match.home_abbr) return `${match.home_flag} ${match.home_abbr}`
    if (existingBet.predicted_qualifier === match.away_abbr) return `${match.away_flag} ${match.away_abbr}`
    return existingBet.predicted_qualifier
  })()

  const earnedPoints = existingBet?.points_earned

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

    // Format countdown string with hours, minutes, seconds
const countdownLabel = (() => {
    // Sempre mostrar o countdown
    const hours = Math.floor(timeLeft / (60 * 60 * 1000))
    const mins = Math.floor((timeLeft % (60 * 60 * 1000)) / 60000)
    const secs = Math.floor((timeLeft % 60000) / 1000)
    
    if (timeLeft <= 0) {
      return '🔒 Apostas encerradas'
    } else if (hours > 0) {
      return `⏱ ${hours}h ${mins}m para encerrar`
    } else if (mins > 0) {
      return `⏱ ${mins}m ${secs}s para encerrar`
    } else {
      return `⏱ ${secs}s para encerrar`
    }
  })()

  // Skeleton loading state while submitting bet
  if (loading) {
    return (
      <div className="card overflow-hidden">
        <div className="h-[2px] bg-white/[0.04]" />
        <div className="p-5 space-y-4">
          <div className="flex justify-between">
            <div className="skeleton h-4 w-32 rounded" />
            <div className="skeleton h-5 w-20 rounded" />
          </div>
          <div className="flex justify-around py-4">
            <div className="text-center space-y-2">
              <div className="skeleton h-10 w-10 rounded-full mx-auto" />
              <div className="skeleton h-4 w-20 rounded" />
            </div>
            <div className="flex items-center gap-2">
              <div className="skeleton h-12 w-12 rounded-lg" />
              <div className="skeleton h-4 w-2 rounded" />
              <div className="skeleton h-12 w-12 rounded-lg" />
            </div>
            <div className="text-center space-y-2">
              <div className="skeleton h-10 w-10 rounded-full mx-auto" />
              <div className="skeleton h-4 w-20 rounded" />
            </div>
          </div>
          <div className="skeleton h-10 w-full rounded-lg" />
        </div>
      </div>
    )
  }

  return (
    <div className={`card overflow-hidden transition-all ${hasBet ? 'border-green/20' : 'hover:border-white/20'}`}>
      <div className={`h-[2px] ${hasBet ? 'bg-green' : timeLocked ? 'bg-red' : 'bg-white/[0.04]'}`} />

      <div className="p-5">
{/* Meta */}
        <div className="flex justify-between items-center mb-4">
<span className="text-xs text-muted font-mono">
            ⚽ {match.phase} {match.group_label} · {match.match_date} {getCorrectedMatchTime(match.match_time)}
          </span>
<div className="flex items-center gap-1.5">
{/* 2x Badge with Fire Animation */}
            {isDoublePoints && !locked && (
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 to-red-600 rounded-lg blur opacity-40 animate-pulse" />
                <div className="relative flex items-center gap-1.5 text-sm font-black px-3 py-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg shadow-orange-500/30 animate-bounce">
                  <span className="animate-pulse">🔥</span>
                  <span className="tracking-wider">2X</span>
                  <span className="animate-pulse">🔥</span>
                </div>
              </div>
            )}
{/* Status Badge: AO VIVO, Marcado, Encerrado/Terminado, FINALIZADO */}
            {isLive ? (
              <div className="text-xs font-bold px-2.5 py-1 rounded-full bg-red/10 text-red animate-pulse flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-red animate-ping" />
                <span>🔴 AO VIVO{match.match_phase ? ` · ${match.match_phase}` : ''}</span>
              </div>
            ) : isScheduled && !isLive ? (
              <div className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue/10 text-blue flex items-center gap-1">
                <span>📅 Marcado</span>
              </div>
) : hasRealResult ? (
              <div className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-green/20 text-green flex items-center gap-1">
                <span>✅</span>
                <span>FINALIZADO</span>
                <span>✅</span>
              </div>
) : locked || timeLeft <= 0 ? (
              <div className="text-xs font-bold px-2.5 py-1 rounded-full bg-red/10 text-red flex items-center gap-1">
                <span>🔒</span>
                <span>Terminado</span>
              </div>
) : timeLeft > 0 && timeLeft <= 60 * 60 * 1000 ? (
              <div className={`text-xs font-bold px-3 py-1.5 rounded-lg border animate-pulse flex items-center gap-1.5 ${
                timeLeft <= 5 * 60 * 1000 
                  ? 'bg-red/20 border-red/50 text-red' 
                  : timeLeft <= 30 * 60 * 1000
                  ? 'bg-orange/20 border-orange/50 text-orange'
                  : 'bg-gold/20 border-gold/50 text-gold'
              }`}>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                {countdownLabel}
              </div>
            ) : hasBet ? (
              <div className="text-xs font-bold px-2.5 py-1 rounded-full bg-green/10 text-green flex items-center gap-1">
                <span>✅</span>
                <span>Aposta feita</span>
              </div>
            ) : (
              <div className="text-xs font-bold px-2.5 py-1 rounded-full bg-white/[0.06] text-muted flex items-center gap-1">
                <span>🕐</span>
                <span>Aberto</span>
              </div>
            )}
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
              {/* SEMPRE mostra o placar real quando jogo tem resultado (ao vivo ou finalizado) */}
              {(isFinished || isLive) && match.home_score != null && match.away_score != null ? (
                <div className="flex flex-col gap-2">
                  {/* Se tem aposta, mostra aposta acima do resultado */}
                  {hasBet && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted uppercase tracking-widest">A</span>
                      <div className="w-10 h-10 flex items-center justify-center bg-dark-3 border border-green/20 rounded-lg font-mono text-lg font-bold text-green">
                        {existingBet!.predicted_home}
                      </div>
                      <span className="text-muted text-lg font-bold">:</span>
                      <div className="w-10 h-10 flex items-center justify-center bg-dark-3 border border-green/20 rounded-lg font-mono text-lg font-bold text-green">
                        {existingBet!.predicted_away}
                      </div>
                    </div>
                  )}
{/* Mostra resultado SEMPRE (com ou sem aposta) - com siglas quando finalizado */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted uppercase tracking-widest ">R</span>
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 flex items-center justify-center bg-dark-3 border border-gold/30 rounded-lg font-mono text-lg font-black text-gold">
                        {match.home_score}
                      </div>
                      <div className="text-[10px] text-gold font-bold mt-0.5">{match.home_abbr}</div>
                    </div>
                    <span className="text-muted text-lg font-bold">:</span>
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 flex items-center justify-center bg-dark-3 border border-gold/30 rounded-lg font-mono text-lg font-black text-gold">
                        {match.away_score}
                      </div>
                      <div className="text-[10px] text-gold font-bold mt-0.5">{match.away_abbr}</div>
                    </div>
                  </div>
                </div>
              ) : hasBet ? (
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
              {betStats.scores_count > 2 && betStats.avg_home != null && betStats.avg_away != null && (
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
            {hasBet && !locked ? (
              <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <div className="text-xs text-muted">Palpite:</div>
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
            ) : hasBet && locked ? (
              <div className="pt-3 border-t border-white/[0.06] text-xs text-muted text-center">
                <div className="text-xs text-muted">Palpite: {existingBet!.predicted_qualifier === 'DRAW' ? '🤝 Empate/Ambos' :
                     existingBet!.predicted_qualifier === match.home_abbr ? `${match.home_flag} ${match.home_abbr}` :
                     `${match.away_flag} ${match.away_abbr}`}</div>
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

                {/* Submit + Time Warning */}
                <div className="space-y-2">
                  {timeLeft > 0 && timeLeft <= 30 * 60 * 1000 && (
                    <div className={`text-xs p-3 rounded-lg border text-center font-bold ${
                      timeLeft <= 5 * 60 * 1000
                        ? 'bg-red/20 border-red/50 text-red animate-pulse'
                        : timeLeft <= 15 * 60 * 1000
                        ? 'bg-orange/20 border-orange/50 text-orange'
                        : 'bg-gold/20 border-gold/50 text-gold'
                    }`}>
                      ⏰ Apostas encerram em {Math.max(0, Math.floor(timeLeft / 60000))}m {Math.floor((timeLeft % 60000) / 1000)}s
                    </div>
                  )}
                  <div className="flex items-center justify-end">
                    <button
                      type="submit"
                      disabled={!canSubmit || loading}
                      className="btn-primary text-sm py-2 px-4"
                    >
                      {loading ? '...' : editing ? 'Atualizar ✅' : 'Confirmar ✅'}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </>
        )}

        {locked && (
          <div className="pt-3 border-t border-white/[0.06] text-xs text-muted text-center space-y-2">
            <div>
              {timeLocked && match.status === 'open'
                ? '⏱ Apostas encerradas — menos de 1h para o início do jogo'
                : 'Apostas encerradas para este jogo'}
            </div>
            {isFinished && realWinnerLabel && (
              <div className="space-y-1 text-[11px]">
                {earnedPoints != null && (
                  <div>
                    Pontuação: <span className="font-bold text-gold">+{earnedPoints} pts</span>
                  </div>
                )}
                {predictedWinnerLabel && (
                  <div>
                    Seu palpite: <span className="font-bold text-green">{predictedWinnerLabel}</span>
                  </div>
                )}
                <div>
                  Resultado: <span className="font-bold text-white">{realWinnerLabel}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
