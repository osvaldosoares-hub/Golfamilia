#!/usr/bin/env node

/**
 * Script para sincronizar horários corretos dos jogos
 * Busca da API Football-Data.org e atualiza no Supabase
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

// Carregar .env.local
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

async function syncMatchTimes() {
  try {
    console.log('📡 Sincronizando horários da API Football-Data...\n')

    // Buscar jogos da API
    const apiUrl = 'https://api.football-data.org/v4/competitions/WC/matches'
    const response = await fetch(apiUrl, {
      headers: { 'X-Auth-Token': footballDataToken }
    })

    if (!response.ok) {
      console.error(`❌ Erro da API: ${response.status} ${response.statusText}`)
      return
    }

    const data = await response.json()
    const matches = data.matches || []

    console.log(`📊 Encontrados ${matches.length} jogos na API\n`)

    let updated = 0
    let errors = 0

    for (const apiMatch of matches) {
      try {
        // Parsear a data/hora UTC
        const kickoff = new Date(apiMatch.utcDate)
        
        // Converter para horário de Brasília (America/Sao_Paulo = UTC-3)
        const brasilFormatter = new Intl.DateTimeFormat('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        })
        
        const parts = brasilFormatter.formatToParts(kickoff)
        const day = parts.find(p => p.type === 'day').value
        const month = parts.find(p => p.type === 'month').value
        const hour = parts.find(p => p.type === 'hour').value
        const minute = parts.find(p => p.type === 'minute').value
        
        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
        const monthName = months[parseInt(month) - 1]
        const matchDate = `${parseInt(day)} ${monthName}`
        const matchTime = `${hour}:${minute}`

        // Buscar jogo no banco pela match_code
        const homeAbbr = apiMatch.homeTeam?.tla || 'UNK'
        const awayAbbr = apiMatch.awayTeam?.tla || 'UNK'
        const matchCode = `FD${apiMatch.id}`

        const { data: existingMatch, error: findError } = await db
          .from('matches')
          .select('id')
          .eq('match_code', matchCode)
          .single()

        if (findError && findError.code !== 'PGRST116') {
          console.error(`  ❌ ${homeAbbr} vs ${awayAbbr}: Erro ao buscar`)
          errors++
          continue
        }

        if (existingMatch) {
          // Atualizar horário
          const { error: updateError } = await db
            .from('matches')
            .update({
              match_date: matchDate,
              match_time: matchTime,
              status: mapStatus(apiMatch.status),
              home_score: apiMatch.score?.fullTime?.home,
              away_score: apiMatch.score?.fullTime?.away,
              match_phase: apiMatch.status,
            })
            .eq('id', existingMatch.id)

          if (updateError) {
            console.error(`  ❌ ${homeAbbr} vs ${awayAbbr}: ${updateError.message}`)
            errors++
          } else {
            console.log(`  ✅ ${homeAbbr} vs ${awayAbbr} → ${matchDate} ${matchTime}`)
            updated++
          }
        }
      } catch (err) {
        console.error(`  ❌ Erro ao processar jogo:`, err)
        errors++
      }
    }

    console.log(`\n✅ Sincronização concluída!`)
    console.log(`   Atualizados: ${updated}`)
    console.log(`   Erros: ${errors}`)
  } catch (err) {
    console.error('❌ Erro geral:', err)
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

syncMatchTimes()
