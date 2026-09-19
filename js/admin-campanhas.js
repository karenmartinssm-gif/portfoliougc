/* ============================================================
   Aba Campanhas: suas campanhas fechadas com marcas, com
   funil de status, avisos de prazo e ordenação por qualquer coluna.
   ============================================================ */

window.AdminCampanhas = (function(){
  "use strict";

  var Core = window.AdminCore;
  var campanhasEmMemoria = [];
  var filtroAtivo = "todas";
  var colunaOrdem = null;
  var ordemCrescente = true;

  var ordemFunil = ["Briefing", "Roteiro", "Aprovação Roteiro", "Gravação", "Edição", "Aprovado", "Entregue"];

  function ehExemplo(texto){
    return String(texto || "").indexOf("[Exemplo]") === 0;
  }

  async function carregar(){
    var resultado = await Core.consultar(window.db.from("campanhas").select("*"), "campanhas");
    campanhasEmMemoria = resultado.data || [];
    renderizarKpis();
    renderizarTabela();
  }

  function renderizarKpis(){
    var total = campanhasEmMemoria.length;
    var ativas = campanhasEmMemoria.filter(function(c){ return c.ativa; }).length;
    var valorTotal = campanhasEmMemoria.reduce(function(s, c){ return s + (Number(c.valor) || 0); }, 0);
    var qtdTotal = campanhasEmMemoria.reduce(function(s, c){ return s + (Number(c.qtd) || 0); }, 0);
    var ticketMedio = qtdTotal > 0 ? valorTotal / qtdTotal : 0;
    var aReceber = campanhasEmMemoria.filter(function(c){ return c.pagamento === "pendente"; }).reduce(function(s, c){ return s + (Number(c.valor) || 0); }, 0);
    var recebido = campanhasEmMemoria.filter(function(c){ return c.pagamento === "pago"; }).reduce(function(s, c){ return s + (Number(c.valor) || 0); }, 0);

    var caixa = document.getElementById("kpiCampanhas");
    caixa.innerHTML =
      kpi(total, "Total de campanhas") +
      kpi(ativas, "Ativas") +
      kpi(Core.formatarDinheiro(valorTotal), "Valor total", "ticket médio: " + (qtdTotal > 0 ? Core.formatarDinheiro(ticketMedio) : "sem vídeos ainda")) +
      kpi(Core.formatarDinheiro(aReceber), "A receber", "já recebido: " + Core.formatarDinheiro(recebido));
  }

  function kpi(valor, rotulo, sub){
    return '<div class="kpi"><p class="kpi-valor">' + Core.escaparHtml(valor) + '</p><p class="kpi-label">' + Core.escaparHtml(rotulo) + '</p>' +
      (sub ? '<p class="kpi-label" style="margin-top:2px; opacity:.75;">' + Core.escaparHtml(sub) + '</p>' : '') + '</div>';
  }

  function campanhasFiltradas(){
    var termo = document.getElementById("buscaCampanhas").value.trim().toLowerCase();
    var lista = campanhasEmMemoria.filter(function(c){
      if (filtroAtivo === "ativas" && !c.ativa) return false;
      if (filtroAtivo === "finalizadas" && c.status !== "Entregue") return false;
      if (!termo) return true;
      var alvo = ((c.campanha || "") + " " + (c.cliente || "")).toLowerCase();
      return alvo.indexOf(termo) !== -1;
    });

    if (colunaOrdem){
      lista = lista.slice().sort(function(a, b){
        var va = a[colunaOrdem], vb = b[colunaOrdem];
        var resultado;
        if (colunaOrdem === "status"){
          resultado = ordemFunil.indexOf(va) - ordemFunil.indexOf(vb);
        } else if (colunaOrdem === "qtd" || colunaOrdem === "valor"){
          resultado = (Number(va) || 0) - (Number(vb) || 0);
        } else if (colunaOrdem === "prazo"){
          resultado = String(va || "9999") < String(vb || "9999") ? -1 : (String(va || "9999") > String(vb || "9999") ? 1 : 0);
        } else {
          resultado = String(va || "").localeCompare(String(vb || ""), "pt-BR");
        }
        return ordemCrescente ? resultado : -resultado;
      });
    }
    return lista;
  }

  function renderizarTabela(){
    var corpo = document.getElementById("corpoTabelaCampanhas");
    var lista = campanhasFiltradas();

    document.querySelectorAll("#aba-campanhas .seta-ordem").forEach(function(seta){
      var coluna = seta.parentElement.getAttribute("data-coluna");
      seta.classList.toggle("ativa", coluna === colunaOrdem);
      seta.textContent = (coluna === colunaOrdem && !ordemCrescente) ? "▴" : "▾";
    });

    if (!campanhasEmMemoria.length){
      corpo.innerHTML = '<tr><td colspan="9" class="estado-vazio">Nenhuma campanha cadastrada ainda. Clique em "Adicionar campanha" pra colocar a primeira.</td></tr>';
      return;
    }
    if (!lista.length){
      corpo.innerHTML = '<tr><td colspan="9" class="estado-vazio">Nada encontrado com esse filtro.</td></tr>';
      return;
    }

    var hoje = Core.hojeIso();
    corpo.innerHTML = lista.map(function(c){
      var exemplo = ehExemplo(c.campanha);
      var etiquetaPrazo = "";
      if (c.prazo && c.status !== "Entregue"){
        var dias = Core.diasEntreHojeE(c.prazo);
        if (dias < 0){
          etiquetaPrazo = '<span class="etiqueta-prazo etiqueta-atrasado">' + Math.abs(dias) + 'd atrasado</span>';
        } else if (dias <= 3){
          etiquetaPrazo = '<span class="etiqueta-prazo etiqueta-perto">' + (dias === 0 ? "vence hoje" : "vence em " + dias + "d") + '</span>';
        }
      }
      var indiceFunil = ordemFunil.indexOf(c.status) + 1;

      return '<tr data-id="' + c.id + '" class="' + (exemplo ? "linha-exemplo" : "") + (c.favorita ? " linha-favorita" : "") + '">' +
        '<td><button class="estrela-btn' + (c.favorita ? " ativa" : "") + '" data-id="' + c.id + '" data-favorita="' + c.favorita + '" title="Destacar">' +
          '<svg class="icon" viewBox="0 0 24 24" fill="' + (c.favorita ? "currentColor" : "none") + '"><path d="M12 2l3.1 6.3 7 1-5 4.9 1.2 6.9L12 17.8 5.7 21l1.2-6.9-5-4.9 7-1z"/></svg>' +
        '</button></td>' +
        '<td>' + Core.escaparHtml(c.campanha) + (exemplo ? '<span class="selo-exemplo">exemplo</span>' : '') + '</td>' +
        '<td>' + Core.escaparHtml(c.cliente) + '</td>' +
        '<td><span class="pilula pilula-tipo-' + (c.tipo === "Publicidade" ? "publicidade" : "conteudo") + '">' + Core.escaparHtml(c.tipo) + '</span></td>' +
        '<td><span class="pilula pilula-funil-' + indiceFunil + '">' + Core.escaparHtml(c.status) + '</span></td>' +
        '<td>' + (c.qtd || 0) + '</td>' +
        '<td>' + Core.formatarDinheiro(c.valor) + '</td>' +
        '<td>' + Core.formatarDataBR(c.prazo) + etiquetaPrazo + '</td>' +
        '<td><span class="pilula pilula-' + c.pagamento + '">' + (c.pagamento === "pago" ? "Pago" : "Pendente") + '</span></td>' +
      '</tr>';
    }).join("");

    corpo.querySelectorAll("tr[data-id]").forEach(function(linha){
      linha.addEventListener("click", function(){ abrirEdicao(linha.getAttribute("data-id")); });
    });
    corpo.querySelectorAll(".estrela-btn").forEach(function(botao){
      botao.addEventListener("click", function(e){
        e.stopPropagation();
        alternarFavorita(botao.getAttribute("data-id"), botao.getAttribute("data-favorita") !== "true");
      });
    });
  }

  async function alternarFavorita(id, novoValor){
    await Core.consultar(window.db.from("campanhas").update({ favorita: novoValor }).eq("id", id), "campanhas");
    await carregar();
  }

  function abrirEdicao(id){
    var c = campanhasEmMemoria.find(function(x){ return x.id === id; });
    if (!c) return;
    document.getElementById("tituloModalCampanha").textContent = "Editar campanha";
    document.getElementById("campanhaId").value = c.id;
    document.getElementById("campanhaNome").value = c.campanha || "";
    document.getElementById("campanhaCliente").value = c.cliente || "";
    document.getElementById("campanhaTipo").value = c.tipo || "Conteúdo";
    document.getElementById("campanhaStatus").value = c.status || "Briefing";
    document.getElementById("campanhaQtd").value = c.qtd || 1;
    document.getElementById("campanhaValor").value = c.valor || 0;
    document.getElementById("campanhaPrazo").value = c.prazo ? String(c.prazo).slice(0, 10) : "";
    document.getElementById("campanhaPagamento").value = c.pagamento || "pendente";
    document.getElementById("campanhaAtiva").checked = !!c.ativa;
    document.getElementById("campanhaFavorita").checked = !!c.favorita;
    document.getElementById("btnApagarCampanha").style.display = "";
    document.getElementById("erroCampanha").textContent = "";
    Core.abrirModal("modalCampanha");
  }

  function abrirNova(){
    document.getElementById("tituloModalCampanha").textContent = "Adicionar campanha";
    document.getElementById("formCampanha").reset();
    document.getElementById("campanhaId").value = "";
    document.getElementById("campanhaQtd").value = 1;
    document.getElementById("campanhaValor").value = 0;
    document.getElementById("campanhaAtiva").checked = true;
    document.getElementById("campanhaFavorita").checked = false;
    document.getElementById("btnApagarCampanha").style.display = "none";
    document.getElementById("erroCampanha").textContent = "";
    Core.abrirModal("modalCampanha");
  }

  async function apagar(id){
    if (!window.confirm("Apagar esta campanha? Essa ação não pode ser desfeita.")) return;
    await Core.consultar(window.db.from("campanhas").delete().eq("id", id), "campanhas");
    await carregar();
  }

  function baixarCsv(){
    var colunas = ["Campanha", "Cliente", "Tipo", "Status", "Qtd", "Valor", "Prazo", "Pagamento", "Ativa", "Favorita"];
    var linhas = campanhasFiltradas().map(function(c){
      return [
        c.campanha || "", c.cliente || "", c.tipo || "", c.status || "", c.qtd || 0,
        Core.formatarDinheiro(c.valor), Core.formatarDataBR(c.prazo), c.pagamento === "pago" ? "Pago" : "Pendente",
        c.ativa ? "Sim" : "Não", c.favorita ? "Sim" : "Não"
      ];
    });
    Core.baixarCSV("campanhas.csv", colunas, linhas);
  }

  function configurar(){
    document.getElementById("btnNovaCampanha").addEventListener("click", abrirNova);
    document.getElementById("btnBaixarCampanhas").addEventListener("click", baixarCsv);
    document.getElementById("buscaCampanhas").addEventListener("input", renderizarTabela);

    document.querySelectorAll("[data-filtro-campanha]").forEach(function(chip){
      chip.addEventListener("click", function(){
        document.querySelectorAll("[data-filtro-campanha]").forEach(function(c){ c.classList.remove("ativo"); });
        chip.classList.add("ativo");
        filtroAtivo = chip.getAttribute("data-filtro-campanha");
        renderizarTabela();
      });
    });

    document.querySelectorAll("#aba-campanhas th.ordenavel").forEach(function(th){
      th.addEventListener("click", function(){
        var coluna = th.getAttribute("data-coluna");
        if (colunaOrdem === coluna){
          ordemCrescente = !ordemCrescente;
        } else {
          colunaOrdem = coluna;
          ordemCrescente = true;
        }
        renderizarTabela();
      });
    });

    document.getElementById("btnApagarCampanha").addEventListener("click", async function(){
      var id = document.getElementById("campanhaId").value;
      if (!id) return;
      Core.fecharModal("modalCampanha");
      await apagar(id);
    });

    document.getElementById("formCampanha").addEventListener("submit", async function(e){
      e.preventDefault();
      var id = document.getElementById("campanhaId").value;
      var dados = {
        campanha: document.getElementById("campanhaNome").value.trim(),
        cliente: document.getElementById("campanhaCliente").value.trim(),
        tipo: document.getElementById("campanhaTipo").value,
        status: document.getElementById("campanhaStatus").value,
        qtd: Number(document.getElementById("campanhaQtd").value) || 1,
        valor: Number(document.getElementById("campanhaValor").value) || 0,
        prazo: document.getElementById("campanhaPrazo").value || null,
        pagamento: document.getElementById("campanhaPagamento").value,
        ativa: document.getElementById("campanhaAtiva").checked,
        favorita: document.getElementById("campanhaFavorita").checked
      };
      var erroCaixa = document.getElementById("erroCampanha");
      erroCaixa.textContent = "";

      var resultado;
      if (id){
        resultado = await Core.consultar(window.db.from("campanhas").update(dados).eq("id", id), "campanhas");
      } else {
        resultado = await Core.consultar(window.db.from("campanhas").insert(dados), "campanhas");
      }
      if (resultado.erro){
        erroCaixa.textContent = "Não deu pra salvar. Confira os campos e tente de novo.";
        return;
      }
      Core.fecharModal("modalCampanha");
      await carregar();
    });
  }

  configurar();

  return { carregar: carregar };
})();
