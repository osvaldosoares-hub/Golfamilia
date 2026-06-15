// src/services/footballDataApi.ts
// Football-Data.org v4 API Service

const BASE_URL = 'https://api.football-data.org/v4'

export interface FootballDataMatch {
  id: number
  competition: {
    id: number
    name: string
    code: string
  }
  season: {
    id: number
    startDate: string
    endDate: string
    currentMatchday: number | null
  }
  utcDate: string
  status: 'SCHEDULED' | 'TIMED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED' | 'POSTPONED' | 'CANCELLED' | 'AWARDED'
  matchday: number | null
  stage: string
  group: string | null
  homeTeam: {
    id: number
    name: string
    shortName: string
    tla: string | null
    crest: string
  }
  awayTeam: {
    id: number
    name: string
    shortName: string
    tla: string | null
    crest: string
  }
  score: {
    winner: 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null
    fullTime: { home: number | null; away: number | null }
    halfTime: { home: number | null; away: number | null }
  }
}

export interface FootballDataCompetition {
  id: number
  area: { id: number; name: string; code: string; flag: string | null }
  name: string
  code: string
  type: string
  emblem: string
  plan: string
  currentSeason: {
    id: number
    startDate: string
    endDate: string
    currentMatchday: number | null
  }
  numberOfAvailableSeasons: number
  lastUpdated: string
}

export interface FootballDataStandings {
  competition: FootballDataCompetition
  season: { id: number; startDate: string; endDate: string; currentMatchday: number | null }
  standings: Array<{
    stage: string
    type: 'TOTAL' | 'HOME' | 'AWAY'
    group: string | null
    table: Array<{
      position: number
      team: {
        id: number
        name: string
        shortName: string
        tla: string
        crest: string
      }
      playedGames: number
      form: string | null
      won: number
      draw: number
      lost: number
      points: number
      goalsFor: number
      goalsAgainst: number
      goalDifference: number
    }>
  }>
}

export interface FootballDataScorers {
  competition: FootballDataCompetition
  season: { id: number; startDate: string; endDate: string; currentMatchday: number | null }
  scorers: Array<{
    player: {
      id: number
      name: string
      firstName: string
      lastName: string
      dateOfBirth: string
      nationality: string
      position: string | null
      shirtNumber: number | null
    }
    team: {
      id: number
      name: string
      shortName: string
      tla: string
      crest: string
    }
    goals: number
    assists: number | null
    penalties: number | null
  }>
}

export interface FootballDataTeam {
  id: number
  area: { id: number; name: string; code: string; flag: string | null }
  name: string
  shortName: string
  tla: string | null
  crest: string
  address: string
  website: string
  founded: number | null
  clubColors: string
  venue: string
  runningCompetitions: Array<{
    id: number
    name: string
    code: string
    type: string
    emblem: string
  }>
  coach: {
    id: number
    firstName: string
    lastName: string
    name: string
    dateOfBirth: string
    nationality: string
  } | null
  squad: Array<{
    id: number
    name: string
    position: string | null
    dateOfBirth: string
    nationality: string
    shirtNumber: number | null
  }>
  lastUpdated: string
}

export interface FootballDataMatchesResponse {
  matches: FootballDataMatch[]
  resultSet?: {
    count: number
    competitions: string
    first: string
    last: string
    played: number
  }
}

export interface FootballDataError {
  errorCode: number
  message: string
}

/**
 * Football-Data.org v4 API service
 * All requests require X-Auth-Token header
 */
