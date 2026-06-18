# Script de Restore do Backup do Supabase
# =========================================
# Restaura um backup anterior do banco de dados

$supabaseUrl = "cgptvijqxyhycqiqetik"  # Project ID do Supabase
$postgresPassword = Read-Host "Digite a senha do banco de dados PostgreSQL do Supabase" -AsSecureString
$plainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToCoTaskMemUnicode($postgresPassword))

# Listar backups disponíveis
$backupDir = ".\backups"
if (-not (Test-Path $backupDir)) {
    Write-Host "❌ Nenhum backup encontrado em $backupDir"
    exit 1
}

$backups = Get-ChildItem $backupDir -Filter "backup_*.sql" | Sort-Object LastWriteTime -Descending
if ($backups.Count -eq 0) {
    Write-Host "❌ Nenhum arquivo de backup encontrado"
    exit 1
}

Write-Host "📋 Backups disponíveis:"
for ($i = 0; $i -lt $backups.Count; $i++) {
    $size = "{0:N2} MB" -f ($backups[$i].Length / 1MB)
    $date = $backups[$i].LastWriteTime.ToString("dd/MM/yyyy HH:mm:ss")
    Write-Host "[$($i+1)] $($backups[$i].Name) - $size ($date)"
}

$choice = Read-Host "Escolha o número do backup para restaurar"
$backupFile = $backups[[int]$choice - 1].FullName

if (-not (Test-Path $backupFile)) {
    Write-Host "❌ Arquivo de backup não encontrado"
    exit 1
}

# Credenciais de conexão
$user = "postgres"
$host = "$supabaseUrl.db.supabase.co"
$port = "5432"
$database = "postgres"

Write-Host ""
Write-Host "⚠️  AVISO: Isto irá SOBRESCREVER os dados atuais do banco de dados!"
$confirm = Read-Host "Digite 'sim' para confirmar"

if ($confirm -ne "sim") {
    Write-Host "Operação cancelada"
    exit 0
}

Write-Host ""
Write-Host "🔄 Restaurando backup: $backupFile..."
Write-Host ""

# Restaurar backup
$env:PGPASSWORD = $plainPassword
try {
    & pg_restore -U $user -h $host -p $port -d $database -v -c $backupFile
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Backup restaurado com sucesso!"
    } else {
        Write-Host "⚠️  Restauração concluída com código: $LASTEXITCODE"
    }
} catch {
    Write-Host "❌ Erro: $_"
} finally {
    Remove-Item env:PGPASSWORD -ErrorAction SilentlyContinue
}
