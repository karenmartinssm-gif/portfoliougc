/* ============================================================
   Aba Checklist: usa o conteúdo pronto de js/biblioteca.js
   (window.Biblioteca) e guarda o que você já marcou na tabela
   "marcados" do banco.
   ============================================================ */

window.AdminChecklist = (function(){
  "use strict";

  var Core = window.AdminCore;
  var chavesMarcadas = {};
  var carregouUmaVez = false;

  async function carregar(){
    if (!window.Biblioteca){
      document.getElementById("listaSecoesChecklist").innerHTML =
        '<p class="faixa faixa-aviso">O arquivo js/biblioteca.js não foi encontrado. Confira se ele está salvo na pasta js do projeto.</p>';
      return;
    }

    var resultado = await Core.consultar(window.db.from("marcados").select("chave"), "marcados (checklist)");
    chavesMarcadas = {};
    (resultado.data || []).forEach(function(linha){ chavesMarcadas[linha.chave] = true; });

    renderizarChecklist();
    if (!carregouUmaVez){
      renderizarReferencias();
      renderizarTipos();
      renderizarNichos();
      renderizarRevisao();
      configurarSubAbas();
      carregouUmaVez = true;
    }
  }

  /* ---------- Sub-aba 1: Checklist ---------- */

  function chaveItem(secaoId, indice){ return "checklist_" + secaoId + "_" + indice; }

  function renderizarChecklist(){
    var secoes = window.Biblioteca.CHECKLIST || [];
    var totalItens = 0, totalMarcados = 0;

    var html = secoes.map(function(secao){
      var itens = secao.itens || [];
      var marcadosNaSecao = 0;
      var itensHtml = itens.map(function(item, indice){
        var chave = chaveItem(secao.id, indice);
        var marcado = !!chavesMarcadas[chave];
        if (marcado) marcadosNaSecao++;
        return '<label class="item-checklist' + (marcado ? " marcado" : "") + '">' +
          '<input type="checkbox" data-chave="' + chave + '" ' + (marcado ? "checked" : "") + '>' +
          '<span>' +
            '<span class="item-checklist-texto">' + Core.escaparHtml(item.t) + '</span>' +
            '<span class="item-checklist-desc">' + Core.escaparHtml(item.d) + '</span>' +
          '</span>' +
        '</label>';
      }).join("");

      totalItens += itens.length;
      totalMarcados += marcadosNaSecao;
      var percentualSecao = itens.length ? Math.round((marcadosNaSecao / itens.length) * 100) : 0;

      return '<div class="secao-checklist" data-secao="' + secao.id + '">' +
        '<div class="secao-checklist-cabecalho">' +
          '<span class="secao-checklist-emoji">' + secao.emoji + '</span>' +
          '<div class="secao-checklist-titulos">' +
            '<p class="secao-checklist-nome">' + Core.escaparHtml(secao.nome) + '</p>' +
            '<p class="secao-checklist-resumo">' + Core.escaparHtml(secao.resumo) + '</p>' +
          '</div>' +
          '<div class="secao-checklist-barra">' +
            '<div class="barra-progresso" style="height:6px;"><div class="barra-progresso-preenche" style="width:' + percentualSecao + '%;"></div></div>' +
            '<p style="font-size:.68rem; text-align:right; margin-top:3px; color:var(--ink-faint);">' + marcadosNaSecao + '/' + itens.length + '</p>' +
          '</div>' +
          '<svg class="icon secao-checklist-seta" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>' +
        '</div>' +
        '<div class="secao-checklist-corpo">' +
          '<p class="secao-checklist-porque"><strong>Por que isso importa:</strong> ' + Core.escaparHtml(secao.porque) + '</p>' +
          itensHtml +
        '</div>' +
      '</div>';
    }).join("");

    document.getElementById("listaSecoesChecklist").innerHTML = html;

    var percentualGeral = totalItens ? Math.round((totalMarcados / totalItens) * 100) : 0;
    document.getElementById("progressoGeralTexto").textContent = percentualGeral + "% do checklist pronto";
    document.getElementById("progressoGeralBarra").style.width = percentualGeral + "%";

    document.querySelectorAll(".secao-checklist-cabecalho").forEach(function(cabecalho){
      cabecalho.addEventListener("click", function(e){
        if (e.target.tagName === "INPUT") return;
        cabecalho.parentElement.classList.toggle("aberta");
      });
    });
    document.querySelectorAll(".item-checklist input[type=checkbox]").forEach(function(caixa){
      caixa.addEventListener("click", function(e){ e.stopPropagation(); });
      caixa.addEventListener("change", function(){ alternarItem(caixa.getAttribute("data-chave"), caixa.checked); });
    });
  }

  async function alternarItem(chave, marcado){
    if (marcado){
      chavesMarcadas[chave] = true;
      await Core.consultar(window.db.from("marcados").upsert({ chave: chave }), "marcados (checklist)");
    } else {
      delete chavesMarcadas[chave];
      await Core.consultar(window.db.from("marcados").delete().eq("chave", chave), "marcados (checklist)");
    }
    renderizarChecklist();
  }

  /* ---------- Sub-aba 2: Referências de vídeo ---------- */

  function renderizarReferencias(){
    var referencias = window.Biblioteca.REFERENCIAS || [];
    var caixa = document.getElementById("grade-referencias");
    caixa.innerHTML = referencias.map(function(ref){
      return '<div class="ref-cartao" data-ref="' + ref.id + '">' +
        '<div class="ref-capa">' + ref.emoji + '</div>' +
        '<div class="ref-info">' +
          '<p class="ref-titulo">' + Core.escaparHtml(ref.titulo) + '</p>' +
          '<div class="ref-meta"><span>' + Core.escaparHtml(ref.estilo) + '</span><span>' + Core.escaparHtml(ref.duracao) + '</span><span>' + Core.escaparHtml(ref.marca) + '</span></div>' +
        '</div>' +
      '</div>';
    }).join("");

    caixa.querySelectorAll("[data-ref]").forEach(function(cartao){
      cartao.addEventListener("click", function(){ abrirFichaReferencia(cartao.getAttribute("data-ref")); });
    });
  }

  function abrirFichaReferencia(id){
    var ref = (window.Biblioteca.REFERENCIAS || []).find(function(r){ return r.id === id; });
    if (!ref) return;
    document.getElementById("tituloFichaReferencia").textContent = ref.emoji + " " + ref.titulo;
    document.getElementById("corpoFichaReferencia").innerHTML =
      '<div class="ficha-bloco"><h4>Gancho</h4><p>' + ref.gancho + '</p></div>' +
      '<div class="ficha-bloco"><h4>Por que funciona</h4><p>' + Core.escaparHtml(ref.porque) + '</p></div>' +
      '<div class="ficha-bloco"><h4>Diferencial</h4><p>' + Core.escaparHtml(ref.diferencial) + '</p></div>' +
      '<div class="ficha-bloco"><h4>Erro comum</h4><p>' + Core.escaparHtml(ref.erro) + '</p></div>' +
      '<div class="ficha-bloco"><h4>Roteiro em blocos</h4>' +
        (ref.roteiro || []).map(function(bloco){
          return '<div class="roteiro-linha"><span class="roteiro-tempo">' + Core.escaparHtml(bloco.t) + '</span><span class="roteiro-texto">' + bloco.o + '</span></div>';
        }).join("") +
      '</div>' +
      (ref.youtube ? '<a class="btn btn-primary" href="' + ref.youtube + '" target="_blank" rel="noopener">Assistir o vídeo</a>' : '');
    Core.abrirModal("modalFichaReferencia");
  }

  /* ---------- Sub-aba 3: Roteiros (TIPOS) ---------- */

  function renderizarTipos(){
    var tipos = window.Biblioteca.TIPOS || [];
    var caixa = document.getElementById("grade-tipos");
    caixa.innerHTML = tipos.map(function(tipo, indice){
      return '<div class="tipo-cartao">' +
        '<div class="tipo-cartao-topo" data-tipo-toggle="' + indice + '" style="cursor:pointer;">' +
          '<span class="tipo-cartao-emoji">' + tipo.emoji + '</span>' +
          '<div><p class="tipo-cartao-nome">' + Core.escaparHtml(tipo.nome) + '</p><p class="tipo-cartao-duracao">' + Core.escaparHtml(tipo.duracao) + '</p></div>' +
        '</div>' +
        '<div class="tipo-cartao-corpo" id="tipo-corpo-' + indice + '" style="display:none; margin-top:12px;">' +
          '<p style="font-size:.8rem;">' + Core.escaparHtml(tipo.porque) + '</p>' +
          (tipo.beats || []).map(function(bloco){
            return '<div class="roteiro-linha"><span class="roteiro-tempo">' + Core.escaparHtml(bloco.t) + '</span><span class="roteiro-texto">' + bloco.o + '</span></div>';
          }).join("") +
          (tipo.erros && tipo.erros.length ? '<ul class="tipo-erros">' + tipo.erros.map(function(e){ return "<li>" + Core.escaparHtml(e) + "</li>"; }).join("") + '</ul>' : "") +
        '</div>' +
      '</div>';
    }).join("");

    caixa.querySelectorAll("[data-tipo-toggle]").forEach(function(topo){
      topo.addEventListener("click", function(){
        var corpo = document.getElementById("tipo-corpo-" + topo.getAttribute("data-tipo-toggle"));
        corpo.style.display = corpo.style.display === "none" ? "" : "none";
      });
    });
  }

  /* ---------- Sub-aba 4: Ideias por nicho ---------- */

  function renderizarNichos(){
    var nichos = window.Biblioteca.NICHOS || [];
    var caixa = document.getElementById("grade-nichos");
    caixa.innerHTML = nichos.map(function(nicho){
      return '<div class="nicho-cartao">' +
        '<div class="nicho-cartao-topo"><span class="nicho-cartao-emoji">' + nicho.emoji + '</span><span class="nicho-cartao-nome">' + Core.escaparHtml(nicho.nome) + '</span></div>' +
        (nicho.ideias || []).map(function(ideia){
          return '<div class="nicho-ideia"><p class="nicho-ideia-t">' + Core.escaparHtml(ideia.t) + '</p><p class="nicho-ideia-gancho">' + Core.escaparHtml(ideia.gancho) + '</p></div>';
        }).join("") +
      '</div>';
    }).join("");
  }

  /* ---------- Sub-aba 5: Revisar meu roteiro ---------- */

  function renderizarRevisao(){
    var blocos = window.Biblioteca.REVISAO || [];
    var caixa = document.getElementById("revisar-blocos");
    caixa.innerHTML = blocos.map(function(bloco){
      return '<div class="revisar-bloco">' +
        '<p class="revisar-bloco-titulo">' + bloco.emoji + " " + Core.escaparHtml(bloco.bloco) + '</p>' +
        (bloco.itens || []).map(function(item){
          return '<label class="item-checklist"><input type="checkbox"><span><span class="item-checklist-texto">' + Core.escaparHtml(item.t) + '</span><span class="item-checklist-desc">' + Core.escaparHtml(item.d) + '</span></span></label>';
        }).join("") +
      '</div>';
    }).join("");

    caixa.querySelectorAll(".item-checklist input[type=checkbox]").forEach(function(caixaMarcar){
      caixaMarcar.addEventListener("change", function(){
        caixaMarcar.closest(".item-checklist").classList.toggle("marcado", caixaMarcar.checked);
      });
    });
  }

  /* ---------- Troca de sub-abas ---------- */

  function configurarSubAbas(){
    document.querySelectorAll(".subtab-btn").forEach(function(botao){
      botao.addEventListener("click", function(){
        document.querySelectorAll(".subtab-btn").forEach(function(b){ b.classList.remove("ativa"); });
        botao.classList.add("ativa");
        document.querySelectorAll(".sub-conteudo").forEach(function(sub){ sub.style.display = "none"; });
        document.getElementById("sub-" + botao.getAttribute("data-subaba")).style.display = "";
      });
    });
  }

  return { carregar: carregar };
})();
