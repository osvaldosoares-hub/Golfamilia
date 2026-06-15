#!/usr/bin/env node

/**
 * Sincronizador de Placares Ao Vivo
 * Roda continuamente a cada 2 minutos para atualizar placares da API
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, '..', '.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')

const envVars = {}
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/)
  if (match && !line.startsWith('#')) {
    envVars[match[1].trim()] = match[2].trim()
  }
})

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = envVars.SUPABASE_SERVICE_ROLE_KEY
const footballDataToken = envVars.FOOTBALL_DATA_API_KEY

const db = createClient(supabaseUrl, serviceRoleKey)

async function syncLiveScores() {
  console.log(`[${new Date().toLocaleString('pt-BR')}] 🔄 Sincronizando placares ao vivo...`)

  try {
    const apiUrl = 'https://api.football-data.org/v4/competitions/WC/matches'
    const response = await fetch(apiUrl, {
      headers: { 'X-Auth-Token': footballDataToken }
    })

    if (!response.ok) {
      console.error(`❌ Erro da API: ${response.status}`)
      return
    }

    const data = await response.json()
    const matches = data.matches || []

    let updated = 0
    let finished = 0

    for (const apiMatch of matches) {
      // Pular matches que não têm informação de placar
      if (apiMatch.score?.fullTime?.home == null || apiMatch.score?.fullTime?.away == null) {
        continue
      }

      const matchCode = `FD${apiMatch.id}`
      const homeScore = apiMatch.score.fullTime.home
      const awayScore = apiMatch.score.fullTime.away
      const status = mapStatus(apiMatch.status)

      const { error: updateError } = await db
        .from('matches')
        .update({
          home_score: homeScore,
          away_score: awayScore,
          status: status,
          match_phase: apiMatch.status,
        })
        .eq('match_code', matchCode)

      if (!updateError) {
        updated++
        if (status === 'finished') finished++
      }
    }

    if (updated > 0) {
      console.log(`✅ ${updated} jogos atualizados (${finished} finalizados)`)
    }
  } catch (err) {
    console.error('❌ Erro:', err.message)
  }
}

function mapStatus(status) {
  const mapping = {
    'SCHEDULED': 'scheduled',
    'TIMED': 'scheduled',
    'IN_PLAY': 'live',
    'PAUSED': 'live',
    'FINISHED': 'finished',
    'POSTPONED': 'scheduled',
    'CANCELLED': 'scheduled',
    'AWARDED': 'finished',
  }
  return mapping[status] || 'scheduled'
}

// Sincronizar a cada 2 minutos
console.log('📡 Iniciando sincronizador de placares ao vivo...')
console.log('⏰ Atualizando a cada 2 minutos\n')

// Sincronizar imediatamente
await syncLiveScores()

// Depois a cada 2 minutos
setInterval(syncLiveScores, 2 * 60 * 1000)
