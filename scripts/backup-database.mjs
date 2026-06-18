#!/usr/bin/env node

/**
 * Backup do Supabase via API
 * Exporta todos os dados do banco em formato SQL
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
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
  console.error('Certifique-se de que .env.local existe com as credenciais do Supabase')
  process.exit(1)
}

const db = createClient(supabaseUrl, serviceRoleKey)

async function backupDatabase() {
  try {
    console.log('📦 Iniciando backup do banco de dados...\n')

    // Criar pasta de backups
    const backupDir = './backups'
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true })
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupFile = path.join(backupDir, `backup_golpeito_${timestamp}.sql`)

    let sqlContent = `-- Backup do Golpeito
-- Data: ${new Date().toLocaleString('pt-BR')}
-- =====================================================\n\n`

    // Tabelas para fazer backup
    const tables = [
      'users',
      'rooms',
      'room_members',
      'matches',
      'bets',
      'group_bets',
    ]

    for (const table of tables) {
      console.log(`📋 Exportando tabela: ${table}...`)

      const { data, error } = await db
        .from(table)
        .select('*')

      if (error) {
        console.warn(`⚠️  Erro ao exportar ${table}:`, error.message)
        continue
      }

      if (!data || data.length === 0) {
        console.log(`   → ${table} vazia`)
        continue
      }

      sqlContent += `-- Tabela: ${table}\n`
      sqlContent += `DELETE FROM ${table};\n\n`

      for (const row of data) {
        const columns = Object.keys(row)
        const values = columns.map(col => {
          const val = row[col]
          if (val === null) return 'NULL'
          if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`
          if (typeof val === 'boolean') return val ? 'true' : 'false'
          if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`
          return val
        })

        const columnsList = columns.join(', ')
        const valuesList = values.join(', ')
        sqlContent += `INSERT INTO ${table} (${columnsList}) VALUES (${valuesList});\n`
      }

      sqlContent += `\n`
      console.log(`   ✅ ${data.length} registros exportados`)
    }

    // Salvar arquivo
    fs.writeFileSync(backupFile, sqlContent, 'utf-8')

    const fileSize = (fs.statSync(backupFile).size / 1024 / 1024).toFixed(2)
    console.log(`\n✅ Backup concluído com sucesso!`)
    console.log(`📁 Arquivo: ${backupFile}`)
    console.log(`📊 Tamanho: ${fileSize} MB`)
  } catch (err) {
    console.error('❌ Erro ao fazer backup:', err)
    process.exit(1)
  }
}

backupDatabase()
