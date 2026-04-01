'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Bet, GroupBet, Match } from '@/types'
import { getPhaseLabel, msUntilLockout } from '@/lib/utils'

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
  matches: Match[]
  bets: Record<string, Bet>
  groupBets: Record<string, GroupBet>
  teamMetaByAbbr: Record<string, { name: string; flag: string }>
  onBet: (matchId: string, data: BetData) => Promise<void>
  onSimulateNow: () => Promise<void>
  simulateLoading: boolean
  betStats?: Record<string, BetStats>
  isReleased: boolean
}

type SimulatedMatch = Match & {
  display_home_abbr: string
  display_away_abbr: string
  display_home_team: string
  display_away_team: string
  display_home_flag: string
  display_away_flag: string
}

type BracketLayoutSide = {
  r32: number[]
  r16: number[]
  qf: number[]
  sf: number[]
}

const BRACKET_CANVAS_HEIGHT = 2140
const BRACKET_CANVAS_WIDTH = 1760

const KNOCKOUT_PHASE_ORDER = ['r32', 'r16', 'qf', 'sf', 'final', 'third']

const KNOCKOUT_TEMPLATE: Array<{
  no: number
  phase: 'r32' | 'r16' | 'qf' | 'sf' | 'final'
  date: string
  homeSlot: string
  awaySlot: string
}> = [
  { no: 73, phase: 'r32', date: '28 Jun', homeSlot: '2A', awaySlot: '2B' },
  { no: 74, phase: 'r32', date: '29 Jun', homeSlot: '1E', awaySlot: '3A/B/C/D/F' },
  { no: 75, phase: 'r32', date: '29 Jun', homeSlot: '1F', awaySlot: '2C' },
  { no: 76, phase: 'r32', date: '29 Jun', homeSlot: '1C', awaySlot: '2F' },
  { no: 77, phase: 'r32', date: '30 Jun', homeSlot: '1I', awaySlot: '3C/D/F/G/H' },
  { no: 78, phase: 'r32', date: '30 Jun', homeSlot: '2E', awaySlot: '2I' },
  { no: 79, phase: 'r32', date: '30 Jun', homeSlot: '1A', awaySlot: '3C/E/F/H/I' },
  { no: 80, phase: 'r32', date: '1 Jul', homeSlot: '1L', awaySlot: '3E/H/I/J/K' },
  { no: 81, phase: 'r32', date: '1 Jul', homeSlot: '1D', awaySlot: '3B/E/F/I/J' },
  { no: 82, phase: 'r32', date: '1 Jul', homeSlot: '1G', awaySlot: '3A/E/H/I/J' },
  { no: 83, phase: 'r32', date: '2 Jul', homeSlot: '2K', awaySlot: '2L' },
  { no: 84, phase: 'r32', date: '2 Jul', homeSlot: '1H', awaySlot: '2J' },
  { no: 85, phase: 'r32', date: '2 Jul', homeSlot: '1B', awaySlot: '3E/F/G/I/J' },
  { no: 86, phase: 'r32', date: '3 Jul', homeSlot: '1J', awaySlot: '2H' },
  { no: 87, phase: 'r32', date: '3 Jul', homeSlot: '1K', awaySlot: '3D/E/I/J/L' },
  { no: 88, phase: 'r32', date: '3 Jul', homeSlot: '2D', awaySlot: '2G' },

  { no: 89, phase: 'r16', date: '4 Jul', homeSlot: 'W74', awaySlot: 'W77' },
  { no: 90, phase: 'r16', date: '4 Jul', homeSlot: 'W73', awaySlot: 'W75' },
  { no: 91, phase: 'r16', date: '5 Jul', homeSlot: 'W76', awaySlot: 'W78' },
  { no: 92, phase: 'r16', date: '5 Jul', homeSlot: 'W79', awaySlot: 'W80' },
  { no: 93, phase: 'r16', date: '6 Jul', homeSlot: 'W83', awaySlot: 'W84' },
  { no: 94, phase: 'r16', date: '6 Jul', homeSlot: 'W81', awaySlot: 'W82' },
  { no: 95, phase: 'r16', date: '7 Jul', homeSlot: 'W86', awaySlot: 'W88' },
  { no: 96, phase: 'r16', date: '7 Jul', homeSlot: 'W85', awaySlot: 'W87' },

  { no: 97, phase: 'qf', date: '9 Jul', homeSlot: 'W89', awaySlot: 'W90' },
  { no: 98, phase: 'qf', date: '10 Jul', homeSlot: 'W93', awaySlot: 'W94' },
  { no: 99, phase: 'qf', date: '11 Jul', homeSlot: 'W91', awaySlot: 'W92' },
  { no: 100, phase: 'qf', date: '11 Jul', homeSlot: 'W95', awaySlot: 'W96' },

  { no: 101, phase: 'sf', date: '14 Jul', homeSlot: 'W97', awaySlot: 'W98' },
  { no: 102, phase: 'sf', date: '15 Jul', homeSlot: 'W99', awaySlot: 'W100' },

  { no: 104, phase: 'final', date: '19 Jul', homeSlot: 'W101', awaySlot: 'W102' },
]

