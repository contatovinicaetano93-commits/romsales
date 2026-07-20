# Romsales

App do profissional individual para **ROM Club Brasil** e **ROM Club Iguatemi**.

Produto separado (modelo Vitrini): login e páginas próprias em URL própria — **não** é acesso por dentro do painel da equipe.

- Landing: `/` — Entrar / Criar conta (Free, sem planos)
- Login: `/login` → `/pro/conectar` → `/pro/hoje`
- Painel da equipe: apenas em `rom-club` / `rom-iguatemi` (projetos distintos)

Guia completo: [SETUP.md](./SETUP.md)

```bash
npm install
cp deploy/vercel-romsales-brasil.env .env.local   # preencher DATABASE_URL
npm run db:migrate
npm run dev
```
