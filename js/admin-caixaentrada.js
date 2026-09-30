/* ============================================================
   Aba Caixa de entrada: as mensagens do formulário de contato
   do site (guardadas na tabela "marcas", com situação "lead"),
   mostradas como uma lista de mensagens, com marcação de lida
   e notificação de mensagem nova.
   ============================================================ */

window.AdminCaixaEntrada = (function(){
  "use strict";

  var Core = window.AdminCore;
  var mensagensEmMemoria = [];
  var ultimaContagemConhecida = null;
  var intervaloPolling = null;

  function ehExemplo(texto){
    return String(texto || "").indexOf("[Exemplo]") === 0;
  }

  async function carregar(){
    var resultado = await Core.consultar(
      window.db.from("marcas").select("*").eq("situacao", "lead").order("criado_em", { ascending: false }),
      "mensagens da caixa de entrada"
    );
    mensagensEmMemoria = (resultado.data || []).filter(function(m){ return !ehExemplo(m.marca); });
    renderizar();
    atualizarBadgeComLista();
    configurarBotaoNotificacao();
  }

  function renderizar(){
    var caixa = document.getElementById("listaCaixaEntrada");
    if (!caixa) return;

    if (!mensagensEmMemoria.length){
      caixa.innerHTML = '<div class="estado-vazio">Nenhuma mensagem ainda. Assim que alguém preencher o formulário de contato do site, ela aparece aqui.</div>';
      return;
    }

    caixa.innerHTML = mensagensEmMemoria.map(function(m){
      var naoLida = !m.lida;
      return (
        '<div class="msg-card' + (naoLida ? ' msg-nao-lida' : '') + '" data-id="' + m.id + '">' +
          '<div class="msg-topo">' +
            '<div>' +
              '<p class="msg-marca">' + (naoLida ? '<span class="msg-ponto" title="Não lida"></span>' : '') + Core.escaparHtml(m.marca || "(sem nome da marca/empresa)") + '</p>' +
              '<p class="msg-meta">' + Core.escaparHtml(m.email || "sem e-mail") + ' · ' + Core.formatarDataBR(m.criado_em) + '</p>' +
            '</div>' +
            '<div class="msg-acoes">' +
              (m.email ? '<a class="btn btn-ghost btn-sm" href="mailto:' + encodeURIComponent(m.email) + '" target="_blank" rel="noopener">Responder por e-mail</a>' : '') +
              '<button type="button" class="btn btn-ghost btn-sm btn-alternar-lida" data-id="' + m.id + '" data-lida="' + !!m.lida + '">' + (naoLida ? "Marcar como lida" : "Marcar como não lida") + '</button>' +
            '</div>' +
          '</div>' +
          '<p class="msg-corpo">' + Core.escaparHtml(m.obs || "") + '</p>' +
        '</div>'
      );
    }).join("");

    caixa.querySelectorAll(".btn-alternar-lida").forEach(function(botao){
      botao.addEventListener("click", function(){
        var lidaAtual = botao.getAttribute("data-lida") === "true";
        marcarComoLida(botao.getAttribute("data-id"), !lidaAtual);
      });
    });
  }

  async function marcarComoLida(id, novoValor){
    await Core.consultar(window.db.from("marcas").update({ lida: novoValor }).eq("id", id), "mensagens da caixa de entrada");
    var item = mensagensEmMemoria.find(function(m){ return m.id === id; });
    if (item) item.lida = novoValor;
    renderizar();
    atualizarBadgeComLista();
  }

  async function marcarTodasComoLidas(){
    await Core.consultar(
      window.db.from("marcas").update({ lida: true }).eq("situacao", "lead").eq("lida", false),
      "mensagens da caixa de entrada"
    );
    mensagensEmMemoria.forEach(function(m){ m.lida = true; });
    renderizar();
    atualizarBadgeComLista();
  }

  function atualizarBadgeComLista(){
    var naoLidas = mensagensEmMemoria.filter(function(m){ return !m.lida; }).length;
    atualizarBadge(naoLidas);
  }

  function atualizarBadge(quantidade){
    var selo = document.getElementById("badgeCaixaEntrada");
    if (!selo) return;
    if (quantidade > 0){
      selo.textContent = quantidade > 99 ? "99+" : String(quantidade);
      selo.style.display = "";
    } else {
      selo.style.display = "none";
    }
  }

  /* ---------- Notificação de mensagem nova ---------- */

  function configurarBotaoNotificacao(){
    var botao = document.getElementById("btnAtivarNotificacoes");
    if (!botao || !("Notification" in window)) return;
    if (Notification.permission === "default"){
      botao.style.display = "";
      botao.onclick = function(){
        Notification.requestPermission().then(function(){ botao.style.display = "none"; });
      };
    } else {
      botao.style.display = "none";
    }
  }

  // Fica de olho, mesmo com a aba fechada, se chegou mensagem nova.
  // Faz uma pergunta bem pequena ao banco (só a contagem, não a
  // lista inteira) de tempos em tempos, e se o número de mensagens
  // não lidas aumentou desde a última vez, mostra uma notificação
  // do navegador (se você tiver permitido) e acende o selo no menu.
  async function verificarNovasMensagens(){
    if (!window.db) return;
    var resultado = await window.db.from("marcas")
      .select("id, marca, criado_em", { count: "exact" })
      .eq("situacao", "lead")
      .eq("lida", false)
      .order("criado_em", { ascending: false })
      .limit(1);

    if (resultado.error) return;
    var contagem = resultado.count || 0;
    atualizarBadge(contagem);

    if (ultimaContagemConhecida !== null && contagem > ultimaContagemConhecida){
      var maisRecente = (resultado.data && resultado.data[0]) || null;
      if ("Notification" in window && Notification.permission === "granted"){
        new Notification("Nova mensagem no site", {
          body: maisRecente ? ("De: " + (maisRecente.marca || "novo contato")) : "Você recebeu uma nova mensagem de contato.",
          icon: "../img/karen-foto-capa.webp"
        });
      }
    }
    ultimaContagemConhecida = contagem;
  }

  function iniciarPolling(){
    verificarNovasMensagens();
    if (intervaloPolling) return;
    intervaloPolling = setInterval(verificarNovasMensagens, 30000);
  }

  function iniciar(){
    document.getElementById("btnMarcarTodasLidas").addEventListener("click", marcarTodasComoLidas);
    iniciarPolling();
  }

  iniciar();

  return { carregar: carregar };
})();
