// src/types/index.ts

export interface User {
  id: string
  nickname: string
  email: string
  coins: number
  avatar_color: string
  created_at: string
}

export interface Room {
  id: string
  code: string
  name: string
  owner_id: string
  pts_exact: number
  pts_winner: number
  pts_qualifier: number
  is_active: boolean
  created_at: string
  // joined fields
  member_count?: number
  my_points?: number
  coins_in_room?: number
}

export interface RoomMember {
  id: string
  room_id: string
  user_id: string
  coins_in_room: number
  total_points: number
  joined_at: string
  user?: User
}

export interface Match {
  id: string
  match_code: string
  phase: 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'third' | 'final'
  group_label?: string
  home_team: string
  home_flag: string
  home_abbr: string
  away_team: string
  away_flag: string
  away_abbr: string
  match_date: string
  match_time: string
  home_score?: number
  away_score?: number
  qualifier?: string
  status: 'scheduled' | 'open' | 'locked' | 'live' | 'finished'
  match_phase?: string
  created_at: string
}

export interface Bet {
  id: string
  room_id: string
  user_id: string
  match_id: string
  predicted_home: number
  predicted_away: number
  predicted_qualifier?: string
  coins_bet: number
  points_earned?: number
  created_at: string
  updated_at: string
  match?: Match
}

export interface GroupBet {
  id: string
  room_id: string
  user_id: string
  group_label: string
  first_team: string
  second_team: string
  third_team: string
  points_earned?: number
  created_at: string
  updated_at: string
}

export interface GroupTeamInfo {
  abbr: string
  name: string
  flag: string
}

export interface LeaderboardEntry {
  user_id: string
  nickname: string
  avatar_color: string
  total_points: number
  coins_in_room: number
  bets_count: number
  rank: number
  is_me?: boolean
}

export interface AuthSession {
  userId: string
  nickname: string
  email: string
}

// API Response types
export interface ApiResponse<T = unknown> {
  data?: T
  error?: string
}
