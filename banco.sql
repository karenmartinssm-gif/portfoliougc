-- ============================================================
-- BANCO DE DADOS DO PAINEL DA KAREN MARTINS
-- ============================================================
-- Onde colar isso: entre no seu projeto em supabase.com,
-- no menu da esquerda clique em "SQL Editor", depois em
-- "New query", cole este arquivo inteiro e clique em "Run".
-- Pode rodar tudo de uma vez, de cima a baixo.
--
-- Se algum dia precisar rodar de novo do zero, cada tabela
-- é criada com "create table" (sem "if not exists" de propósito,
-- pra você não rodar sem querer duas vezes e perder a proteção
-- de segurança por engano). Se dar erro de "já existe", é sinal
-- de que essa parte já tinha rodado antes.
-- ============================================================


-- Isso liga um recurso do banco que gera um código único (UUID)
-- sozinho pra cada linha nova, sem você precisar inventar um id.
create extension if not exists "pgcrypto";


-- ============================================================
-- TABELA 1: videos
-- Os vídeos que aparecem na seção "Trabalhos por nicho" do seu
-- portfólio. Editar aqui muda o site sozinho, sem publicar de novo.
-- ============================================================
create table public.videos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  link text not null,
  nicho text not null,
  formato text not null,
  marca text not null,
  destaque text,                          -- ex: "2,4M views" (pode ficar em branco)
  ordem integer not null default 0,       -- define a ordem de exibição no site
  visivel boolean not null default true,  -- o olhinho de mostrar/esconder do admin mexe aqui
  criado_em timestamptz not null default now()
);

-- Uma linha de exemplo, só pra você ver o formato. Pode apagar
-- direto pelo admin assim que colocar o primeiro vídeo de verdade.
insert into public.videos (titulo, link, nicho, formato, marca, destaque, ordem, visivel)
values ('[Exemplo] Troque por um vídeo seu', 'https://exemplo.com', 'skincare', 'Reels 9:16', '[Exemplo] Marca fictícia', '0 views', 0, true);


-- ============================================================
-- TABELA 2: marcas
-- Sua base de contatos de empresas (a aba "Marcas" do admin).
-- ============================================================
create table public.marcas (
  id uuid primary key default gen_random_uuid(),
  marca text not null,
  instagram text,
  email text,
  telefone text,
  nicho text
    check (nicho in ('beleza', 'moda', 'saude', 'culinaria', 'casa', 'tecnologia', 'pets', 'viagem', 'lifestyle', 'entretenimento')),
  situacao text not null default 'lead'
    check (situacao in ('lead', 'conversando', 'cliente', 'parada')),
  obs text,
  ultimo_contato date,
  criado_em timestamptz not null default now()
);

insert into public.marcas (marca, instagram, email, telefone, situacao, obs, ultimo_contato)
values ('[Exemplo] Empresa fictícia', '@exemplo', 'exemplo@empresa.com', '', 'lead', 'Isto é um exemplo, pode apagar.', current_date);


-- ============================================================
-- TABELA 3: calendario
-- Sua agenda de gravar, editar e postar (a aba "Calendário").
-- ============================================================
create table public.calendario (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  marca text,
  tipo text not null check (tipo in ('gravar', 'editar', 'postar')),
  data date not null,
  status text not null default 'a_fazer' check (status in ('a_fazer', 'feito')),
  criado_em timestamptz not null default now()
);

insert into public.calendario (titulo, marca, tipo, data, status)
values ('[Exemplo] Gravar vídeo teste', '[Exemplo] Empresa fictícia', 'gravar', current_date, 'a_fazer');


-- ============================================================
-- TABELA 4: campanhas
-- Suas campanhas fechadas com marcas (a aba "Campanhas").
-- ============================================================
create table public.campanhas (
  id uuid primary key default gen_random_uuid(),
  campanha text not null,
  cliente text not null,
  tipo text not null check (tipo in ('Conteúdo', 'Publicidade')),
  status text not null default 'Briefing'
    check (status in ('Briefing', 'Roteiro', 'Aprovação Roteiro', 'Gravação', 'Edição', 'Aprovado', 'Entregue')),
  qtd integer not null default 1,
  valor numeric(10,2) not null default 0,
  prazo date,
  pagamento text not null default 'pendente' check (pagamento in ('pendente', 'pago')),
  ativa boolean not null default true,
  favorita boolean not null default false,
  criado_em timestamptz not null default now()
);

insert into public.campanhas (campanha, cliente, tipo, status, qtd, valor, prazo, pagamento, ativa, favorita)
values ('[Exemplo] Campanha teste', '[Exemplo] Empresa fictícia', 'Conteúdo', 'Briefing', 1, 0, current_date + 7, 'pendente', true, false);


-- ============================================================
-- TABELA 5: marcados
-- Guarda o que você já marcou no checklist do portfólio.
-- Cada item do checklist tem uma "chave" de texto (um código
-- curto). Se a chave está nesta tabela, o item está marcado.
-- Desmarcar o item simplesmente apaga a linha.
-- ============================================================
create table public.marcados (
  chave text primary key,
  marcado_em timestamptz not null default now()
);

