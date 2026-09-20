/* ============================================================
   Aba Prospecção: manda o e-mail de apresentação pra várias
   marcas da aba Marcas de uma vez, cada uma chamada pelo nome.

   Quem manda o e-mail de verdade é a função "enviar-emails" lá
   no Supabase (veja supabase/functions/enviar-emails/index.ts).
   Esse arquivo aqui só monta a tela, decide pra quem vai, monta
   o e-mail, e chama essa função.
   ============================================================ */

window.AdminProspeccao = (function(){
  "use strict";

  var Core = window.AdminCore;

  var EMAIL_ADMIN = "karenmartins.sm@gmail.com";
  var EMAIL_CONTATO = "contato.kaamartins@gmail.com";
  var MARCA_EXEMPLO_PREVIEW = "Ateliê Bela";

  var rotuloSituacao = {
    lead: "Lead",
    conversando: "Conversando",
    cliente: "Cliente",
    parada: "Parada"
  };

  var marcasEmMemoria = [];
  var historicoEmMemoria = null; // null = tabela ainda não carregou/não existe
  var optoutsEmMemoria = null;
  var historicoFalhouCarregar = false;
  var optoutFalhouCarregar = false;

  var modoEscrita = "texto"; // "texto" ou "html"
  var modoEnvio = "resend"; // "resend" ou "rascunho"
  var filaRascunho = [];
  var jaConfigurouListeners = false;

  /* ---------- Ferramentas pequenas ---------- */

  function primeiroNomeDe(nomeCompleto){
    var texto = String(nomeCompleto || "").trim();
    return texto ? texto.split(" ")[0] : "";
  }

  function trocarVariaveis(texto, nomeMarca){
    return String(texto || "")
      .split("{{nome}}").join(primeiroNomeDe(nomeMarca))
      .split("{{marca}}").join(String(nomeMarca || ""));
  }

  function marcasComEmailValido(lista){
    return lista.filter(function(m){ return !!(m.email && m.email.trim()); });
  }

  function autoLinkify(textoEscapado){
    return textoEscapado.replace(/(https?:\/\/[^\s<]+)/g, function(url){
      return '<a href="' + url + '" style="color:#0049a4;">' + url + '</a>';
    });
  }

  // Troca \n por quebra de linha visual dentro de HTML sem precisar
  // reescrever o texto inteiro (usa white-space:pre-line no CSS).
  function montarHtmlModoTexto(){
    var corpoTexto = document.getElementById("prosCorpoTexto").value;
    var corpoEscapado = Core.escaparHtml(corpoTexto);
    var corpoComLinks = autoLinkify(corpoEscapado);
    var botaoTexto = document.getElementById("prosBotaoTexto").value.trim();
    var botaoLink = document.getElementById("prosBotaoLink").value.trim();
    var blocoBotao = "";
    if (botaoTexto && botaoLink){
      blocoBotao = '<div style="margin-top:24px;">' +
        '<a href="' + Core.escaparHtml(botaoLink) + '" style="display:inline-block;background:#0049a4;color:#ffffff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:bold;font-size:14px;">' +
        Core.escaparHtml(botaoTexto) + '</a></div>';
    }
    return '<div style="max-width:560px;margin:0 auto;padding:32px 24px;font-family:Arial,Helvetica,sans-serif;color:#14110d;background:#ffffff;">' +
      '<div style="white-space:pre-line;font-size:15px;line-height:1.6;">' + corpoComLinks + '</div>' +
      blocoBotao +
      '<p style="margin-top:36px;padding-top:16px;border-top:1px solid #e5e0d8;font-size:12px;color:#8a8478;">' +
      'Se não quiser mais receber e-mails como este, é só responder com a palavra SAIR.</p>' +
    '</div>';
  }

  // O HTML "de verdade" que vai ser mandado (ainda com {{nome}}/{{marca}}
  // dentro, porque quem troca pelo nome de cada marca é a função lá do
  // Supabase, uma vez pra cada destinatário).
  function pegarCorpoHtmlFinal(){
    if (modoEscrita === "html") return document.getElementById("prosCorpoHtml").value;
    return montarHtmlModoTexto();
  }

  function htmlTemFooterSair(html){
    return /sair/i.test(html);
  }

  /* ---------- Carregar os dados ---------- */

  async function carregarDados(){
    var resultadoMarcas = await Core.consultar(
      window.db.from("marcas").select("*").order("criado_em", { ascending: false }),
      "marcas"
    );
    marcasEmMemoria = resultadoMarcas.data || [];

    var resultadoHistorico = await Core.consultar(
      window.db.from("email_envios").select("*").order("criado_em", { ascending: false }),
      "email_envios"
    );
    historicoFalhouCarregar = !!resultadoHistorico.erro;
    historicoEmMemoria = resultadoHistorico.data;

    var resultadoOptout = await Core.consultar(
      window.db.from("email_optout").select("*").order("criado_em", { ascending: false }),
      "email_optout"
    );
    optoutFalhouCarregar = !!resultadoOptout.erro;
    optoutsEmMemoria = resultadoOptout.data;

    renderizarTudo();
  }

  async function carregar(){
    if (!jaConfigurouListeners){
      configurarEventos();
      jaConfigurouListeners = true;
    }
    await carregarDados();
  }

  /* ---------- Tela vazia (sem nenhum e-mail cadastrado ainda) ---------- */

  function temAlgumaMarcaComEmail(){
    return marcasComEmailValido(marcasEmMemoria).length > 0;
  }

  function renderizarTudo(){
    var semEmail = document.getElementById("prosSemEmail");
    var conteudo = document.getElementById("prosConteudo");

    if (!temAlgumaMarcaComEmail()){
      semEmail.style.display = "";
      conteudo.style.display = "none";
      return;
    }
    semEmail.style.display = "none";
    conteudo.style.display = "";

    renderizarCapa();
    renderizarMetricas();
    popularSelectDestinatarios();
    atualizarContagem();
    atualizarPreview();
    renderizarHistorico();
    atualizarVisibilidadeAvisoModo();
  }

  /* ---------- Bloco 1: capa ---------- */

  function renderizarCapa(){
    var el = document.getElementById("prosCapaTotalEnviados");
    if (historicoFalhouCarregar || historicoEmMemoria === null){
      el.textContent = "-";
      return;
    }
    var total = historicoEmMemoria.filter(function(h){ return h.status === "ok"; }).length;
    el.textContent = total ? String(total) : "-";
  }

  /* ---------- Bloco 2: cartões de números ---------- */

  function renderizarMetricas(){
    var comEmail = marcasComEmailValido(marcasEmMemoria);
    var aEnviar = comEmail.filter(function(m){ return !m.ultimo_envio_email; }).length;

    var jaReceberam = "-";
    var falhas = "-";
    if (!historicoFalhouCarregar && historicoEmMemoria !== null){
      jaReceberam = historicoEmMemoria.filter(function(h){ return h.status === "ok"; }).length;
      falhas = historicoEmMemoria.filter(function(h){ return h.status === "erro"; }).length;
    }

    var descadastrados = "-";
    if (!optoutFalhouCarregar && optoutsEmMemoria !== null){
      descadastrados = optoutsEmMemoria.length;
    }

    var cartoes = [
      { valor: comEmail.length, nome: "Marcas com e-mail", cor: "blue" },
      { valor: aEnviar, nome: "A enviar", cor: "yellow" },
      { valor: jaReceberam, nome: "Já receberam", cor: "green" },
      { valor: falhas, nome: "Falhas", cor: "red" },
      { valor: descadastrados, nome: "Descadastrados", cor: "blue2" }
    ];

    document.getElementById("prosMetricas").innerHTML = cartoes.map(function(c){
      return '<div class="metrica-cartao metrica-cartao-' + c.cor + '">' +
        '<p class="metrica-cartao-valor">' + c.valor + '</p>' +
        '<p class="metrica-cartao-nome">' + c.nome + '</p>' +
      '</div>';
    }).join("");
  }

  /* ---------- Escolher pra quem vai ---------- */

  function situacoesPresentesNaBase(){
    var vistas = {};
    marcasEmMemoria.forEach(function(m){ if (m.situacao) vistas[m.situacao] = true; });
    return Object.keys(vistas);
  }

  function popularSelectDestinatarios(){
    var select = document.getElementById("prosDestinatarios");
    var valorAtual = select.value;

    var opcoes = [
      { valor: "selecionadas", rotulo: "Só as marcas selecionadas" },
      { valor: "teste", rotulo: "Só pra mim (teste)" },
      { valor: "todas", rotulo: "Todas as marcas com e-mail" }
    ];
    situacoesPresentesNaBase().forEach(function(situacao){
      opcoes.push({ valor: situacao, rotulo: "Só " + (rotuloSituacao[situacao] || situacao).toLowerCase() });
    });

    select.innerHTML = opcoes.map(function(o){
      return '<option value="' + o.valor + '">' + Core.escaparHtml(o.rotulo) + '</option>';
    }).join("");

    if (opcoes.some(function(o){ return o.valor === valorAtual; })){
      select.value = valorAtual;
    }
  }

  function rotuloListaAtual(){
    var select = document.getElementById("prosDestinatarios");
    var opcaoSelecionada = select.options[select.selectedIndex];
    return opcaoSelecionada ? opcaoSelecionada.textContent : "";
  }

  function pegarListaBase(){
    var valor = document.getElementById("prosDestinatarios").value;
    if (valor === "selecionadas"){
      return marcasComEmailValido(marcasEmMemoria.filter(function(m){ return m.selecionada; }));
    }
    if (valor === "teste"){
      return [{ id: null, marca: "Você (teste)", email: EMAIL_ADMIN }];
    }
    if (valor === "todas"){
      return marcasComEmailValido(marcasEmMemoria);
    }
    return marcasComEmailValido(marcasEmMemoria.filter(function(m){ return m.situacao === valor; }));
  }

  function pegarDestinatariosAtuais(){
    var base = pegarListaBase();
    var assunto = document.getElementById("prosAssunto").value.trim();
    var pularEnviados = document.getElementById("prosPularEnviados").checked;

    var emailsOptout = {};
    (optoutsEmMemoria || []).forEach(function(o){ emailsOptout[String(o.email).toLowerCase()] = true; });

    var emailsJaReceberamEsseAssunto = {};
    if (pularEnviados && assunto && historicoEmMemoria){
      historicoEmMemoria.forEach(function(h){
        if (h.status === "ok" && h.assunto === assunto){
          emailsJaReceberamEsseAssunto[String(h.email).toLowerCase()] = true;
        }
      });
    }

    var vistos = {};
    var final = [];
    base.forEach(function(m){
      var emailLimpo = String(m.email).trim().toLowerCase();
      if (vistos[emailLimpo]) return;
      if (emailsOptout[emailLimpo]) return;
      if (emailsJaReceberamEsseAssunto[emailLimpo]) return;
      vistos[emailLimpo] = true;
      final.push({ id: m.id, marca: m.marca, email: m.email.trim() });
    });
    return final;
  }

  function atualizarContagem(){
    var valor = document.getElementById("prosDestinatarios").value;
    var contagemEl = document.getElementById("prosContagemTexto");
    var finalList = pegarDestinatariosAtuais();

    if (valor === "selecionadas" && !finalList.length){
      contagemEl.innerHTML = 'Nenhuma marca selecionada ainda. <a href="#" id="prosLinkIrMarcas" style="font-weight:700;">Ir para a aba Marcas</a>';
      var link = document.getElementById("prosLinkIrMarcas");
      if (link){
        link.addEventListener("click", function(e){
          e.preventDefault();
          irParaAbaMarcas();
        });
      }
    } else {
      var totalCategoria = 0;
      var comEmailCategoria = 0;
      if (valor === "teste"){
        totalCategoria = 1; comEmailCategoria = 1;
      } else if (valor === "selecionadas"){
        var selecionadas = marcasEmMemoria.filter(function(m){ return m.selecionada; });
        totalCategoria = selecionadas.length;
        comEmailCategoria = marcasComEmailValido(selecionadas).length;
      } else if (valor === "todas"){
        totalCategoria = marcasEmMemoria.length;
        comEmailCategoria = marcasComEmailValido(marcasEmMemoria).length;
      } else {
        var doSituacao = marcasEmMemoria.filter(function(m){ return m.situacao === valor; });
        totalCategoria = doSituacao.length;
        comEmailCategoria = marcasComEmailValido(doSituacao).length;
      }
      var semEmail = totalCategoria - comEmailCategoria;

      contagemEl.textContent = finalList.length + " marca" + (finalList.length === 1 ? "" : "s") + " nessa seleção" +
        (semEmail > 0 ? (". " + semEmail + " ficaram de fora por não ter e-mail.") : ".");
    }

    document.getElementById("prosBtnDisparar").disabled = !finalList.length;
  }

  function irParaAbaMarcas(){
    var itemNav = document.querySelector('.admin-nav-item[data-aba="marcas"]');
    if (itemNav) itemNav.click();
  }

  /* ---------- Prévia do e-mail ---------- */

  function montarPreviewHtmlInterno(){
    var assuntoBruto = document.getElementById("prosAssunto").value.trim() || "(sem assunto)";
    var assunto = trocarVariaveis(assuntoBruto, MARCA_EXEMPLO_PREVIEW);
    var corpo = trocarVariaveis(pegarCorpoHtmlFinal(), MARCA_EXEMPLO_PREVIEW);
    return '<div class="prospeccao-preview-cabecalho">' +
        '<div class="prospeccao-preview-avatar">K</div>' +
        '<div>' +
          '<p class="prospeccao-preview-assunto">' + Core.escaparHtml(assunto) + '</p>' +
          '<p class="prospeccao-preview-remetente">Karen Martins &lt;' + EMAIL_CONTATO + '&gt; para você</p>' +
        '</div>' +
      '</div>' +
      '<div class="prospeccao-preview-corpo">' + corpo + '</div>';
  }

  function atualizarPreview(){
    var html = montarPreviewHtmlInterno();
    document.getElementById("prosPreviewJanela").innerHTML = html;
  }

  function abrirPreviewTelaCheia(){
    document.getElementById("prosPreviewTelaCheiaJanela").innerHTML =
      '<div class="prospeccao-preview-janela">' + montarPreviewHtmlInterno() + '</div>';
    Core.abrirModal("prosModalTelaCheia");
  }

  /* ---------- Modo de escrita (texto fácil / HTML) ---------- */

  function trocarModoEscrita(novoModo){
    modoEscrita = novoModo;
    document.querySelectorAll('#prosToggleModoEscrita .prospeccao-toggle-btn').forEach(function(botao){
      botao.classList.toggle("ativo", botao.getAttribute("data-modo-escrita") === novoModo);
    });
    document.getElementById("prosModoTexto").style.display = novoModo === "texto" ? "" : "none";
    document.getElementById("prosModoHtml").style.display = novoModo === "html" ? "" : "none";
    atualizarPreview();
  }

  function trocarModoEnvio(novoModo){
    modoEnvio = novoModo;
    document.querySelectorAll('#prosToggleModoEnvio .prospeccao-toggle-btn').forEach(function(botao){
      botao.classList.toggle("ativo", botao.getAttribute("data-modo-envio") === novoModo);
    });
    document.getElementById("prosFilaRascunho").style.display = "none";
    atualizarVisibilidadeAvisoModo();
  }

  function atualizarVisibilidadeAvisoModo(){
    var aviso = document.getElementById("prosAvisoModo");
    if (modoEnvio === "rascunho"){
      aviso.textContent = "Nesse modo, o Disparar monta uma fila de rascunhos pra você mandar um a um pelo Gmail, sem precisar do Resend configurado.";
    } else {
      aviso.textContent = "Nesse modo, o Disparar manda de verdade pela função do Supabase (Resend). Teste antes de disparar pra várias marcas.";
    }
  }

  /* ---------- Enviar teste pra mim ---------- */

  async function enviarTeste(){
    var assunto = document.getElementById("prosAssunto").value.trim();
    if (!assunto){ window.alert("Escreva um assunto antes de mandar o teste."); return; }

    var corpoHtml = pegarCorpoHtmlFinal();
    if (modoEscrita === "html" && !htmlTemFooterSair(corpoHtml)){
      if (!window.confirm('O rodapé de descadastro ("responda SAIR") não foi encontrado no HTML. Quer mandar o teste mesmo assim?')) return;
    }

    var botao = document.getElementById("prosBtnTeste");
    var textoOriginal = botao.textContent;
    botao.disabled = true;
    botao.textContent = "Enviando...";

    var resultado = await window.db.functions.invoke("enviar-emails", {
      body: {
        destinatarios: [{ email: EMAIL_ADMIN, marca: "Você (teste)", marcaId: null }],
        assunto: assunto,
        corpoHtml: corpoHtml
      }
    });

    botao.disabled = false;
    botao.textContent = textoOriginal;

    if (resultado.error || !resultado.data || resultado.data.falharam){
      window.alert("Não deu pra mandar o teste. Confira se a função enviar-emails já foi publicada no Supabase e se a chave do Resend (RESEND_API_KEY) está configurada nos segredos dela.");
      return;
    }
    window.alert("Teste enviado! Confira sua caixa de entrada (e a pasta de spam, às vezes o primeiro e-mail cai lá).");
  }

  /* ---------- Disparo de verdade (Resend) ---------- */

  function dispararEnvio(){
    var valor = document.getElementById("prosDestinatarios").value;
    var lista = pegarDestinatariosAtuais();

    if (valor === "selecionadas" && !lista.length){
      window.alert("Você não tem nenhuma marca selecionada. Vou te levar pra aba Marcas pra você escolher.");
      irParaAbaMarcas();
      return;
    }
    if (!lista.length){ window.alert("Não há destinatários pra essa lista."); return; }

    var assunto = document.getElementById("prosAssunto").value.trim();
    if (!assunto){ window.alert("Escreva um assunto antes de disparar."); return; }

    var corpoHtml = pegarCorpoHtmlFinal();
    if (modoEscrita === "html" && !htmlTemFooterSair(corpoHtml)){
      if (!window.confirm('O rodapé de descadastro ("responda SAIR") não foi encontrado no HTML. Quer disparar mesmo assim?')) return;
    }

    if (modoEnvio === "rascunho"){
      construirFilaRascunho(lista, assunto, corpoHtml);
      return;
    }

    document.getElementById("prosModalConfirmarTexto").textContent =
      "Vai mandar para " + lista.length + " marca" + (lista.length === 1 ? "" : "s") +
      ", da lista \"" + rotuloListaAtual() + "\". Isso não pode ser desfeito.";
    Core.abrirModal("prosModalConfirmar");
  }

  async function executarDisparoResend(){
    Core.fecharModal("prosModalConfirmar");

    var valorFiltro = document.getElementById("prosDestinatarios").value;
    var lista = pegarDestinatariosAtuais();
    var assunto = document.getElementById("prosAssunto").value.trim();
    var corpoHtml = pegarCorpoHtmlFinal();

    var progressoCartao = document.getElementById("prosProgressoCartao");
    var progressoTexto = document.getElementById("prosProgressoTexto");
    var progressoBarra = document.getElementById("prosProgressoBarra");
    var resultadoCaixa = document.getElementById("prosResultado");
    var botaoDisparar = document.getElementById("prosBtnDisparar");

    progressoCartao.style.display = "";
    resultadoCaixa.style.display = "none";
    botaoDisparar.disabled = true;

    var TAMANHO_LOTE = 100;
    var totalEnviados = 0, totalFalharam = 0, totalPulados = 0, cotaEsgotada = false, erroDeRede = false;

    for (var i = 0; i < lista.length; i += TAMANHO_LOTE){
      if (cotaEsgotada) break;
      var lote = lista.slice(i, i + TAMANHO_LOTE);
      var processados = Math.min(i + TAMANHO_LOTE, lista.length);
      progressoTexto.textContent = "Enviando " + processados + "/" + lista.length + "...";
      progressoBarra.style.width = Math.round((processados / lista.length) * 100) + "%";

      var resultado = await window.db.functions.invoke("enviar-emails", {
        body: {
          destinatarios: lote.map(function(d){ return { email: d.email, marca: d.marca, marcaId: d.id }; }),
          assunto: assunto,
          corpoHtml: corpoHtml
        }
      });

      if (resultado.error || !resultado.data){
        erroDeRede = true;
        break;
      }
      totalEnviados += resultado.data.enviados || 0;
      totalFalharam += resultado.data.falharam || 0;
      totalPulados += resultado.data.pulados || 0;
      if (resultado.data.cotaEsgotada) cotaEsgotada = true;
    }

    progressoCartao.style.display = "none";
    botaoDisparar.disabled = false;

    var partes = [];
    if (erroDeRede){
      partes.push('<div class="faixa faixa-erro">Não consegui falar com a função de e-mail. Confira se ela já foi publicada no Supabase.</div>');
    } else {
      partes.push('<div class="faixa faixa-ok">' + totalEnviados + ' enviados, ' + totalFalharam + ' falhas, ' + totalPulados + ' pulados.</div>');
      if (cotaEsgotada){
        partes.push('<div class="faixa faixa-aviso" style="margin-top:8px;">A cota diária do Resend acabou no meio do disparo. Volte amanhã, cole o mesmo assunto e o mesmo texto, deixe marcada a caixinha de pular quem já recebeu, e dispare de novo: só vai pros que ainda faltam.</div>');
      }
    }
    resultadoCaixa.innerHTML = partes.join("");
    resultadoCaixa.style.display = "";

    await carregarDados();

    if (!erroDeRede && totalEnviados > 0 && valorFiltro === "selecionadas"){
      if (window.confirm("Quer limpar a seleção de marcas agora? (às vezes você manda a mesma lista mais de uma vez, então isso é opcional)")){
        var idsSelecionados = marcasEmMemoria.filter(function(m){ return m.selecionada; }).map(function(m){ return m.id; });
        if (idsSelecionados.length){
          await Core.consultar(window.db.from("marcas").update({ selecionada: false }).in("id", idsSelecionados), "marcas");
          await carregarDados();
        }
      }
    }
  }

  /* ---------- Modo rascunho (funciona sem Resend) ---------- */

  function htmlParaTextoSimples(html){
    var textoComQuebras = String(html || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|tr|h1|h2|h3)>/gi, "\n\n")
      .replace(/<[^>]+>/g, "");
    var areaAuxiliar = document.createElement("textarea");
    areaAuxiliar.innerHTML = textoComQuebras;
    return areaAuxiliar.value.replace(/\n{3,}/g, "\n\n").trim();
  }

  function construirFilaRascunho(lista, assunto, corpoHtml){
    filaRascunho = lista.map(function(d){
      return {
        id: d.id,
        email: d.email,
        marca: d.marca,
        assunto: trocarVariaveis(assunto, d.marca),
        corpoTexto: htmlParaTextoSimples(trocarVariaveis(corpoHtml, d.marca))
      };
    });
    document.getElementById("prosFilaRascunho").style.display = "";
    renderizarFilaRascunho();
    document.getElementById("prosFilaRascunho").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderizarFilaRascunho(){
    var caixa = document.getElementById("prosFilaLista");
    if (!filaRascunho.length){
      caixa.innerHTML = '<p class="estado-vazio">Fila vazia. Escolha a lista de destinatários e clique em "Disparar" de novo pra gerar os rascunhos.</p>';
      return;
    }
    caixa.innerHTML = filaRascunho.map(function(item, indice){
      var linkGmail = "https://mail.google.com/mail/?view=cm&fs=1&to=" + encodeURIComponent(item.email) +
        "&su=" + encodeURIComponent(item.assunto) + "&body=" + encodeURIComponent(item.corpoTexto);
      return '<div class="prospeccao-fila-item">' +
          '<div class="prospeccao-fila-item-info">' +
            '<p class="prospeccao-fila-item-marca">' + Core.escaparHtml(item.marca) + '</p>' +
            '<p class="prospeccao-fila-item-email">' + Core.escaparHtml(item.email) + '</p>' +
          '</div>' +
          '<div class="prospeccao-fila-item-acoes">' +
            '<button type="button" class="btn btn-ghost btn-sm" data-copiar="' + indice + '">Copiar texto</button>' +
            '<a class="btn btn-ghost btn-sm" href="' + linkGmail + '" target="_blank" rel="noopener">Abrir no Gmail</a>' +
            '<button type="button" class="btn btn-primary btn-sm" data-marcar-enviada="' + indice + '">Marcar como enviada</button>' +
          '</div>' +
        '</div>';
    }).join("");

    caixa.querySelectorAll("[data-copiar]").forEach(function(botao){
      botao.addEventListener("click", async function(){
        var item = filaRascunho[Number(botao.getAttribute("data-copiar"))];
        try{
          await navigator.clipboard.writeText(item.corpoTexto);
          var textoOriginal = botao.textContent;
          botao.textContent = "Copiado!";
          window.setTimeout(function(){ botao.textContent = textoOriginal; }, 1500);
        } catch(erroCopia){
          window.alert("Não deu pra copiar automaticamente. Selecione o texto na mão.");
        }
      });
    });
    caixa.querySelectorAll("[data-marcar-enviada]").forEach(function(botao){
      botao.addEventListener("click", async function(){
        var indice = Number(botao.getAttribute("data-marcar-enviada"));
        var item = filaRascunho[indice];
        var hoje = new Date().toISOString().slice(0, 10);
        if (item.id){
          await Core.consultar(window.db.from("marcas").update({ ultimo_envio_email: hoje }).eq("id", item.id), "marcas");
        }
        await Core.consultar(window.db.from("email_envios").insert({
          email: item.email, marca_id: item.id, assunto: item.assunto, status: "ok", erro: null, resend_id: null
        }), "email_envios");
        filaRascunho.splice(indice, 1);
        renderizarFilaRascunho();
        await carregarDados();
      });
    });
  }

  /* ---------- Histórico ---------- */

  function renderizarHistorico(){
    var corpo = document.getElementById("prosHistoricoCorpo");
    if (historicoFalhouCarregar || historicoEmMemoria === null){
      corpo.innerHTML = '<tr><td colspan="4" class="estado-vazio">O histórico ainda não está disponível. Rode o arquivo disparo.sql no Supabase.</td></tr>';
      return;
    }
    var termo = document.getElementById("prosHistoricoBusca").value.trim().toLowerCase();
    var lista = historicoEmMemoria.filter(function(h){
      if (!termo) return true;
      return String(h.email || "").toLowerCase().indexOf(termo) !== -1;
    });
    if (!lista.length){
      corpo.innerHTML = '<tr><td colspan="4" class="estado-vazio">' +
        (historicoEmMemoria.length ? "Nada encontrado com essa busca." : "Nenhum envio ainda.") + '</td></tr>';
      return;
    }
    corpo.innerHTML = lista.map(function(h){
      var statusTexto = h.status === "ok" ? "Enviado" : ("Erro" + (h.erro ? (": " + h.erro) : ""));
      return '<tr>' +
        '<td>' + Core.escaparHtml(h.email) + '</td>' +
        '<td>' + Core.escaparHtml(h.assunto) + '</td>' +
        '<td>' + Core.formatarDataBR(h.criado_em) + '</td>' +
        '<td><span class="pilula ' + (h.status === "ok" ? "pilula-email-ok" : "pilula-email-erro") + '" title="' + Core.escaparHtml(statusTexto) + '">' +
          Core.escaparHtml(h.status === "ok" ? "Enviado" : "Erro") + '</span></td>' +
      '</tr>';
    }).join("");
  }

  /* ---------- Descadastro manual ---------- */

  async function adicionarOptoutManual(){
    var campo = document.getElementById("prosOptoutEmail");
    var msg = document.getElementById("prosOptoutMsg");
    var email = campo.value.trim().toLowerCase();
    msg.textContent = "";
    if (!email || email.indexOf("@") === -1){
      msg.textContent = "Digite um e-mail válido.";
      return;
    }
    var resultado = await Core.consultar(window.db.from("email_optout").upsert({ email: email }), "email_optout");
    if (resultado.erro){
      msg.textContent = "Não deu pra adicionar. Veja o aviso no topo da página.";
      return;
    }
    campo.value = "";
    await carregarDados();
  }

  /* ---------- Começar do modelo pronto (modo HTML) ---------- */

  function comecarDoModeloPronto(){
    var htmlAtual = document.getElementById("prosCorpoHtml").value.trim();
    if (htmlAtual && !window.confirm("Isso vai substituir o HTML que já está escrito ali. Quer continuar?")) return;
    document.getElementById("prosCorpoHtml").value = montarHtmlModoTexto();
    atualizarPreview();
  }

  /* ---------- Amarrando os eventos ---------- */

  function configurarEventos(){
    document.getElementById("prosBtnIrParaMarcas").addEventListener("click", irParaAbaMarcas);

    document.getElementById("prosDestinatarios").addEventListener("change", atualizarContagem);
    document.getElementById("prosPularEnviados").addEventListener("change", atualizarContagem);
    document.getElementById("prosAssunto").addEventListener("input", function(){ atualizarContagem(); atualizarPreview(); });
    document.getElementById("prosCorpoTexto").addEventListener("input", atualizarPreview);
    document.getElementById("prosCorpoHtml").addEventListener("input", atualizarPreview);
    document.getElementById("prosBotaoTexto").addEventListener("input", atualizarPreview);
    document.getElementById("prosBotaoLink").addEventListener("input", atualizarPreview);

    document.querySelectorAll('#prosToggleModoEscrita .prospeccao-toggle-btn').forEach(function(botao){
      botao.addEventListener("click", function(){ trocarModoEscrita(botao.getAttribute("data-modo-escrita")); });
    });
    document.querySelectorAll('#prosToggleModoEnvio .prospeccao-toggle-btn').forEach(function(botao){
      botao.addEventListener("click", function(){ trocarModoEnvio(botao.getAttribute("data-modo-envio")); });
    });

    document.getElementById("prosBtnComecarModelo").addEventListener("click", comecarDoModeloPronto);
    document.getElementById("prosBtnTelaCheia").addEventListener("click", abrirPreviewTelaCheia);
    document.getElementById("prosBtnTeste").addEventListener("click", enviarTeste);
    document.getElementById("prosBtnDisparar").addEventListener("click", dispararEnvio);
    document.getElementById("prosBtnConfirmarDisparo").addEventListener("click", executarDisparoResend);

    document.getElementById("prosHistoricoBusca").addEventListener("input", renderizarHistorico);
    document.getElementById("prosBtnOptoutAdd").addEventListener("click", adicionarOptoutManual);
  }

  return { carregar: carregar };
})();
