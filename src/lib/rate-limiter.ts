// src/lib/rate-limiter.ts
// Rate limiter genérico para APIs externas - máx 100 chamadas/dia

import { supabaseAdmin } from './supabase'

interface RateLimitRow {
  id: string
  date: string
  count: number
}

const MAX_DAILY_CALLS = 100

/**
 * Verifica se ainda pode chamar a API externa.
 * Retorna { allowed: true } ou { allowed: false, resetAt: "YYYY-MM-DD" }
 */
export async function checkRateLimit(): Promise<
  { allowed: true } | { allowed: false; resetAt: string }
> {
  const today = new Date().toISOString().split('T')[0] // "2026-06-14"

  const db = supabaseAdmin()

  // Busca registro de hoje
  const { data, error } = await db
    .from('api_rate_limits')
    .select('id, date, count')
    .eq('date', today)
    .maybeSingle<RateLimitRow>()

  if (error) {
    // Se tabela não existe, permite (fallback seguro)
    console.warn('[RateLimiter] Erro ao consultar:', error.message)
    return { allowed: true }
  }

  const currentCount = data?.count ?? 0

  if (currentCount >= MAX_DAILY_CALLS) {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const resetAt = tomorrow.toISOString().split('T')[0]
    return { allowed: false, resetAt }
  }

  return { allowed: true }
}

/**
 * Incrementa a contagem de chamadas de hoje.
 * Cria o registro se não existir.
 */
export async function incrementRateLimit(): Promise<void> {
  const today = new Date().toISOString().split('T')[0]

  const db = supabaseAdmin()

  const { data: existing } = await db
    .from('api_rate_limits')
    .select('id, count')
    .eq('date', today)
    .maybeSingle<RateLimitRow>()

  if (existing) {
    await db
      .from('api_rate_limits')
      .update({ count: existing.count + 1 })
      .eq('id', existing.id)
  } else {
    await db
      .from('api_rate_limits')
      .insert({ date: today, count: 1 })
  }
}

/**
 * Retorna quantas chamadas já foram usadas hoje e o limite.
 */
export async function getRateLimitStatus(): Promise<{
  used: number
  limit: number
  resetAt: string
}> {
  const today = new Date().toISOString().split('T')[0]

  const db = supabaseAdmin()

  const { data } = await db
    .from('api_rate_limits')
    .select('count')
    .eq('date', today)
    .maybeSingle<{ count: number }>()

  const used = data?.count ?? 0
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const resetAt = tomorrow.toISOString().split('T')[0]

  return { used, limit: MAX_DAILY_CALLS, resetAt }
}