-- Essa tabela começa vazia de propósito. Nada de exemplo aqui,
-- porque "exemplo marcado" ia te confundir sobre o que já fez de verdade.


-- ============================================================
-- TABELA 6: visitas
-- Um registro simples de quem visita o seu portfólio, pra
-- alimentar os números da aba "Portfólio" do admin.
-- ============================================================
create table public.visitas (
  id uuid primary key default gen_random_uuid(),
  data timestamptz not null default now(),
  pagina text not null,
  origem text
);

-- Essa também começa vazia de propósito: você ainda não tem
-- visita nenhuma, então os números do admin começam em zero mesmo.


-- ============================================================
-- SEGURANÇA (RLS): a parte mais importante deste arquivo.
--
-- RLS quer dizer "Row Level Security", segurança por linha.
-- Com isso ligado, o banco passa a exigir uma permissão
-- explícita pra cada ação (ler, inserir, editar, apagar) em
-- cada tabela. Sem essas regras abaixo, ninguém consegue
-- fazer nada, nem você.
--
-- A regra geral: só um usuário logado (ou seja, só você,
-- depois que você criar sua conta) pode ler e escrever.
-- Três exceções:
--   - qualquer pessoa (mesmo sem login) pode INSERIR em "marcas",
--     porque é o formulário de contato do seu site;
--   - qualquer pessoa pode INSERIR em "visitas", porque é o
--     registro automático de visita;
--   - qualquer pessoa pode LER os vídeos marcados como visíveis
--     em "videos", porque são os que aparecem no seu portfólio
--     público. Os vídeos escondidos continuam só seus.
-- Fora essa última, em nenhuma das outras alguém de fora
-- consegue LER os dados, só inserir uma linha nova.
-- ============================================================

alter table public.videos enable row level security;
alter table public.marcas enable row level security;
alter table public.calendario enable row level security;
alter table public.campanhas enable row level security;
alter table public.marcados enable row level security;
alter table public.visitas enable row level security;

-- --- videos: um caso especial. Editar (inserir, atualizar, apagar)
--     e ver os vídeos ESCONDIDOS é só sua. Mas os vídeos marcados
--     como visíveis precisam poder ser lidos por qualquer pessoa,
--     sem login, porque são justamente os que aparecem no seu
--     portfólio público para qualquer visitante. ---
create policy "videos_select_publicos" on public.videos
  for select to anon using (visivel = true);
create policy "videos_select_logada" on public.videos
  for select using (auth.role() = 'authenticated');
create policy "videos_insert_logada" on public.videos
  for insert with check (auth.role() = 'authenticated');
create policy "videos_update_logada" on public.videos
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "videos_delete_logada" on public.videos
  for delete using (auth.role() = 'authenticated');

-- --- marcas: você lê/edita/apaga, mas o site público pode
--     inserir um lead novo vindo do formulário de contato ---
create policy "marcas_select_logada" on public.marcas
  for select using (auth.role() = 'authenticated');
create policy "marcas_insert_logada" on public.marcas
  for insert with check (auth.role() = 'authenticated');
create policy "marcas_update_logada" on public.marcas
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "marcas_delete_logada" on public.marcas
  for delete using (auth.role() = 'authenticated');
create policy "marcas_insert_publico_formulario" on public.marcas
  for insert to anon with check (situacao = 'lead');

-- --- calendario: só você ---
create policy "calendario_select_logada" on public.calendario
  for select using (auth.role() = 'authenticated');
create policy "calendario_insert_logada" on public.calendario
  for insert with check (auth.role() = 'authenticated');
create policy "calendario_update_logada" on public.calendario
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "calendario_delete_logada" on public.calendario
  for delete using (auth.role() = 'authenticated');

-- --- campanhas: só você ---
create policy "campanhas_select_logada" on public.campanhas
  for select using (auth.role() = 'authenticated');
create policy "campanhas_insert_logada" on public.campanhas
  for insert with check (auth.role() = 'authenticated');
create policy "campanhas_update_logada" on public.campanhas
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "campanhas_delete_logada" on public.campanhas
  for delete using (auth.role() = 'authenticated');

-- --- marcados: só você ---
create policy "marcados_select_logada" on public.marcados
  for select using (auth.role() = 'authenticated');
create policy "marcados_insert_logada" on public.marcados
  for insert with check (auth.role() = 'authenticated');
create policy "marcados_delete_logada" on public.marcados
  for delete using (auth.role() = 'authenticated');

-- --- visitas: você lê, mas o site público pode inserir uma
--     visita nova (é o registro automático do portfólio) ---
create policy "visitas_select_logada" on public.visitas
  for select using (auth.role() = 'authenticated');
create policy "visitas_insert_publico" on public.visitas
  for insert to anon with check (true);


-- ============================================================
-- FIM DO ARQUIVO.
--
-- Depois de rodar tudo isso, ainda falta um passo fora do SQL,
-- que eu vou te explicar separado: desligar a opção de
-- "qualquer pessoa pode criar conta" no seu Supabase. Sem isso,
-- mesmo com a regra "só quem está logada" acima, uma pessoa
-- de fora poderia criar um login pra ela mesma e entrar. Com
-- essa opção desligada, a única conta que existe é a sua.
-- ============================================================