const LEFT_BRACKET_LAYOUT: BracketLayoutSide = {
  r32: [74, 77, 73, 75, 83, 84, 81, 82],
  r16: [89, 90, 94, 93],
  qf: [97, 98],
  sf: [101],
}

const RIGHT_BRACKET_LAYOUT: BracketLayoutSide = {
  r32: [76, 78, 79, 80, 86, 88, 85, 87],
  r16: [91, 92, 95, 96],
  qf: [99, 100],
  sf: [102],
}

function getMatchSortNumber(match: Match): number {
  const matchNumber = Number(match.match_code.replace(/\D/g, ''))
  if (!Number.isNaN(matchNumber) && matchNumber > 0) return matchNumber

  return Date.parse(`2026 ${match.match_date} ${match.match_time}`) || 9999
}

function getMatchNumber(match: Match): number | null {
  const raw = Number(match.match_code.replace(/\D/g, ''))
  if (Number.isNaN(raw) || raw <= 0) return null
  return raw
}

function isPlaceholder(team: string, abbr: string): boolean {
  const teamNorm = (team || '').trim().toLowerCase()
  const abbrNorm = (abbr || '').trim().toUpperCase()
  return teamNorm === 'a definir' || teamNorm === 'tbd' || abbrNorm === 'UNK'
}

function parseGroupSlot(value: string) {
  const m = value.trim().toUpperCase().match(/^([123])\s*([A-L])$/)
  if (!m) return null
  return { pos: Number(m[1]), group: m[2] }
}

function parseThirdOptionsSlot(value: string) {
  const m = value.trim().toUpperCase().match(/^3\s*([A-L](?:\/[A-L])+)$|^3\s*([A-L](?:[A-L])+)$/)
  if (!m) return null

  const raw = (m[1] || m[2] || '').replace(/\s+/g, '')
  const groups = raw.includes('/') ? raw.split('/') : raw.split('')
  return groups.filter(Boolean)
}

function parsePrevMatchSlot(value: string) {
  const v = value.trim().toUpperCase()

  const winner = v.match(/(?:^|\s)(?:W|WIN|WINNER|V|VENC|VENCEDOR)\s*([0-9]{1,3})/)
  if (winner) return { type: 'winner' as const, matchNo: Number(winner[1]) }

  const loser = v.match(/(?:^|\s)(?:L|LOSE|LOSER|P|PERD|PERDEDOR)\s*([0-9]{1,3})/)
  if (loser) return { type: 'loser' as const, matchNo: Number(loser[1]) }

  return null
}

function qualifierFromMatch(match: Match, bets: Record<string, Bet>): string | null {
  const userQualifier = bets[match.id]?.predicted_qualifier
  if (userQualifier && userQualifier !== 'DRAW') return userQualifier

  if (match.qualifier && match.qualifier !== 'DRAW') return match.qualifier

  if (match.home_score == null || match.away_score == null) return null
  if (match.home_score > match.away_score) return match.home_abbr
  if (match.away_score > match.home_score) return match.away_abbr
  return null
}

