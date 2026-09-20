// ============================================================
// FUNÇÃO "enviar-emails" (o carteiro da aba Prospecção)
// ============================================================
// Isso roda dentro do Supabase, não no site. O admin chama essa
// função, ela confere se é mesmo a Karen quem está pedindo, e
// manda os e-mails um por um pelo Resend, registrando cada um
// na tabela email_envios.
//
// A chave do Resend (RESEND_API_KEY) fica guardada como segredo
// desta função, dentro do painel do Supabase. Ela nunca aparece
// aqui no código nem em lugar nenhum do site.
//
// Como subir isso no Supabase: veja o passo a passo que a Karen
// recebeu na conversa com o Claude, na hora em que essa aba foi
// criada (instalar o Supabase CLI, rodar "supabase login", depois
// "supabase functions deploy enviar-emails").
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";

// -------- Configuração fixa (não são segredos, são só os dados
// dela mesma: quem pode usar a função e pra onde as respostas vão) --------
const EMAIL_PERMITIDO = "karenmartins.sm@gmail.com";
const EMAIL_RESPOSTA = "contato.kaamartins@gmail.com";
const MAX_DESTINATARIOS_POR_CHAMADA = 250;
const PAUSA_ENTRE_ENVIOS_MS = 200; // ~5 e-mails por segundo, ritmo seguro do Resend

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function respostaJson(corpo, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
  });
}

function primeiroNome(nomeCompleto) {
  var texto = String(nomeCompleto || "").trim();
  if (!texto) return "";
  return texto.split(" ")[0];
}

function trocarVariaveis(texto, nomeMarca) {
  return String(texto || "")
    .split("{{nome}}").join(primeiroNome(nomeMarca))
    .split("{{marca}}").join(String(nomeMarca || ""));
}

