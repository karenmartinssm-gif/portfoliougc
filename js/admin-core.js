/* ============================================================
   Núcleo do painel: menu lateral, troca de aba, modais, sair,
   e as ferramentas que os outros arquivos (admin-portfolio.js,
   admin-marcas.js etc.) usam por baixo.

   Se um dia faltar uma tabela ou uma coluna no banco, este
   arquivo é quem mostra o aviso no topo do admin sem travar
   o resto da página. É por isso que toda consulta ao banco,
   em todos os arquivos, passa pela função "consultar" daqui.
   ============================================================ */

window.AdminCore = (function(){
  "use strict";

  var abaAtual = "portfolio";
  var abasJaCarregadas = {};
  var avisosMostrados = {};

  /* ---------- Ferramentas gerais ---------- */

  function escaparHtml(texto){
    return String(texto === null || texto === undefined ? "" : texto)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Toda leitura/escrita no banco passa por aqui. Se der erro de
  // "tabela não existe" ou "coluna não existe", mostra um aviso
  // simples no topo do admin (uma vez só por tabela) e devolve
  // uma lista vazia, pra a tela continuar funcionando.
  async function consultar(promessa, nomeAmigavel){
    try{
      var resultado = await promessa;
      if (resultado.error){
        tratarErroBanco(resultado.error, nomeAmigavel);
        return { data: null, erro: resultado.error };
      }
      return { data: resultado.data, erro: null };
    } catch(erroInesperado){
      tratarErroBanco(erroInesperado, nomeAmigavel);
      return { data: null, erro: erroInesperado };
    }
  }

  function tratarErroBanco(erro, nomeAmigavel){
    var mensagem = (erro && erro.message) ? erro.message : String(erro);
    var chave = nomeAmigavel + "|" + mensagem;
    if (avisosMostrados[chave]) return;
    avisosMostrados[chave] = true;

    var textoAmigavel = "Não consegui carregar \"" + nomeAmigavel + "\". ";
    if (/relation .* does not exist/i.test(mensagem) || /does not exist/i.test(mensagem) || /could not find the table/i.test(mensagem)){
      textoAmigavel += "Parece que essa tabela ainda não existe no banco. Confira se você rodou os arquivos SQL do projeto (banco.sql e disparo.sql) no Supabase.";
    } else if (/column .* does not exist/i.test(mensagem) || /could not find the .* column/i.test(mensagem)){
      textoAmigavel += "Parece que falta uma coluna no banco. Confira os arquivos banco.sql e disparo.sql.";
    } else if (/JWT|permission denied|RLS/i.test(mensagem)){
      textoAmigavel += "Parece um problema de permissão (RLS). Confira se o SQL de segurança foi executado.";
    } else {
      textoAmigavel += "Detalhe técnico: " + mensagem;
    }

    var caixa = document.getElementById("avisoEstrutura");
    if (!caixa) return;
    var linha = document.createElement("p");
    linha.className = "faixa faixa-aviso";
    linha.style.marginBottom = "10px";
    linha.textContent = textoAmigavel;
    caixa.appendChild(linha);
  }

  function formatarDataBR(dataIso){
    if (!dataIso) return "-";
    var partes = String(dataIso).slice(0, 10).split("-");
    if (partes.length !== 3) return dataIso;
    return partes[2] + "/" + partes[1] + "/" + partes[0];
  }

  function formatarDinheiro(valor){
    var n = Number(valor) || 0;
    return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function hojeIso(){
    var d = new Date();
    var mes = String(d.getMonth() + 1).padStart(2, "0");
    var dia = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + mes + "-" + dia;
  }

  function diasEntreHojeE(dataIso){
    var hoje = new Date(hojeIso() + "T00:00:00");
    var alvo = new Date(String(dataIso).slice(0, 10) + "T00:00:00");
    return Math.round((alvo - hoje) / 86400000);
  }

  // Gera um CSV com acento certo no Excel (BOM + UTF-8) e baixa.
  function baixarCSV(nomeArquivo, colunas, linhas){
    var separador = ";";
    function limpar(valor){
      var texto = String(valor === null || valor === undefined ? "" : valor).replace(/"/g, '""');
      return '"' + texto + '"';
    }
    var conteudo = colunas.map(limpar).join(separador) + "\r\n";
    linhas.forEach(function(linha){
      conteudo += linha.map(limpar).join(separador) + "\r\n";
    });
    var blob = new Blob(["﻿" + conteudo], { type: "text/csv;charset=utf-8;" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = nomeArquivo;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /* ---------- Modais ---------- */

  function abrirModal(id){
    var overlay = document.getElementById(id);
    if (!overlay) return;
    overlay.hidden = false;
    requestAnimationFrame(function(){ overlay.classList.add("aberto"); });
  }
  function fecharModal(id){
    var overlay = document.getElementById(id);
    if (!overlay) return;
    overlay.classList.remove("aberto");
  }
  function configurarFechamentoModais(){
    document.querySelectorAll("[data-fechar-modal]").forEach(function(botao){
      botao.addEventListener("click", function(){
        fecharModal(botao.getAttribute("data-fechar-modal"));
      });
    });
    document.querySelectorAll(".modal-overlay").forEach(function(overlay){
      overlay.addEventListener("click", function(e){
        if (e.target === overlay) overlay.classList.remove("aberto");
      });
    });
    document.addEventListener("keydown", function(e){
      if (e.key !== "Escape") return;
      document.querySelectorAll(".modal-overlay.aberto").forEach(function(overlay){
        overlay.classList.remove("aberto");
      });
    });
  }

  /* ---------- Menu lateral / navegação ---------- */

  function irParaAba(nomeAba){
    document.querySelectorAll(".admin-nav-item").forEach(function(item){
      item.classList.toggle("ativo", item.getAttribute("data-aba") === nomeAba);
    });
    document.querySelectorAll(".aba-conteudo").forEach(function(secao){
      secao.style.display = (secao.id === "aba-" + nomeAba) ? "" : "none";
    });
    abaAtual = nomeAba;
    fecharGavetaMobile();

    if (!abasJaCarregadas[nomeAba]){
      abasJaCarregadas[nomeAba] = true;
      carregarAba(nomeAba);
    }
  }

  function carregarAba(nomeAba){
    if (nomeAba === "portfolio" && window.AdminPortfolio) window.AdminPortfolio.carregar();
    if (nomeAba === "marcas" && window.AdminMarcas) window.AdminMarcas.carregar();
    if (nomeAba === "prospeccao" && window.AdminProspeccao) window.AdminProspeccao.carregar();
    if (nomeAba === "calendario" && window.AdminCalendario) window.AdminCalendario.carregar();
    if (nomeAba === "campanhas" && window.AdminCampanhas) window.AdminCampanhas.carregar();
    if (nomeAba === "checklist" && window.AdminChecklist) window.AdminChecklist.carregar();
  }

  function abrirGavetaMobile(){
    document.getElementById("sidebarAdmin").classList.add("aberta");
    document.getElementById("overlayMenu").classList.add("ativo");
    document.getElementById("btnAbrirMenu").setAttribute("aria-expanded", "true");
  }
  function fecharGavetaMobile(){
    document.getElementById("sidebarAdmin").classList.remove("aberta");
    document.getElementById("overlayMenu").classList.remove("ativo");
    document.getElementById("btnAbrirMenu").setAttribute("aria-expanded", "false");
  }

  function iniciar(){
    document.querySelectorAll(".admin-nav-item").forEach(function(item){
      item.addEventListener("click", function(){
        irParaAba(item.getAttribute("data-aba"));
      });
    });

    document.getElementById("btnAbrirMenu").addEventListener("click", abrirGavetaMobile);
    document.getElementById("overlayMenu").addEventListener("click", fecharGavetaMobile);

    document.getElementById("btnSair").addEventListener("click", async function(){
      await window.db.auth.signOut();
      window.location.href = "../login/";
    });

    configurarFechamentoModais();

    // Aba inicial
    irParaAba("portfolio");
  }

  return {
    iniciar: iniciar,
    consultar: consultar,
    escaparHtml: escaparHtml,
    formatarDataBR: formatarDataBR,
    formatarDinheiro: formatarDinheiro,
    hojeIso: hojeIso,
    diasEntreHojeE: diasEntreHojeE,
    baixarCSV: baixarCSV,
    abrirModal: abrirModal,
    fecharModal: fecharModal
  };
})();