function loserFromMatch(match: Match, bets: Record<string, Bet>): string | null {
  const qualifier = qualifierFromMatch(match, bets)
  if (!qualifier) return null
  if (qualifier === match.home_abbr) return match.away_abbr
  if (qualifier === match.away_abbr) return match.home_abbr
  return null
}

function resolveTeamFromToken(
  token: string,
  groupBets: Record<string, GroupBet>,
  matchesByNumber: Map<number, Match>,
  bets: Record<string, Bet>
): string | null {
  const thirdOptions = parseThirdOptionsSlot(token)
  if (thirdOptions) {
    for (const group of thirdOptions) {
      const groupBet = groupBets[group]
      if (groupBet?.third_team) return groupBet.third_team
    }
    return null
  }

  const groupSlot = parseGroupSlot(token)
  if (groupSlot) {
    const groupBet = groupBets[groupSlot.group]
    if (!groupBet) return null
    if (groupSlot.pos === 1) return groupBet.first_team
    if (groupSlot.pos === 2) return groupBet.second_team
    if (groupSlot.pos === 3) return groupBet.third_team
  }

  const prevSlot = parsePrevMatchSlot(token)
  if (prevSlot) {
    const previous = matchesByNumber.get(prevSlot.matchNo)
    if (!previous) return null
    return prevSlot.type === 'winner'
      ? qualifierFromMatch(previous, bets)
      : loserFromMatch(previous, bets)
  }

  return null
}

function resolveMatchForSimulation(
  match: Match,
  groupBets: Record<string, GroupBet>,
  matchesByNumber: Map<number, Match>,
  bets: Record<string, Bet>,
  teamMetaByAbbr: Record<string, { name: string; flag: string }>
) : SimulatedMatch {

  const resolvedHomeAbbr = isPlaceholder(match.home_team, match.home_abbr)
    ? resolveTeamFromToken(match.home_abbr, groupBets, matchesByNumber, bets)
      || resolveTeamFromToken(match.home_team, groupBets, matchesByNumber, bets)
    : match.home_abbr

  const resolvedAwayAbbr = isPlaceholder(match.away_team, match.away_abbr)
    ? resolveTeamFromToken(match.away_abbr, groupBets, matchesByNumber, bets)
      || resolveTeamFromToken(match.away_team, groupBets, matchesByNumber, bets)
    : match.away_abbr

  const homeMeta = resolvedHomeAbbr ? teamMetaByAbbr[resolvedHomeAbbr] : undefined
  const awayMeta = resolvedAwayAbbr ? teamMetaByAbbr[resolvedAwayAbbr] : undefined

  return {
    ...match,
    display_home_abbr: resolvedHomeAbbr || match.home_abbr,
    display_away_abbr: resolvedAwayAbbr || match.away_abbr,
    display_home_team: homeMeta?.name || (resolvedHomeAbbr ? resolvedHomeAbbr : match.home_team),
    display_away_team: awayMeta?.name || (resolvedAwayAbbr ? resolvedAwayAbbr : match.away_team),
    display_home_flag: homeMeta?.flag || (resolvedHomeAbbr ? '🏳️' : match.home_flag),
    display_away_flag: awayMeta?.flag || (resolvedAwayAbbr ? '🏳️' : match.away_flag),
  }
}

