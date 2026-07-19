-- =====================================================================
-- Migração de segurança: RLS restritivo + validação de deadline no banco
-- ---------------------------------------------------------------------
-- Esta migração substitui as políticas permissivas originais por um
-- conjunto de políticas que reflete as regras de negócio do bolão:
--
--   • Participantes: leitura pública; cadastro livre; edição/deleção só admin.
--   • Jogos (matches): leitura pública; escrita/deleção só admin.
--   • Palpites (predictions): leitura pública APÓS o jogo começar (ou ser
--     liberado); cadastro/edição só antes do deadline e um por participante
--     por jogo; edição/deleção de campos sensíveis (manual_points, reviewed)
--     só admin.
--   • Log de palpites: leitura só admin.
--   • Resultados especiais: leitura pública; escrita só admin.
--
-- "Admin" aqui significa: requisições autenticadas (role authenticated) ou
-- requisições com a service_role. O app client usa a anon key para operações
-- de participantes/palpites e a service_role (via Edge Function ou backend)
-- para operações administrativas. Se você ainda não tem um backend, pode
-- usar a service_role diretamente no painel admin — mas NÃO exponha essa
-- chave no front-end público.
--
-- IMPORTANTE: rode esta migration no SQL Editor do Supabase.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Helper: verificar se a role atual é admin (authenticated/service_role)
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (auth.role() = 'authenticated'),
    (auth.role() = 'service_role'),
    false
  );
$$;

-- ---------------------------------------------------------------------
-- 1. participants
-- ---------------------------------------------------------------------
drop policy if exists "Link pode ver participantes" on public.participants;
drop policy if exists "Link pode adicionar participantes" on public.participants;
drop policy if exists "Link pode editar participantes" on public.participants;
drop policy if exists "Link pode remover participantes" on public.participants;

create policy "Leitura publica de participantes" on public.participants
  for select to anon, authenticated using (true);

create policy "Cadastro livre de participantes" on public.participants
  for insert to anon, authenticated with check (true);

create policy "Edicao de participantes so admin" on public.participants
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Remocao de participantes so admin" on public.participants
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------
-- 2. matches
-- ---------------------------------------------------------------------
drop policy if exists "Link pode ver jogos" on public.matches;
drop policy if exists "Link pode adicionar jogos" on public.matches;
drop policy if exists "Link pode atualizar resultados" on public.matches;
drop policy if exists "Link pode remover jogos" on public.matches;

create policy "Leitura publica de jogos" on public.matches
  for select to anon, authenticated using (true);

create policy "Escrita de jogos so admin" on public.matches
  for insert to authenticated with check (public.is_admin());

create policy "Atualizacao de jogos so admin" on public.matches
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Remocao de jogos so admin" on public.matches
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------
-- 3. predictions
-- ---------------------------------------------------------------------
drop policy if exists "Link pode ver palpites" on public.predictions;
drop policy if exists "Link pode salvar palpites" on public.predictions;
drop policy if exists "Link pode editar palpites" on public.predictions;
drop policy if exists "Link pode revisar palpites" on public.predictions;
drop policy if exists "Link pode remover palpites" on public.predictions;

-- Leitura: palpites só ficam visíveis depois que o jogo começou ou foi liberado.
create policy "Leitura de palpites apos inicio do jogo" on public.predictions
  for select to anon, authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.matches m
      where m.id = predictions.match_id
        and (
          m.predictions_released = true
          or m.kickoff_at is null
          or m.kickoff_at <= now()
        )
    )
  );

-- Inserção: só antes do deadline (kickoff - 1 minuto) e um por participante/jogo.
create policy "Insercao de palpites antes do deadline" on public.predictions
  for insert to anon, authenticated
  with check (
    public.is_admin()
    or (
      not exists (
        select 1 from public.matches m
        where m.id = predictions.match_id
          and m.kickoff_at is not null
          and m.kickoff_at - interval '1 minute' <= now()
      )
    )
  );

-- Atualização: admin pode tudo; usuário comum só pode editar placar antes do
-- deadline e não pode tocar em manual_points/reviewed.
create policy "Atualizacao de palpites" on public.predictions
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Atualizacao de placar antes do deadline" on public.predictions
  for update to anon
  using (
    not public.is_admin()
    and not exists (
      select 1 from public.matches m
      where m.id = predictions.match_id
        and m.kickoff_at is not null
        and m.kickoff_at - interval '1 minute' <= now()
    )
  )
  with check (
    not public.is_admin()
    and not exists (
      select 1 from public.matches m
      where m.id = predictions.match_id
        and m.kickoff_at is not null
        and m.kickoff_at - interval '1 minute' <= now()
    )
  );

-- Remoção: só admin.
create policy "Remocao de palpites so admin" on public.predictions
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------
-- 4. prediction_logs
-- ---------------------------------------------------------------------
drop policy if exists "Link pode ver log de palpites" on public.prediction_logs;

create policy "Leitura do log so admin" on public.prediction_logs
  for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------
-- 5. special_results
-- ---------------------------------------------------------------------
drop policy if exists "Link pode ver resultados especiais" on public.special_results;
drop policy if exists "Link pode editar resultados especiais" on public.special_results;

create policy "Leitura publica de resultados especiais" on public.special_results
  for select to anon, authenticated using (true);

create policy "Edicao de resultados especiais so admin" on public.special_results
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 6. Trigger: impedir palpites após o deadline no nível do banco
-- ---------------------------------------------------------------------
-- Mesmo que uma policy falhe em cobrir um caso, este trigger bloqueia
-- qualquer insert/update de placar em predictions depois do deadline.
create or replace function public.enforce_prediction_deadline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  m_kickoff timestamptz;
  m_released boolean;
begin
  -- Admin (authenticated ou service_role) bypassa a verificação: o painel admin
  -- precisa inserir/corrigir palpites mesmo depois do prazo encerrado.
  if public.is_admin() then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  select kickoff_at, predictions_released
    into m_kickoff, m_released
    from public.matches
    where id = new.match_id;

  if m_kickoff is not null
     and m_released is not true
     and m_kickoff - interval '1 minute' <= now() then
    raise exception 'Palpites deste jogo já estão encerrados (deadline: %).',
      m_kickoff - interval '1 minute';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_prediction_deadline on public.predictions;
create trigger trg_enforce_prediction_deadline
  before insert or update or delete on public.predictions
  for each row execute function public.enforce_prediction_deadline();
