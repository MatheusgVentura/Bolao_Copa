# Bolão da Copa

Bolão privado para a Copa do Mundo 2026. Site estático (HTML/CSS/JS puro, sem build) com [Supabase](https://supabase.com) como backend.

## Funcionalidades

- Cadastro de participantes e palpites por jogo (placar exato).
- Palpites fecham automaticamente 1 minuto antes do horário do jogo.
- Palpites de outros participantes ficam ocultos até o jogo começar (ou até o admin liberar manualmente).
- Importação automática dos jogos oficiais via JSON (formato [openfootball/worldcup.json](https://github.com/openfootball/worldcup.json)) e sincronização automática dos resultados a cada 5 minutos.
- Ranking em tempo real (Supabase Realtime) com pontuação:
  - **3 pts** — placar exato
  - **1 pt** — resultado correto (vitória/empate)
  - Pontos manuais por palpite (ajuste do admin) e pontos manuais globais por participante
- Bônus especiais (campeão, artilheiro, finalistas) com prazo próprio.
- Painel **Destaques**: pódios de mais cravadas, sequência de acertos e maior taxa de acerto.
- Painel admin (login por senha, client-side): conferência de palpites, liberação de palpites, log de auditoria e bônus.

## Estrutura do projeto

| Arquivo | Descrição |
| --- | --- |
| `index.html` | Toda a interface (formulários, ranking, jogos, destaques, painel admin) |
| `app.js` | Lógica da aplicação: estado, cálculo de pontos/ranking, chamadas ao Supabase |
| `styles.css` | Estilos |
| `supabase-config.js` | Credenciais do Supabase, senha do admin e URL dos jogos oficiais (não versionar com dados reais em produção pública) |
| `supabase-schema.sql` | Schema completo do banco — rodar no SQL Editor do Supabase para criar o projeto do zero |
| `supabase-*-migration.sql` | Migrações incrementais aplicadas depois do schema inicial |
| `official-matches.sample.json` | Exemplo do formato esperado para importar jogos |
| `Fotos/` | Fotos dos participantes (usadas como avatar quando o nome bate) |

## Como rodar localmente

1. Crie um projeto no [Supabase](https://supabase.com) e rode o `supabase-schema.sql` (e as migrações, se já existirem) no SQL Editor.
2. Preencha `supabase-config.js` com a URL e a anon key do seu projeto, defina uma senha de admin e, se quiser importação automática, a URL do JSON de jogos oficiais.
3. Sirva os arquivos estáticos (não pode abrir o `index.html` direto com `file://` por causa do CORS/módulos):
   ```bash
   npx serve .
   # ou
   python -m http.server 5500
   ```
4. Acesse o endereço local no navegador.

## Notas

- Não há autenticação real: o modo admin é uma senha simples guardada em `sessionStorage`, e o RLS do Supabase está habilitado mas permissivo (a chave anônima tem acesso total às tabelas). A segurança do app depende de manter o link/senha privados.
- `ENTRY_VALUE` (valor da entrada, R$100) está fixo em `app.js`.
