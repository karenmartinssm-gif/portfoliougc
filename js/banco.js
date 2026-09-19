/* ============================================================
   Conexão com o banco de dados (Supabase).
   Este arquivo é carregado em toda página que precisa falar
   com o banco: portfólio, login e admin.

   A chave aqui embaixo é a chave PÚBLICA (anon/publishable).
   Ela pode ficar visível no código sem problema, porque sozinha
   ela não abre nenhuma porta: quem decide o que pode ou não
   pode é a segurança (RLS) configurada dentro do Supabase,
   no arquivo banco.sql. Nunca coloque a chave secreta aqui.
   ============================================================ */

window.BANCO_URL = "https://zyvwbgcynvewllgsersb.supabase.co";
window.BANCO_CHAVE_PUBLICA = "sb_publishable_5bwOKVE09PeyHJQYSopPDg_wBULrI35";

// "supabase" aqui é o nome da biblioteca carregada por CDN
// (veja a tag <script> no <head> de cada página).
window.db = supabase.createClient(window.BANCO_URL, window.BANCO_CHAVE_PUBLICA);
