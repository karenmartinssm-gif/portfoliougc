/* ============================================================
   Aba Calendário: visão do mês inteiro, com os prazos das
   campanhas aparecendo sozinhos, e o bloco "Ficou pra trás"
   com o que passou do dia e não foi feito.
   ============================================================ */

window.AdminCalendario = (function(){
  "use strict";

  var Core = window.AdminCore;
  var itensEmMemoria = [];
  var campanhasEmMemoria = [];
  var mesAtual = new Date();
  mesAtual.setDate(1);

  var nomesMes = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  var rotuloTipo = { gravar: "Gravar", editar: "Editar", postar: "Postar" };

  async function carregar(){
    var resultadoItens = await Core.consultar(window.db.from("calendario").select("*"), "calendário");
    var resultadoCampanhas = await Core.consultar(window.db.from("campanhas").select("id, campanha, cliente, prazo, status"), "campanhas");
    itensEmMemoria = resultadoItens.data || [];
    campanhasEmMemoria = (resultadoCampanhas.data || []).filter(function(c){ return c.prazo; });
    renderizarTudo();
  }

  function isoParaData(iso){ return new Date(String(iso).slice(0, 10) + "T00:00:00"); }
  function dataParaIso(d){
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function itensDoDia(iso){
    var filtroTipo = document.getElementById("filtroTipoCalendario").value;
    var lista = itensEmMemoria
      .filter(function(item){ return item.data === iso && (!filtroTipo || item.tipo === filtroTipo); })
      .map(function(item){ return { tipo: "item", dado: item }; });
    var prazos = campanhasEmMemoria
      .filter(function(c){ return String(c.prazo).slice(0, 10) === iso; })
      .map(function(c){ return { tipo: "prazo", dado: c }; });
    return lista.concat(prazos);
  }

  function renderizarTudo(){
    document.getElementById("calendarioMesNome").textContent = nomesMes[mesAtual.getMonth()] + " de " + mesAtual.getFullYear();
    renderizarGrade();
    renderizarAtrasados();
  }

  function renderizarGrade(){
    var caixa = document.getElementById("calendarioGrade");
    var ano = mesAtual.getFullYear();
    var mes = mesAtual.getMonth();
    var primeiroDia = new Date(ano, mes, 1);
    var indiceSegunda = (primeiroDia.getDay() + 6) % 7; // 0 = segunda
    var inicioGrade = new Date(ano, mes, 1 - indiceSegunda);
    var hoje = Core.hojeIso();

    var html = ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"].map(function(d){
      return '<div class="calendario-cabecalho-dia">' + d + '</div>';
    }).join("");

    for (var i = 0; i < 42; i++){
      var diaAtual = new Date(inicioGrade);
      diaAtual.setDate(inicioGrade.getDate() + i);
      var iso = dataParaIso(diaAtual);
      var foraDoMes = diaAtual.getMonth() !== mes;
      var ehHoje = iso === hoje;
      var itens = itensDoDia(iso);
      var visiveis = itens.slice(0, 3);
      var resto = itens.length - visiveis.length;

      html += '<div class="calendario-dia' + (foraDoMes ? " fora-do-mes" : "") + (ehHoje ? " hoje" : "") + '" data-dia-iso="' + iso + '">' +
        '<span class="calendario-dia-numero">' + diaAtual.getDate() + '</span>' +
        visiveis.map(function(entrada){ return itemHtml(entrada); }).join("") +
        (resto > 0 ? '<span class="calendario-dia-mais" data-dia-mais="' + iso + '">+' + resto + ' mais</span>' : '') +
        '<span class="calendario-dia-add" data-dia-add="' + iso + '">+</span>' +
      '</div>';
    }
    caixa.innerHTML = html;

    caixa.querySelectorAll(".calendario-dia-item[data-item-id]").forEach(function(el){
      el.addEventListener("click", function(e){
        e.stopPropagation();
        abrirEdicao(el.getAttribute("data-item-id"));
      });
    });
    caixa.querySelectorAll(".calendario-dia-mais").forEach(function(el){
      el.addEventListener("click", function(e){
        e.stopPropagation();
        abrirDiaCompleto(el.getAttribute("data-dia-mais"));
      });
    });
    caixa.querySelectorAll(".calendario-dia-add, .calendario-dia").forEach(function(el){
      el.addEventListener("click", function(){
        abrirNovo(el.getAttribute("data-dia-add") || el.getAttribute("data-dia-iso"));
      });
    });
  }

  function itemHtml(entrada){
    if (entrada.tipo === "prazo"){
      var c = entrada.dado;
      return '<span class="calendario-dia-item tipo-prazo" title="Prazo de campanha">Prazo: ' + Core.escaparHtml(c.campanha) + '</span>';
    }
    var item = entrada.dado;
    return '<span class="calendario-dia-item tipo-' + item.tipo + (item.status === "feito" ? " feito" : "") + '" data-item-id="' + item.id + '" title="' + rotuloTipo[item.tipo] + ': ' + Core.escaparHtml(item.titulo) + '">' + Core.escaparHtml(item.titulo) + '</span>';
  }

  function abrirDiaCompleto(iso){
    var itens = itensDoDia(iso);
    document.getElementById("tituloModalDia").textContent = Core.formatarDataBR(iso);
    document.getElementById("listaDiaCompleta").innerHTML = itens.map(function(entrada){
      if (entrada.tipo === "prazo"){
        return '<div class="calendario-dia-item tipo-prazo" style="white-space:normal;">Prazo de campanha: ' + Core.escaparHtml(entrada.dado.campanha) + '</div>';
      }
      var item = entrada.dado;
      return '<div class="calendario-dia-item tipo-' + item.tipo + (item.status === "feito" ? " feito" : "") + '" style="white-space:normal; cursor:pointer;" data-item-id="' + item.id + '">' + rotuloTipo[item.tipo] + ': ' + Core.escaparHtml(item.titulo) + '</div>';
    }).join("");
    document.getElementById("listaDiaCompleta").querySelectorAll("[data-item-id]").forEach(function(el){
      el.addEventListener("click", function(){
        Core.fecharModal("modalDiaCalendario");
        abrirEdicao(el.getAttribute("data-item-id"));
      });
    });
    Core.abrirModal("modalDiaCalendario");
  }

  function renderizarAtrasados(){
    var caixa = document.getElementById("listaAtrasados");
    var hoje = Core.hojeIso();
    var atrasados = itensEmMemoria
      .filter(function(item){ return item.status === "a_fazer" && item.data < hoje; })
      .sort(function(a, b){ return a.data < b.data ? -1 : 1; });

    if (!atrasados.length){
      caixa.innerHTML = '<div class="estado-vazio">Nada atrasado. Tudo em dia por aqui.</div>';
      return;
    }
    caixa.innerHTML = atrasados.map(function(item){
      var dias = Math.abs(Core.diasEntreHojeE(item.data));
      return '<div class="atrasado-item" data-item-id="' + item.id + '">' +
        '<span>' + rotuloTipo[item.tipo] + ': ' + Core.escaparHtml(item.titulo) + (item.marca ? " · " + Core.escaparHtml(item.marca) : "") + '</span>' +
        '<span class="atrasado-dias">há ' + dias + (dias === 1 ? " dia" : " dias") + '</span>' +
      '</div>';
    }).join("");
    caixa.querySelectorAll("[data-item-id]").forEach(function(el){
      el.addEventListener("click", function(){ abrirEdicao(el.getAttribute("data-item-id")); });
    });
  }

  function abrirNovo(iso){
    document.getElementById("tituloModalCalendario").textContent = "Adicionar item";
    document.getElementById("formCalendario").reset();
    document.getElementById("itemCalendarioId").value = "";
    document.getElementById("itemData").value = iso || Core.hojeIso();
    document.getElementById("itemTipo").value = "gravar";
    document.getElementById("itemStatus").value = "a_fazer";
    document.getElementById("btnApagarCalendario").style.display = "none";
    document.getElementById("erroCalendario").textContent = "";
    Core.abrirModal("modalCalendario");
  }

  function abrirEdicao(id){
    var item = itensEmMemoria.find(function(i){ return i.id === id; });
    if (!item) return;
    document.getElementById("tituloModalCalendario").textContent = "Editar item";
    document.getElementById("itemCalendarioId").value = item.id;
    document.getElementById("itemTitulo").value = item.titulo || "";
    document.getElementById("itemMarca").value = item.marca || "";
    document.getElementById("itemTipo").value = item.tipo;
    document.getElementById("itemData").value = item.data;
    document.getElementById("itemStatus").value = item.status;
    document.getElementById("btnApagarCalendario").style.display = "";
    document.getElementById("erroCalendario").textContent = "";
    Core.abrirModal("modalCalendario");
  }

  async function apagar(id){
    if (!window.confirm("Apagar este item do calendário?")) return;
    await Core.consultar(window.db.from("calendario").delete().eq("id", id), "calendário");
    await carregar();
  }

  function configurar(){
    document.getElementById("btnMesAnterior").addEventListener("click", function(){
      mesAtual.setMonth(mesAtual.getMonth() - 1);
      renderizarTudo();
    });
    document.getElementById("btnMesProximo").addEventListener("click", function(){
      mesAtual.setMonth(mesAtual.getMonth() + 1);
      renderizarTudo();
    });
    document.getElementById("btnHoje").addEventListener("click", function(){
      mesAtual = new Date();
      mesAtual.setDate(1);
      renderizarTudo();
    });
    document.getElementById("filtroTipoCalendario").addEventListener("change", renderizarGrade);
    document.getElementById("btnNovoItemCalendario").addEventListener("click", function(){ abrirNovo(); });

    document.getElementById("btnApagarCalendario").addEventListener("click", async function(){
      var id = document.getElementById("itemCalendarioId").value;
      if (!id) return;
      Core.fecharModal("modalCalendario");
      await apagar(id);
    });

    document.getElementById("formCalendario").addEventListener("submit", async function(e){
      e.preventDefault();
      var id = document.getElementById("itemCalendarioId").value;
      var dados = {
        titulo: document.getElementById("itemTitulo").value.trim(),
        marca: document.getElementById("itemMarca").value.trim(),
        tipo: document.getElementById("itemTipo").value,
        data: document.getElementById("itemData").value,
        status: document.getElementById("itemStatus").value
      };
      var erroCaixa = document.getElementById("erroCalendario");
      erroCaixa.textContent = "";

      var resultado;
      if (id){
        resultado = await Core.consultar(window.db.from("calendario").update(dados).eq("id", id), "calendário");
      } else {
        resultado = await Core.consultar(window.db.from("calendario").insert(dados), "calendário");
      }
      if (resultado.erro){
        erroCaixa.textContent = "Não deu pra salvar. Confira os campos e tente de novo.";
        return;
      }
      Core.fecharModal("modalCalendario");
      await carregar();
    });
  }

  configurar();

  return { carregar: carregar };
})();