function pausa(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

Deno.serve(async (req) => {
  // O navegador manda um "OPTIONS" antes do POST de verdade, pra
  // perguntar se pode. Sem responder isso, o disparo nem começa.
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return respostaJson({ erro: "Método não permitido." }, 405);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "Karen Martins <onboarding@resend.dev>";

  if (!RESEND_API_KEY) {
    return respostaJson({ erro: "RESEND_API_KEY não está configurada nos segredos da função." }, 500);
  }

  // ---------- 1. Só a Karen pode usar isso ----------
  const cabecalhoAuth = req.headers.get("Authorization") || "";
  const token = cabecalhoAuth.replace("Bearer ", "").trim();
  if (!token) {
    return respostaJson({ erro: "Não autorizado." }, 401);
  }

  const supabaseComoUsuario = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: cabecalhoAuth } }
  });
  const { data: dadosUsuario, error: erroUsuario } = await supabaseComoUsuario.auth.getUser(token);

  if (erroUsuario || !dadosUsuario || !dadosUsuario.user || dadosUsuario.user.email !== EMAIL_PERMITIDO) {
    return respostaJson({ erro: "Não autorizado." }, 401);
  }

  // Cliente com a chave de administrador do Supabase, só pra essa
  // função conseguir gravar o histórico e atualizar a tabela de
  // marcas sem esbarrar no RLS (que é pra proteger o admin, não
  // pra travar a própria função que já conferiu quem está pedindo).
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // ---------- 2. Lê o que foi pedido ----------
  let corpoPedido;
  try {
    corpoPedido = await req.json();
  } catch (erroLeitura) {
    return respostaJson({ erro: "Corpo da requisição inválido." }, 400);
  }

  const destinatarios = Array.isArray(corpoPedido.destinatarios) ? corpoPedido.destinatarios : [];
  const assunto = String(corpoPedido.assunto || "").trim();
  const corpoHtml = String(corpoPedido.corpoHtml || "");

  if (!assunto || !corpoHtml) {
    return respostaJson({ erro: "Faltou assunto ou o corpo do e-mail." }, 400);
  }
  if (!destinatarios.length) {
    return respostaJson({ erro: "Nenhum destinatário foi enviado." }, 400);
  }
  // ---------- 3. No máximo 250 por chamada ----------
  if (destinatarios.length > MAX_DESTINATARIOS_POR_CHAMADA) {
    return respostaJson({ erro: "Máximo de " + MAX_DESTINATARIOS_POR_CHAMADA + " destinatários por chamada." }, 400);
  }

  // ---------- 5. Quem já pediu pra sair não recebe nunca mais ----------
  const { data: listaOptout } = await supabaseAdmin.from("email_optout").select("email");
  const emailsDescadastrados = new Set(
    (listaOptout || []).map(function (linha) { return String(linha.email).trim().toLowerCase(); })
  );

  // Tira duplicado (o mesmo e-mail duas vezes na lista, comum
  // quando duas marcas usam o e-mail da mesma agência) e quem
  // está descadastrado.
  const jaVistos = new Set();
  const fila = [];
  let pulados = 0;
  for (const destinatario of destinatarios) {
    const emailLimpo = String(destinatario.email || "").trim().toLowerCase();
    if (!emailLimpo || jaVistos.has(emailLimpo) || emailsDescadastrados.has(emailLimpo)) {
      pulados++;
      continue;
    }
    jaVistos.add(emailLimpo);
    fila.push({
      email: emailLimpo,
      marca: String(destinatario.marca || "").trim(),
      marcaId: destinatario.marcaId || null
    });
  }

  let enviados = 0;
  let falharam = 0;
  let cotaEsgotada = false;

  // ---------- 6, 4, 7, 8, 9, 10: manda um por um ----------
  for (const item of fila) {
    if (cotaEsgotada) {
      pulados++;
      continue;
    }

    const assuntoPersonalizado = trocarVariaveis(assunto, item.marca);
    const htmlPersonalizado = trocarVariaveis(corpoHtml, item.marca);

    try {
      const respostaResend = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + RESEND_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: RESEND_FROM_EMAIL,
          to: item.email,
          reply_to: EMAIL_RESPOSTA,
          subject: assuntoPersonalizado,
          html: htmlPersonalizado,
          headers: {
            "List-Unsubscribe": "<mailto:" + EMAIL_RESPOSTA + "?subject=SAIR>"
          }
        })
      });

      const dadosResend = await respostaResend.json().catch(function () { return {}; });

      if (!respostaResend.ok) {
        const tipoErro = (dadosResend && (dadosResend.name || (dadosResend.error && dadosResend.error.type))) || "";
        const ehCotaEsgotada = tipoErro === "daily_quota_exceeded" || respostaResend.status === 429;

        await supabaseAdmin.from("email_envios").insert({
          email: item.email,
          marca_id: item.marcaId,
          assunto: assuntoPersonalizado,
          status: "erro",
          erro: ehCotaEsgotada ? "Cota diária do Resend esgotada." : (dadosResend.message || JSON.stringify(dadosResend)),
          resend_id: null
        });
        falharam++;

        if (ehCotaEsgotada) {
          cotaEsgotada = true;
        }
      } else {
        await supabaseAdmin.from("email_envios").insert({
          email: item.email,
          marca_id: item.marcaId,
          assunto: assuntoPersonalizado,
          status: "ok",
          erro: null,
          resend_id: dadosResend.id || null
        });
        if (item.marcaId) {
          await supabaseAdmin.from("marcas")
            .update({ ultimo_envio_email: new Date().toISOString().slice(0, 10) })
            .eq("id", item.marcaId);
        }
        enviados++;
      }
    } catch (erroEnvio) {
      await supabaseAdmin.from("email_envios").insert({
        email: item.email,
        marca_id: item.marcaId,
        assunto: assuntoPersonalizado,
        status: "erro",
        erro: String(erroEnvio && erroEnvio.message ? erroEnvio.message : erroEnvio),
        resend_id: null
      });
      falharam++;
    }

    await pausa(PAUSA_ENTRE_ENVIOS_MS);
  }

  // ---------- 11. Resumo final ----------
  return respostaJson({ enviados: enviados, falharam: falharam, pulados: pulados, cotaEsgotada: cotaEsgotada });
});
