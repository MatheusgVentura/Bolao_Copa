# ⚽ Bolão da Copa 2026

Bolão privado da Copa do Mundo 2026, construído como **aplicação web progressiva (PWA)** em HTML, CSS e JavaScript puros (sem framework, sem build step), com [Supabase](https://supabase.com) como backend (Postgres + Realtime).

> Projeto pessoal desenvolvido para uso real entre amigos — gerencia palpites, ranking em tempo real, bônus especiais e um painel administrativo completo.

## ✨ Funcionalidades

### Para participantes
- **Cadastro** de participantes e palpites por jogo (placar exato).
- **Deadline automático**: palpites fecham 1 minuto antes do horário de cada jogo.
- **Privacidade de palpites**: os palpites dos outros participantes ficam ocultos até o jogo começar (ou até o admin liberar manualmente).
- **Ranking em tempo real** via Supabase Realtime, com pontuação automática:
  - **3 pts** — placar exato
  - **1 pt** — resultado correto (vitória/empate)
- **Bônus especiais**: campeão, artilheiro, finalistas, vice-campeão — com prazo próprio.
- **Painel de Destaques**: pódios de mais cravadas, sequência de acertos e maior taxa de acerto.
- **Chave do mata-mata** visualizada como árvore de classificação interativa.
- **PWA instalável** com suporte a modo escuro e contagem regressiva do próximo jogo.

### Para o administrador
- **Painel admin** com login por senha (hash SHA-256 no client).
- **Conferência de palpites** com liberação manual.
- **Log de auditoria** de todas as alterações de palpites (insert/update/delete).
- **Pontos manuais** por palpite (ajuste) e globais por participante.
- **Importação automática** dos jogos oficiais via JSON (formato [openfootball/worldcup.json](https://github.com/openfootball/worldcup.json)).
- **Sincronização automática** dos resultados a cada 5 minutos.
- **Trava de placar** para impedir que a sincronização sobrescreva resultados corrigidos manualmente.

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                    Front-end (PWA)                       │
│  index.html · styles.css · app.js · supabase-config.js  │
│         HTML/CSS/JS puro · sem build step               │
└──────────────────────────┬──────────────────────────────┘
                           │ Supabase JS SDK
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    Supabase (Backend)                   │
│  ┌──────────┐  ┌────────────┐  ┌────────────────────┐  │
│  │ Postgres │  │  Realtime  │  │  Row Level Security │  │
│  │  (RLS)   │  │ (WebSockets)│  │  + Triggers/Funcs  │  │
│  └──────────┘  └────────────┘  └────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

| Arquivo | Descrição |
| --- | --- |
| `index.html` | Toda a interface (formulários, ranking, jogos, destaques, painel admin) |
| `app.js` | Lógica da aplicação: estado, cálculo de pontos/ranking, chamadas ao Supabase |
| `styles.css` | Estilos com suporte a modo claro/escuro |
| `supabase-config.js` | Credenciais do Supabase, senha/hash do admin e URL dos jogos oficiais (**não versionar com dados reais**) |
| `supabase-config.example.js` | Template de configuração para preencher |
| `supabase-schema.sql` | Schema completo do banco — cria todas as tabelas, triggers e policies iniciais |
| `supabase-security-migration.sql` | Migração de segurança: RLS restritivo + validação de deadline no banco |
| `supabase-*-migration.sql` | Migrações incrementais aplicadas depois do schema inicial |
| `official-matches.sample.json` | Exemplo do formato esperado para importar jogos |
| `manifest.json` · `sw.js` | Configuração PWA (manifesto e service worker) |
| `Fotos/` | Fotos dos participantes (usadas como avatar quando o nome bate) |

### Modelo de dados

- **`participants`** — participantes (nome único, status de pagamento, palpites de bônus, pontos manuais)
- **`matches`** — jogos (times, placar, horário, stage, flag de mata-mata, trava de resultado)
- **`predictions`** — palpites (participante + jogo + placar, com unique constraint por par)
- **`prediction_logs`** — log de auditoria de todas as alterações de palpites
- **`special_results`** — resultados dos bônus especiais (campeão, artilheiro, etc.)

## 🔒 Segurança

O projeto implementa segurança em **múltiplas camadas**:

### Row Level Security (RLS) no Postgres
- **Leitura pública** de participantes, jogos e resultados especiais.
- **Palpites ocultos** até o jogo começar (ou ser liberado) — policy baseada em `kickoff_at` e `predictions_released`.
- **Escrita administrativa** (jogos, resultados, bônus) restrita à role `authenticated`/`service_role`.
- **Log de auditoria** com leitura restrita ao admin.

### Validação de deadline no banco
Um trigger `enforce_prediction_deadline` bloqueia qualquer insert/update de palpites após o deadline, independentemente do cliente — protege contra clients antigos ou maliciosos.

### Trava de placar
O trigger `protect_locked_match_result` impede que a sincronização automática sobrescreva um placar corrigido manualmente pelo admin.

### Autenticação do admin
- O login do admin usa **Supabase Auth** (email + senha) — a senha **nunca** fica no código do site.
- O admin faz login por um modal no próprio app; o Supabase devolve um JWT que autoriza as operações administrativas via RLS.
- A sessão expira automaticamente e pode ser revogada no Dashboard do Supabase.
- O estado de admin é derivado da sessão do Supabase Auth (não há mais segredo nenhum no front-end).

### Boas práticas de configuração
- `supabase-config.js` está no `.gitignore` — credenciais reais nunca são commitadas.
- `supabase-config.example.js` serve de template.
- Recomenda-se usar a **service_role key** apenas em um backend/Edge Function, nunca exposta no front-end público.

> ⚠️ **Aviso**: por ser um bolão privado entre amigos, a segurança depende de manter o link e a senha privados. Para uso público, recomenda-se implementar autenticação real (Supabase Auth) e mover operações administrativas para um backend.

## 🚀 Como rodar localmente

### Pré-requisitos
- Um projeto no [Supabase](https://supabase.com) (plano gratuito é suficiente).
- Um servidor estático local (não pode abrir `index.html` direto com `file://` por causa de CORS/módulos).

### Passos

1. **Crie o banco de dados**: rode `supabase-schema.sql` no SQL Editor do Supabase.
2. **Aplique as migrações** na ordem (arquivos `supabase-*-migration.sql`), incluindo `supabase-security-migration.sql`.
3. **Configure as credenciais**: copie `supabase-config.example.js` para `supabase-config.js` e preencha com a URL e a anon key do seu projeto.
4. **Crie o usuário admin**: no Supabase Dashboard → **Authentication** → **Users** → **Add user**, crie um usuário com email e senha de admin.
5. **Aplique a migration de segurança**: rode `supabase-security-migration.sql` no SQL Editor.
6. **Sirva os arquivos estáticos**:
   ```bash
   npx serve .
   # ou
   python -m http.server 5500
   ```
7. **Acesse** o endereço local no navegador.

## 🛠️ Tecnologias

- **Front-end**: HTML5, CSS3 (com custom properties para theming), JavaScript (ES2020+, módulos), Web Crypto API, Service Worker API, Web Manifest
- **Backend**: Supabase (PostgreSQL, Realtime via WebSockets, Row Level Security)
- **Banco de dados**: PostgreSQL com triggers, functions (PL/pgSQL), constraints e índices únicos
- **PWA**: instalável, com suporte offline básico e modo escuro

## 📋 Regras do bolão

- **Entrada**: R$100 por participante (configurável em `app.js`).
- **Pontuação**: 3 pts (placar exato) · 1 pt (resultado correto).
- **Deadline**: palpites fecham 1 minuto antes do horário do jogo.
- **Bônus especiais**: campeão, artilheiro, vice-campeão e finalistas — com prazo próprio (definido em `app.js`).
- **Pontos manuais**: o admin pode ajustar pontos por palpite ou por participante.

## 📝 Notas

- Não há autenticação real de participantes: o app identifica o participante pelo nome selecionado (guardado em `localStorage`). A segurança do bolão depende de manter o link privado.
- `ENTRY_VALUE` (valor da entrada, R$100) está fixo em `app.js`.
- A sincronização automática de resultados roda a cada 5 minutos e respeita a trava de placar manual.

## ⚠️ Aviso importante

> **Este é um bolão privado entre amigos.** Não há autenticação de participantes — qualquer pessoa com o link consegue selecionar qualquer nome e palpitá-lo. **Não tente palpitar no lugar de outros participantes.** O painel admin audita todas as alterações (log de palpites com data/hora), e palpites suspeitos podem ser revertidos. O objetivo é diversão entre conhecidos, não competição desleal.
