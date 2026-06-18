# 📦 Scripts de Backup e Restore

Este diretório contém scripts para fazer backup e restaurar dados do banco de dados Supabase do Golpeito.

## 🔧 Scripts Disponíveis

### 1. **backup-database.mjs** - Fazer Backup
Exporta todos os dados do banco em um arquivo SQL.

```bash
node scripts/backup-database.mjs
```

**O que é feito:**
- Exporta todas as tabelas: users, rooms, room_members, matches, bets, group_bets
- Cria um arquivo `.sql` na pasta `backups/` com timestamp
- Mostra um resumo dos dados exportados

**Saída:**
```
✅ Backup concluído com sucesso!
📁 Arquivo: backups/backup_golpeito_2026-06-15T19-25-10-714Z.sql
📊 Tamanho: 0.11 MB
```

### 2. **restore-database.mjs** - Restaurar Backup
Restaura dados de um backup anterior.

```bash
node scripts/restore-database.mjs
```

**O que faz:**
- Lista todos os backups disponíveis
- Pede confirmação antes de sobrescrever os dados
- Restaura o backup selecionado

**⚠️ Aviso:** Esta operação SOBRESCREVERÁ os dados atuais!

---

## 📋 Opções Manuais (Supabase Dashboard)

Se preferir fazer backup via dashboard do Supabase:

1. Acesse: https://app.supabase.com
2. Selecione seu projeto: **Golpeito**
3. Menu lateral → **Database** → **Backups**
4. Clique em **Download** do backup desejado
5. Extraia o arquivo `.backup` usando:

```bash
pg_restore -U postgres -h localhost -d golpeito backup_file.backup
```

---

## 📁 Estrutura

```
backups/
├── backup_golpeito_2026-06-15T19-25-10-714Z.sql
├── backup_golpeito_2026-06-14T18-30-45-123Z.sql
└── ...
```

---

## ✅ Checklist

- ✅ Backup automático criado em `backups/backup_golpeito_*.sql`
- ✅ Dados de 6 tabelas principais exportados
- ✅ Script de restore pronto para usar
- ✅ Guia de recuperação disponível

---

## 🚀 Próximos Passos

Para automatizar backups diários, adicione ao seu `package.json`:

```json
{
  "scripts": {
    "backup": "node scripts/backup-database.mjs",
    "restore": "node scripts/restore-database.mjs"
  }
}
```

Ou configure um cron job:
```bash
0 2 * * * cd /path/to/golpeito && node scripts/backup-database.mjs
```

---

## 📞 Suporte

Para mais informações sobre Supabase Backups:
- Docs: https://supabase.com/docs/guides/database/backups
- Dashboard: https://app.supabase.com