export default function KnockoutBracket({ matches, bets, groupBets, teamMetaByAbbr, onBet, onSimulateNow, simulateLoading, betStats, isReleased }: Props) {
  const normalizedApiMatches = useMemo(() => {
    return matches.map(match => ({
      ...match,
      phase: (match.phase || '').toLowerCase() as Match['phase'],
    }))
  }, [matches])

  const templateMergedMatches = useMemo(() => {
    const byNo = new Map<number, Match>()

    normalizedApiMatches.forEach(match => {
      const no = getMatchNumber(match)
      if (no != null) byNo.set(no, match)
    })

    const merged: Match[] = [...normalizedApiMatches]

    KNOCKOUT_TEMPLATE.forEach(item => {
      if (byNo.has(item.no)) return

      merged.push({
        id: `template-${item.no}`,
        match_code: `M${item.no}`,
        phase: item.phase,
        group_label: undefined,
        home_team: 'A definir',
        home_flag: '🏳️',
        home_abbr: item.homeSlot,
        away_team: 'A definir',
        away_flag: '🏳️',
        away_abbr: item.awaySlot,
        match_date: item.date,
        match_time: '00:00',
        home_score: undefined,
        away_score: undefined,
        qualifier: undefined,
        status: 'locked',
        created_at: '',
      })
    })

    return merged
  }, [normalizedApiMatches])

  const matchesByNumber = useMemo(() => {
    const map = new Map<number, Match>()

    templateMergedMatches.forEach(match => {
      const no = getMatchNumber(match)
      if (no != null) map.set(no, match)
    })

    return map
  }, [templateMergedMatches])

  const simulatedMatches = useMemo(() => {
    return templateMergedMatches.map(match =>
      resolveMatchForSimulation(match, groupBets, matchesByNumber, bets, teamMetaByAbbr)
    )
  }, [templateMergedMatches, groupBets, matchesByNumber, bets, teamMetaByAbbr])

  const rounds = useMemo(() => {
    const map: Record<string, SimulatedMatch[]> = {}

    for (const phase of KNOCKOUT_PHASE_ORDER) {
      map[phase] = simulatedMatches
        .filter(m => (m.phase || '').toLowerCase() === phase)
        .sort((a, b) => getMatchSortNumber(a) - getMatchSortNumber(b))
    }

    return map
  }, [simulatedMatches])

  const visibleRounds = KNOCKOUT_PHASE_ORDER.filter(phase => (rounds[phase] || []).length > 0)

  const matchesByNumberSimulated = useMemo(() => {
    const map = new Map<number, SimulatedMatch>()

    simulatedMatches.forEach(match => {
      const no = getMatchNumber(match)
      if (no != null) map.set(no, match)
    })

    return map
  }, [simulatedMatches])

  const leftBracket = useMemo(() => ({
    r32: LEFT_BRACKET_LAYOUT.r32.map(no => matchesByNumberSimulated.get(no)),
    r16: LEFT_BRACKET_LAYOUT.r16.map(no => matchesByNumberSimulated.get(no)),
    qf: LEFT_BRACKET_LAYOUT.qf.map(no => matchesByNumberSimulated.get(no)),
    sf: LEFT_BRACKET_LAYOUT.sf.map(no => matchesByNumberSimulated.get(no)),
  }), [matchesByNumberSimulated])

  const rightBracket = useMemo(() => ({
    r32: RIGHT_BRACKET_LAYOUT.r32.map(no => matchesByNumberSimulated.get(no)),
    r16: RIGHT_BRACKET_LAYOUT.r16.map(no => matchesByNumberSimulated.get(no)),
    qf: RIGHT_BRACKET_LAYOUT.qf.map(no => matchesByNumberSimulated.get(no)),
    sf: RIGHT_BRACKET_LAYOUT.sf.map(no => matchesByNumberSimulated.get(no)),
  }), [matchesByNumberSimulated])

  const finalMatch = matchesByNumberSimulated.get(104)

  if (visibleRounds.length === 0) {
    return (
      <div className="card p-6 text-center text-sm text-muted">
        A chave mata-mata vai aparecer aqui conforme os confrontos forem definidos.
      </div>
    )
  }

  return (
    <div className="space-y-4 w-[1200px]">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => { void onSimulateNow() }}
          disabled={simulateLoading}
          className="text-xs px-3 py-2 rounded-lg border border-white/[0.1] text-white/80 hover:text-white hover:border-white/30 transition-colors disabled:opacity-50"
        >
          {simulateLoading ? 'Atualizando...' : 'Simular agora'}
        </button>
      </div>

      {!isReleased && (
        <div className="card p-4 border-gold/30 bg-gold/5">
          <p className="text-sm text-gold font-bold">🔒 Mata-mata bloqueado para palpites até 27/06</p>
          <p className="text-xs text-muted mt-1">Você já pode acompanhar os confrontos, mas os placares liberam somente no dia 27. Aqui é uma simulação de acordo com o que você colocou na Tabela de Grupos, não é a oficial.</p>
        </div>
      )}

      <div className="hidden xl:block h-[78vh] w-full overflow-auto overscroll-contain rounded-[32px] pb-3">
        <div
          className="rounded-[32px] border border-white/[0.06] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.035),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] px-8 py-8"
          style={{ minWidth: `${BRACKET_CANVAS_WIDTH}px`, width: 'max-content', minHeight: `${BRACKET_CANVAS_HEIGHT + 80}px` }}
        >
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-2xl font-black tracking-tight">Mata-mata</h3>
            <p className="text-xs text-muted">Clique nos confrontos para ir montando sua simulação.</p>
          </div>

          <div className="grid grid-cols-[180px_180px_180px_180px_220px_180px_180px_180px_180px] gap-6 items-start">
            <BracketRoundColumn
              matches={leftBracket.r32}
              side="left"
              size="r32"
              bets={bets}
              onBet={onBet}
              isReleased={isReleased}
            />
            <BracketRoundColumn
              matches={leftBracket.r16}
              side="left"
              size="r16"
              bets={bets}
              onBet={onBet}
              isReleased={isReleased}
            />
            <BracketRoundColumn
              matches={leftBracket.qf}
              side="left"
              size="qf"
              bets={bets}
              onBet={onBet}
              isReleased={isReleased}
            />
            <BracketRoundColumn
              matches={leftBracket.sf}
              side="left"
              size="sf"
              bets={bets}
              onBet={onBet}
              isReleased={isReleased}
            />

            <div className="pt-[842px]">
              {finalMatch ? (
                <div className="space-y-4">
                  <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.04] text-4xl shadow-[0_0_40px_rgba(255,255,255,0.06)]">🏆</div>
                  <CompactBracketMatchNode
                    match={finalMatch}
                    existingBet={bets[finalMatch.id]}
                    onBet={(data) => onBet(finalMatch.id, data)}
                    isReleased={isReleased}
                    side="center"
                  />
                </div>
              ) : (
                <div className="pt-24 text-center text-xs text-muted">Final ainda não disponível.</div>
              )}
            </div>

            <BracketRoundColumn
              matches={rightBracket.sf}
              side="right"
              size="sf"
              bets={bets}
              onBet={onBet}
              isReleased={isReleased}
            />
            <BracketRoundColumn
              matches={rightBracket.qf}
              side="right"
              size="qf"
              bets={bets}
              onBet={onBet}
              isReleased={isReleased}
            />
            <BracketRoundColumn
              matches={rightBracket.r16}
              side="right"
              size="r16"
              bets={bets}
              onBet={onBet}
              isReleased={isReleased}
            />
            <BracketRoundColumn
              matches={rightBracket.r32}
              side="right"
              size="r32"
              bets={bets}
              onBet={onBet}
              isReleased={isReleased}
            />
          </div>
        </div>
      </div>

      <div className="xl:hidden overflow-x-auto pb-2">
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${visibleRounds.length}, minmax(260px, 1fr))`, minWidth: `${visibleRounds.length * 280}px` }}>
          {visibleRounds.map(phase => (
            <div key={phase} className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-widest text-green border border-green/20 rounded-full px-3 py-1 inline-flex">
                {getPhaseLabel(phase)}
              </div>
              <div className="space-y-3">
                {rounds[phase].map(match => (
                  <KnockoutMatchCard
                    key={match.id}
                    match={match}
                    existingBet={bets[match.id]}
                    onBet={(data) => onBet(match.id, data)}
                    isReleased={isReleased}
                    betStats={betStats?.[match.id]}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

interface BracketRoundColumnProps {
  matches: Array<SimulatedMatch | undefined>
  side: 'left' | 'right'
  size: 'r32' | 'r16' | 'qf' | 'sf'
  bets: Record<string, Bet>
  onBet: (matchId: string, data: BetData) => Promise<void>
  isReleased: boolean
}

function BracketRoundColumn({ matches, side, size, bets, onBet, isReleased }: BracketRoundColumnProps) {
  const slotCount = {
    r32: 8,
    r16: 4,
    qf: 2,
    sf: 1,
  }[size]

  const slots = Array.from({ length: slotCount }, (_, index) => matches[index])

  const topPositions = {
    r32: [0, 248, 496, 744, 992, 1240, 1488, 1736],
    r16: [124, 620, 1116, 1612],
    qf: [372, 1364],
    sf: [868],
  }[size]

  const connectorHeight = {
    r32: 'h-[84px]',
    r16: 'h-[136px]',
    qf: 'h-[208px]',
    sf: 'h-[64px]',
  }[size]

  return (
    <div className="relative" style={{ height: `${BRACKET_CANVAS_HEIGHT}px` }}>
      {slots.map((match, index) => {
        if (!match) {
          return null
        }

        return (
          <div key={match.id} className="absolute left-0 w-full" style={{ top: `${topPositions[index]}px` }}>
            <CompactBracketMatchNode
              match={match}
              existingBet={bets[match.id]}
              onBet={(data) => onBet(match.id, data)}
              isReleased={isReleased}
              side={side}
              connectorHeight={connectorHeight}
              connectorDirection={size === 'sf' ? 'final' : 'round'}
              pairIndex={index}
            />
          </div>
        )
      })}
    </div>
  )
}

interface CompactBracketMatchNodeProps {
  match: SimulatedMatch
  existingBet?: Bet
  onBet: (data: BetData) => Promise<void>
  isReleased: boolean
  side: 'left' | 'right' | 'center'
  connectorHeight?: string
  connectorDirection?: 'round' | 'final'
  pairIndex?: number
}

function CompactBracketMatchNode({
  match,
  existingBet,
  onBet,
  isReleased,
  side,
  connectorHeight = 'h-[84px]',
  connectorDirection = 'round',
  pairIndex = 0,
}: CompactBracketMatchNodeProps) {
  const [scoreH, setScoreH] = useState<string>(existingBet ? String(existingBet.predicted_home) : '')
  const [scoreA, setScoreA] = useState<string>(existingBet ? String(existingBet.predicted_away) : '')
  const [qualifier, setQualifier] = useState<string>(existingBet?.predicted_qualifier || '')
  const [loading, setLoading] = useState(false)
  const [timeLeft, setTimeLeft] = useState<number>(() => msUntilLockout(match.match_date, match.match_time))

  useEffect(() => {
    if (!existingBet) return
    setScoreH(String(existingBet.predicted_home))
    setScoreA(String(existingBet.predicted_away))
    setQualifier(existingBet.predicted_qualifier || '')
  }, [existingBet])

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

  useEffect(() => {
    const h = parseInt(scoreH)
    const a = parseInt(scoreA)
    if (Number.isNaN(h) || Number.isNaN(a) || qualifier) return
    if (h > a) setQualifier(match.display_home_abbr)
    else if (a > h) setQualifier(match.display_away_abbr)
    else setQualifier('DRAW')
  }, [scoreH, scoreA, qualifier, match.display_home_abbr, match.display_away_abbr])

  const isTemplate = match.id.startsWith('template-')
  const timeLocked = timeLeft <= 0
  const locked = isTemplate || !isReleased || match.status !== 'open' || timeLocked
  const hasBet = !!existingBet
  const canSubmit = scoreH !== '' && scoreA !== '' && !locked

  async function submitBet(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    try {
      await onBet({
        predicted_home: parseInt(scoreH),
        predicted_away: parseInt(scoreA),
        predicted_qualifier: qualifier || undefined,
      })
    } finally {
      setLoading(false)
    }
  }

  const armClass = side === 'left'
    ? 'absolute top-1/2 -right-6 w-6 border-t border-dashed border-white/15'
    : side === 'right'
      ? 'absolute top-1/2 -left-6 w-6 border-t border-dashed border-white/15'
      : ''

  const verticalClass = side === 'left'
    ? `absolute -right-6 border-r border-dashed border-white/15 ${connectorHeight}`
    : side === 'right'
      ? `absolute -left-6 border-l border-dashed border-white/15 ${connectorHeight}`
      : ''

  const verticalPositionClass = pairIndex % 2 === 0 ? 'top-1/2' : `bottom-1/2 ${connectorDirection === 'final' ? 'translate-y-1/2' : ''}`

  return (
    <div className="relative">
      {side !== 'center' && (
        <>
          <div className={armClass} />
          <div className={`${verticalClass} ${verticalPositionClass}`} />
        </>
      )}

      <form onSubmit={submitBet} className="rounded-[20px] border border-white/[0.1] bg-white/[0.04] px-2.5 py-2.5 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-sm">
        <div className="mb-2 flex items-center justify-between gap-2 text-[9px] font-mono text-white/45">
          <span>{match.match_code}</span>
          <span>{match.match_date}</span>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-1.5">
            <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-bold">
              <span className="text-sm">{match.display_home_flag}</span>
              <span className="truncate">{match.display_home_abbr}</span>
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-1.5">
            <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-bold">
              <span className="text-sm">{match.display_away_flag}</span>
              <span className="truncate">{match.display_away_abbr}</span>
            </span>
          </div>
        </div>

        <div className="mt-2.5 border-t border-white/[0.06] pt-2.5">
          <div className="mb-2 text-center text-[9px] uppercase tracking-[0.22em] text-white/40">Placar</div>
          <div className="flex items-center justify-center gap-1.5">
            <input
              type="number"
              min={0}
              max={20}
              value={scoreH}
              onChange={e => setScoreH(e.target.value)}
              disabled={locked}
              className="h-8 w-9 rounded-lg border border-white/[0.1] bg-dark-3 text-center font-mono text-xs font-bold outline-none focus:border-green disabled:opacity-60"
            />
            <span className="text-xs font-bold text-white/45">:</span>
            <input
              type="number"
              min={0}
              max={20}
              value={scoreA}
              onChange={e => setScoreA(e.target.value)}
              disabled={locked}
              className="h-8 w-9 rounded-lg border border-white/[0.1] bg-dark-3 text-center font-mono text-xs font-bold outline-none focus:border-green disabled:opacity-60"
            />
          </div>

          <div className="mt-2.5 flex items-center justify-between gap-2">
            <span className={`text-[9px] ${hasBet ? 'text-green' : 'text-white/35'}`}>
              {isTemplate ? 'Aguardando API' : hasBet ? 'Simulado' : 'Sem palpite'}
            </span>
            <button
              type="submit"
              disabled={!canSubmit || loading}
              className="rounded-full border border-green/40 bg-green/12 px-2.5 py-1 text-[9px] font-bold text-green transition-colors hover:bg-green/20 disabled:opacity-40"
            >
              {loading ? '...' : hasBet ? 'Atualizar' : 'Salvar'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

interface MatchCardProps {
  match: SimulatedMatch
  existingBet?: Bet
  onBet: (data: BetData) => Promise<void>
  isReleased: boolean
  betStats?: BetStats
}

function KnockoutMatchCard({ match, existingBet, onBet, isReleased, betStats }: MatchCardProps) {
  const [scoreH, setScoreH] = useState<string>(existingBet ? String(existingBet.predicted_home) : '')
  const [scoreA, setScoreA] = useState<string>(existingBet ? String(existingBet.predicted_away) : '')
  const [qualifier, setQualifier] = useState<string>(existingBet?.predicted_qualifier || '')
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [timeLeft, setTimeLeft] = useState<number>(() => msUntilLockout(match.match_date, match.match_time))

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

  useEffect(() => {
    if (!existingBet) return
    if (editing) return
    setScoreH(String(existingBet.predicted_home))
    setScoreA(String(existingBet.predicted_away))
    setQualifier(existingBet.predicted_qualifier || '')
  }, [existingBet, editing])

  const timeLocked = timeLeft <= 0
  const isTemplate = match.id.startsWith('template-')
  const hasBet = !!existingBet && !editing
  const locked = isTemplate || !isReleased || match.status !== 'open' || timeLocked
  const canSubmit = scoreH !== '' && scoreA !== ''

  async function submitBet(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || locked) return

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

  useEffect(() => {
    const h = parseInt(scoreH)
    const a = parseInt(scoreA)

    if (Number.isNaN(h) || Number.isNaN(a) || qualifier) return

    if (h > a) setQualifier(match.display_home_abbr)
    else if (a > h) setQualifier(match.display_away_abbr)
    else setQualifier('DRAW')
  }, [scoreH, scoreA, qualifier, match.display_home_abbr, match.display_away_abbr])

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-[11px] text-muted font-mono">{match.match_code} · {match.match_date} {match.match_time}</span>
        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${locked ? 'bg-red/10 text-red' : hasBet ? 'bg-green/10 text-green' : 'bg-white/[0.06] text-muted'}`}>
          {locked ? '🔒' : hasBet ? '✅' : '🕐'}
        </span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="truncate">{match.display_home_flag} {match.display_home_team}</span>
          <span className="text-[10px] text-muted ml-2">{match.display_home_abbr}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="truncate">{match.display_away_flag} {match.display_away_team}</span>
          <span className="text-[10px] text-muted ml-2">{match.display_away_abbr}</span>
        </div>
      </div>

      <form onSubmit={submitBet} className="mt-3 pt-3 border-t border-white/[0.06] space-y-3">
        <div>
          <div className="text-[10px] text-muted uppercase tracking-widest mb-2">Placar</div>
          {hasBet ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-12 h-10 flex items-center justify-center bg-dark-3 border border-green/20 rounded-lg font-mono text-lg font-bold text-green">
                {existingBet!.predicted_home}
              </div>
              <span className="text-muted text-lg font-bold">:</span>
              <div className="w-12 h-10 flex items-center justify-center bg-dark-3 border border-green/20 rounded-lg font-mono text-lg font-bold text-green">
                {existingBet!.predicted_away}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <input
                type="number"
                min={0}
                max={20}
                value={scoreH}
                onChange={e => setScoreH(e.target.value)}
                disabled={locked}
                className="score-input"
              />
              <span className="text-muted text-lg font-bold">:</span>
              <input
                type="number"
                min={0}
                max={20}
                value={scoreA}
                onChange={e => setScoreA(e.target.value)}
                disabled={locked}
                className="score-input"
              />
            </div>
          )}
        </div>

        {betStats && betStats.total > 0 && (
          <div className="text-[11px] text-muted text-center">
            📊 {betStats.total} palpites na sala
          </div>
        )}

        {!locked && (
          <>
            {hasBet ? (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">
                  Classificado: {existingBet!.predicted_qualifier === 'DRAW' ? 'Empate' : existingBet!.predicted_qualifier}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(true)
                    setQualifier(existingBet?.predicted_qualifier || '')
                  }}
                  className="text-xs text-muted hover:text-white border border-white/[0.08] rounded-lg px-3 py-1.5"
                >
                  Editar
                </button>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { value: match.display_home_abbr, label: `${match.display_home_flag} ${match.display_home_abbr}` },
                    { value: 'DRAW', label: 'Empate' },
                    { value: match.display_away_abbr, label: `${match.display_away_flag} ${match.display_away_abbr}` },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setQualifier(opt.value)}
                      className={`text-xs px-2.5 py-1.5 rounded-lg border font-bold ${qualifier === opt.value ? 'bg-green/10 border-green/40 text-green' : 'bg-dark-3 border-white/[0.08] text-muted hover:border-white/20'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="flex justify-end">
                  <button type="submit" disabled={!canSubmit || loading} className="btn-primary text-sm py-2 px-4">
                    {loading ? '...' : editing ? 'Atualizar' : 'Salvar'}
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {locked && (
          <div className="text-xs text-muted text-center">
            {isTemplate
              ? 'Confronto previsto da chave oficial, aguardando jogo oficial da API'
              : !isReleased
              ? 'Libera em 27/06'
              : timeLocked && match.status === 'open'
                ? 'Apostas encerradas para este confronto'
                : 'Apostas encerradas'}
          </div>
        )}
      </form>
    </div>
  )
}