async function footballRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = process.env.FOOTBALL_DATA_API_KEY

  if (!token) {
    throw new Error('FOOTBALL_DATA_API_KEY environment variable is not set')
  }

  const url = `${BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'X-Auth-Token': token,
      ...options?.headers,
    },
    next: { revalidate: 0 },
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '')
    let errorMessage = `Football-Data.org API Error: ${response.status}`
    try {
      const errorJson = JSON.parse(errorBody) as FootballDataError
      if (errorJson.message) {
        errorMessage = `${errorMessage} - ${errorJson.message}`
      }
    } catch {
      // ignore parse error
    }
    throw new Error(errorMessage)
  }

  return response.json() as Promise<T>
}

/**
 * Get all matches for a given date range
 * GET /matches
 */
export function getMatches(params?: {
  dateFrom?: string
  dateTo?: string
  status?: string
  competition?: string
  matchday?: number
  season?: number
}): Promise<FootballDataMatchesResponse> {
  const searchParams = new URLSearchParams()
  if (params?.dateFrom) searchParams.set('dateFrom', params.dateFrom)
  if (params?.dateTo) searchParams.set('dateTo', params.dateTo)
  if (params?.status) searchParams.set('status', params.status)
  if (params?.competition) searchParams.set('competition', params.competition)
  if (params?.matchday) searchParams.set('matchday', params.matchday.toString())
  if (params?.season) searchParams.set('season', params.season.toString())

  const query = searchParams.toString()
  const endpoint = `/matches${query ? `?${query}` : ''}`
  return footballRequest<FootballDataMatchesResponse>(endpoint)
}

/**
 * Get matches for a specific competition
 * GET /competitions/{id}/matches
 */
export function getCompetitionMatches(
  competitionCode: string,
  params?: {
    dateFrom?: string
    dateTo?: string
    stage?: string
    status?: string
    matchday?: number
    group?: string
    season?: number
  }
): Promise<FootballDataMatchesResponse> {
  const searchParams = new URLSearchParams()
  if (params?.dateFrom) searchParams.set('dateFrom', params.dateFrom)
  if (params?.dateTo) searchParams.set('dateTo', params.dateTo)
  if (params?.stage) searchParams.set('stage', params.stage)
  if (params?.status) searchParams.set('status', params.status)
  if (params?.matchday) searchParams.set('matchday', params.matchday.toString())
  if (params?.group) searchParams.set('group', params.group)
  if (params?.season) searchParams.set('season', params.season.toString())

  const query = searchParams.toString()
  const endpoint = `/competitions/${competitionCode}/matches${query ? `?${query}` : ''}`
  return footballRequest<FootballDataMatchesResponse>(endpoint)
}

/**
 * Get standings for a competition
 * GET /competitions/{id}/standings
 */
export function getCompetitionStandings(
  competitionCode: string,
  params?: { matchday?: number; season?: number }
): Promise<FootballDataStandings> {
  const searchParams = new URLSearchParams()
  if (params?.matchday) searchParams.set('matchday', params.matchday.toString())
  if (params?.season) searchParams.set('season', params.season.toString())

  const query = searchParams.toString()
  const endpoint = `/competitions/${competitionCode}/standings${query ? `?${query}` : ''}`
  return footballRequest<FootballDataStandings>(endpoint)
}

/**
 * Get scorers for a competition
 * GET /competitions/{id}/scorers
 */
export function getCompetitionScorers(
  competitionCode: string,
  params?: { limit?: number; season?: number }
): Promise<FootballDataScorers> {
  const searchParams = new URLSearchParams()
  if (params?.limit) searchParams.set('limit', params.limit.toString())
  if (params?.season) searchParams.set('season', params.season.toString())

  const query = searchParams.toString()
  const endpoint = `/competitions/${competitionCode}/scorers${query ? `?${query}` : ''}`
  return footballRequest<FootballDataScorers>(endpoint)
}

/**
 * Get teams in a competition
 * GET /competitions/{id}/teams
 */
export function getCompetitionTeams(
  competitionCode: string,
  params?: { season?: number; stage?: string }
): Promise<{ competition: FootballDataCompetition; season: { id: number; startDate: string; endDate: string; currentMatchday: number | null }; teams: FootballDataTeam[] }> {
  const searchParams = new URLSearchParams()
  if (params?.season) searchParams.set('season', params.season.toString())
  if (params?.stage) searchParams.set('stage', params.stage)

  const query = searchParams.toString()
  const endpoint = `/competitions/${competitionCode}/teams${query ? `?${query}` : ''}`
  return footballRequest(endpoint)
}

/**
 * Get a specific team
 * GET /teams/{id}
 */
export function getTeam(teamId: number): Promise<FootballDataTeam> {
  return footballRequest<FootballDataTeam>(`/teams/${teamId}`)
}

/**
 * Get matches for a specific team
 * GET /teams/{id}/matches
 */
export function getTeamMatches(
  teamId: number,
  params?: {
    dateFrom?: string
    dateTo?: string
    status?: string
    competition?: string
    limit?: number
  }
): Promise<FootballDataMatchesResponse> {
  const searchParams = new URLSearchParams()
  if (params?.dateFrom) searchParams.set('dateFrom', params.dateFrom)
  if (params?.dateTo) searchParams.set('dateTo', params.dateTo)
  if (params?.status) searchParams.set('status', params.status)
  if (params?.competition) searchParams.set('competition', params.competition)
  if (params?.limit) searchParams.set('limit', params.limit.toString())

  const query = searchParams.toString()
  const endpoint = `/teams/${teamId}/matches${query ? `?${query}` : ''}`
  return footballRequest<FootballDataMatchesResponse>(endpoint)
}

/**
 * Get a specific match
 * GET /matches/{id}
 */
export function getMatch(matchId: number): Promise<FootballDataMatch> {
  return footballRequest<FootballDataMatch>(`/matches/${matchId}`)
}