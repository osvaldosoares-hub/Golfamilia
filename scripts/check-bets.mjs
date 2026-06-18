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

const db = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY)

async function checkBets() {
  console.log('🔍 Verificando tabela de bets...\n')
  
  const { data, error, count } = await db
    .from('bets')
    .select('*', { count: 'exact' })
  
  if (error) {
    console.error('❌ Erro:', error.message)
    return
  }
  
  console.log(`📊 Total de apostas no banco: ${count}`)
  
  if (data && data.length > 0) {
    console.log(`\n✅ Primeiras 5 apostas:`)
    data.slice(0, 5).forEach((bet, i) => {
      console.log(`\n[${i+1}] ID: ${bet.id}`)
      console.log(`    Usuário: ${bet.user_id}`)
      console.log(`    Jogo: ${bet.match_id}`)
      console.log(`    Placar: ${bet.predicted_home} x ${bet.predicted_away}`)
      console.log(`    Moedas: ${bet.coins_bet}`)
      console.log(`    Pontos: ${bet.points_earned}`)
    })
  } else {
    console.log(`\n⚠️  Nenhuma aposta encontrada no banco`)
  }
}

checkBets()
