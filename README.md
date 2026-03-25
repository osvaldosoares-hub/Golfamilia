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
NEXT_PUBLIC_SUPABASE_URL=https://cgptvijqxyhycqiqetik.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_1vznkTVSDpgXxz--MLVnDw_VEhJ0EX1
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
JWT_SECRET=uma_chave_aleatoria_forte_aqui
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> As chaves ficam em: Supabase Dashboard → Settings → API

### 4. Rode o projeto

```bash
npm run dev
```

Acesse: [http://localhost:3000](http://localhost:3000)


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

