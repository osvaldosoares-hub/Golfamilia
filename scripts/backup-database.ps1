# Script de Backup do Supabase
# =============================
# Faz backup do banco de dados PostgreSQL do Supabase

$supabaseUrl = "cgptvijqxyhycqiqetik"  # Project ID do Supabase
$postgresPassword = Read-Host "Digite a senha do banco de dados PostgreSQL do Supabase" -AsSecureString
$plainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToCoTaskMemUnicode($postgresPassword))

# Credenciais de conexão
$user = "postgres"
$host = "$supabaseUrl.db.supabase.co"
$port = "5432"
$database = "postgres"

# Criar pasta de backups se não existir
$backupDir = ".\backups"
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir | Out-Null
}

# Nome do arquivo de backup com timestamp
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = "$backupDir\backup_golpeito_$timestamp.sql"

Write-Host "📦 Iniciando backup do banco de dados..."
Write-Host "Host: $host"
Write-Host "Database: $database"
Write-Host "Arquivo: $backupFile"
Write-Host ""

# Executar pg_dump
$env:PGPASSWORD = $plainPassword
try {
    & pg_dump -U $user -h $host -p $port -d $database -F c -b -v -f $backupFile
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Backup realizado com sucesso!"
        Get-Item $backupFile | Select-Object Name, @{Name="Tamanho";Expression={"{0:N2} MB" -f ($_.Length / 1MB)}}
    } else {
        Write-Host "❌ Erro ao fazer backup. Código: $LASTEXITCODE"
    }
} catch {
    Write-Host "❌ Erro: $_"
} finally {
    Remove-Item env:PGPASSWORD -ErrorAction SilentlyContinue
}
