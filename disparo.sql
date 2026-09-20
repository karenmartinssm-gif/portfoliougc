-- ============================================================
-- BANCO DE DADOS DA ABA PROSPECÇÃO (disparo de e-mails)
-- ============================================================
-- Onde colar isso: o mesmo lugar de sempre. Entre no seu projeto
-- em supabase.com, clique em "SQL Editor" no menu da esquerda,
-- depois em "New query", cole este arquivo inteiro e clique em
-- "Run".
--
-- Rode isso DEPOIS do banco.sql, porque aqui a gente usa a
-- tabela "marcas" que já existe. Nada aqui apaga o que já está
-- lá, só acrescenta.
-- ============================================================


-- ============================================================
-- DUAS COLUNAS NOVAS NA TABELA "marcas"
-- ============================================================

-- Guarda quais marcas você deixou marcadas na caixinha de seleção,
-- lá na aba Marcas. Fica salvo no banco, então se você marcar hoje
-- e só disparar amanhã, a seleção continua lá.
alter table public.marcas add column selecionada boolean not null default false;

-- Guarda a data do último e-mail de prospecção que essa marca
-- recebeu. É diferente do campo "ultimo_contato", que é o campo
-- que você preenche na mão: este aqui o sistema preenche sozinho
-- toda vez que um disparo dá certo pra essa marca.
alter table public.marcas add column ultimo_envio_email date;


-- ============================================================
-- TABELA NOVA: email_envios
-- Um registro por e-mail enviado (ou que tentou enviar, e falhou).
-- Sem essa tabela, se um disparo parar no meio do caminho, não
-- tem como saber pra quem já foi e pra quem não foi.
-- ============================================================
create table public.email_envios (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  marca_id uuid references public.marcas(id) on delete set null,
  assunto text not null,
  status text not null check (status in ('ok', 'erro')),
  erro text,
  resend_id text,
  criado_em timestamptz not null default now()
);


-- ============================================================
-- TABELA NOVA: email_optout
-- A lista de quem pediu pra não receber mais (respondeu SAIR).
-- Todo disparo confere essa lista antes de mandar, pra nunca
-- mandar pra quem já pediu pra sair.
-- ============================================================
create table public.email_optout (
  email text primary key,
  criado_em timestamptz not null default now()
);


-- ============================================================
-- SEGURANÇA (RLS): igual ao resto do painel. Só você, logada,
-- consegue ler e escrever nessas duas tabelas. Ninguém de fora,
-- nem deslogado, enxerga nada.
-- ============================================================

alter table public.email_envios enable row level security;
alter table public.email_optout enable row level security;

create policy "email_envios_select_logada" on public.email_envios
  for select using (auth.role() = 'authenticated');
create policy "email_envios_insert_logada" on public.email_envios
  for insert with check (auth.role() = 'authenticated');

create policy "email_optout_select_logada" on public.email_optout
  for select using (auth.role() = 'authenticated');
create policy "email_optout_insert_logada" on public.email_optout
  for insert with check (auth.role() = 'authenticated');
create policy "email_optout_delete_logada" on public.email_optout
  for delete using (auth.role() = 'authenticated');


-- ============================================================
-- FIM DO ARQUIVO.
--
-- A função "enviar-emails" que manda os e-mails de verdade roda
-- separada do site, dentro do Supabase (é a "Edge Function").
-- Ela usa a chave de administrador do próprio Supabase pra escrever
-- nessas tabelas, então essas regras de RLS acima protegem a
-- LEITURA que o admin faz (o histórico que você vê na tela), não
-- atrapalham a função de mandar e-mail.
-- ============================================================
