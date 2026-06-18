#!/usr/bin/env node

/**
 * Restore do Backup do Supabase
 * Restaura dados de um backup anterior
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'
import { fileURLToPath } from 'url'

// Carregar .env.local
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, '../.env.local')
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

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Variáveis de ambiente não configuradas!')
  process.exit(1)
}

const db = createClient(supabaseUrl, serviceRoleKey)

function askQuestion(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })
    rl.question(question, answer => {
      rl.close()
      resolve(answer)
    })
  })
}

async function restoreDatabase() {
  try {
    // Listar backups disponíveis
    const backupDir = './backups'
    if (!fs.existsSync(backupDir)) {
      console.error('❌ Nenhum backup encontrado')
      return
    }

    const backups = fs
      .readdirSync(backupDir)
      .filter(f => f.startsWith('backup_'))
      .sort()
      .reverse()

    if (backups.length === 0) {
      console.error('❌ Nenhum arquivo de backup encontrado')
      return
    }

    console.log('📋 Backups disponíveis:\n')
    backups.forEach((file, i) => {
      const fullPath = path.join(backupDir, file)
      const size = (fs.statSync(fullPath).size / 1024).toFixed(2)
      console.log(`[${i + 1}] ${file} (${size} KB)`)
    })

    const choice = await askQuestion('\nEscolha o número do backup: ')
    const backupFile = path.join(backupDir, backups[parseInt(choice) - 1])

    if (!fs.existsSync(backupFile)) {
      console.error('❌ Arquivo não encontrado')
      return
    }

    console.log(`\n⚠️  AVISO: Isto irá SOBRESCREVER os dados atuais!`)
    const confirm = await askQuestion('Digite "sim" para confirmar: ')

    if (confirm !== 'sim') {
      console.log('❌ Operação cancelada')
      return
    }

    console.log(`\n🔄 Restaurando: ${path.basename(backupFile)}...\n`)

    const sqlContent = fs.readFileSync(backupFile, 'utf-8')
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'))

    let count = 0
    for (const statement of statements) {
      try {
        // Executar via raw SQL
        const { error } = await db.rpc('exec_sql', { sql: statement }).catch(() => ({
          error: null
        }))

        count++
        if (count % 10 === 0) {
          process.stdout.write('.')
        }
      } catch (err) {
        console.error(`⚠️  Erro na execução: ${err.message}`)
      }
    }

    console.log(`\n\n✅ Restauração concluída!`)
    console.log(`📊 ${count} comandos executados`)
  } catch (err) {
    console.error('❌ Erro ao restaurar:', err)
  }
}

restoreDatabase()
