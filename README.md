# ⚽ GolFamilia — Bolão da Copa do Mundo

Apostas de placares e classificados da Copa do Mundo entre amigos. Sem dinheiro real — só GolCoins e diversão!

---

## 🚀 Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **Supabase** (banco PostgreSQL + auth via JWT próprio)
- **Tailwind CSS**
- **Zustand** (state management)
- **Sonner** (toasts)

---

## ⚙️ Setup rápido

### 1. Clone e instale dependências

```bash
git clone <seu-repo>
cd golpeito
npm install
```

### 2. Crie seu projeto no Supabase

1. Acesse [app.supabase.com](https://app.supabase.com) e crie um projeto
2. Vá em **SQL Editor** e execute o arquivo `supabase-schema.sql` completo
3. Isso vai criar todas as tabelas e já popular os 48 jogos da fase de grupos

### 3. Configure as variáveis de ambiente

```bash
cp .env.local.example .env.local
```

Edite `.env.local` com suas credenciais do Supabase:

```env

NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_anon_key
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
JWT_SECRET=uma_chave_aleatoria_forte_aqui
NEXT_PUBLIC_APP_URL=http://localhost:3000
MATCH_SYNC_SECRET=uma_chave_secreta_para_sync
```

> As chaves ficam em: Supabase Dashboard → Settings → API

### 4. Rode o projeto

```bash
npm run dev
```

Acesse: [http://localhost:3000](http://localhost:3000)

### 5. Sincronizacao automatica de jogos e pontuacao

O projeto agora possui a rota `GET /api/matches/sync` que:

- busca jogos atualizados da API externa;
- faz upsert dos jogos no banco;
- finaliza automaticamente os jogos que passaram para `finished`;
- calcula pontos e atualiza ranking automaticamente.

Para chamar manualmente com seguranca:

```bash
curl -H "x-sync-secret: SUA_MATCH_SYNC_SECRET" http://localhost:3000/api/matches/sync
```

Em deploy na Vercel, o arquivo `vercel.json` agenda essa rota 1 vez por dia (03:00 UTC), compatível com plano Hobby.


## 🎮 Como funciona

### Fluxo do usuário

1. **Cadastro/Login** → recebe cookie JWT seguro (7 dias)
2. **Lobby** → cria sala (código gerado automaticamente) ou entra com código
3. **Sala** → vê todos os jogos da Copa, aposta placar + classificado + GolCoins
4. **Ranking** → pontuação atualizada conforme jogos terminam

### Sistema de pontos (configurável por sala)

| Acerto | Pontos padrão |
|--------|---------------|
| Placar exato (ex: 2x1 = 2x1) | 10 pts |
| Vencedor certo (ex: previu vitória do Brasil) | 5 pts |
| Classificado certo | 3 pts |


---

## 🔧 Deploy (Vercel)

```bash
# Instale a CLI da Vercel
npm i -g vercel

# Deploy
vercel

# Configure as env vars no dashboard da Vercel
# ou via CLI:
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add JWT_SECRET
vercel env add NEXT_PUBLIC_APP_URL
```

---

## 📝 Próximas features sugeridas

- [ ] Encerramento de apostas antes do jogo começar (cron job)
- [ ] Apuração automática de pontos pós-jogo
- [ ] Notificações por email (Resend)
- [ ] Chat na sala
- [ ] Histórico de apostas
- [ ] Fase eliminatória (oitavas, quartas, semi, final)
- [ ] PWA para mobile

---

