/* ============================================================
   Aba Portfólio: números de visita, gráfico dos últimos 14 dias,
   de onde vêm as visitas, e a tabela de vídeos (a mesma que
   alimenta o site público).
   ============================================================ */

window.AdminPortfolio = (function(){
  "use strict";

  var Core = window.AdminCore;
  var videosEmMemoria = [];
  var arrastandoIndice = null;

  function ehExemplo(texto){
    return String(texto || "").indexOf("[Exemplo]") === 0;
  }

  async function carregar(){
    await Promise.all([carregarKpisEGraficos(), carregarVideos()]);
  }

  /* ---------- KPIs + gráfico + origens ---------- */

  async function carregarKpisEGraficos(){
    var resultadoVisitas = await Core.consultar(
      window.db.from("visitas").select("data, pagina, origem").order("data", { ascending: true }),
      "visitas"
    );
    var resultadoVideos = await Core.consultar(
      window.db.from("videos").select("nicho, visivel"),
      "vídeos"
    );

    var visitas = resultadoVisitas.data || [];
    var videos = resultadoVideos.data || [];

    renderizarKpis(visitas, videos);
    renderizarGrafico14Dias(visitas);
    renderizarOrigens(visitas);
  }

  function renderizarKpis(visitas, videos){
    var hoje = Core.hojeIso();
    var limite14 = new Date();
    limite14.setDate(limite14.getDate() - 13);
    var limite14Iso = limite14.toISOString().slice(0, 10);

    var visitas14 = visitas.filter(function(v){ return String(v.data).slice(0, 10) >= limite14Iso; }).length;
    var visitasHoje = visitas.filter(function(v){ return String(v.data).slice(0, 10) === hoje; }).length;
    var videosNoAr = videos.filter(function(v){ return v.visivel; }).length;

    var contagemNicho = {};
    videos.forEach(function(v){
      if (!v.nicho) return;
      contagemNicho[v.nicho] = (contagemNicho[v.nicho] || 0) + 1;
    });
    var nichoForte = maiorChave(contagemNicho);

    var contagemOrigem = {};
    visitas.forEach(function(v){
      var origem = v.origem || "direto";
      contagemOrigem[origem] = (contagemOrigem[origem] || 0) + 1;
    });
    var origemForte = maiorChave(contagemOrigem);

    var caixa = document.getElementById("kpiPortfolio");
    caixa.innerHTML = [
      kpiHtml(visitas14, "Visitas em 14 dias"),
      kpiHtml(visitasHoje, "Visitas hoje"),
      kpiHtml(videosNoAr, "Vídeos no ar"),
      kpiHtml(nichoForte || "-", "Nicho mais forte"),
      kpiHtml(origemForte || "-", "De onde mais vêm")
    ].join("");
  }

  function maiorChave(objeto){
    var chaves = Object.keys(objeto);
    if (!chaves.length) return null;
    chaves.sort(function(a, b){ return objeto[b] - objeto[a]; });
    return chaves[0];
  }

  function kpiHtml(valor, rotulo){
    return '<div class="kpi"><p class="kpi-valor">' + Core.escaparHtml(valor) + '</p><p class="kpi-label">' + Core.escaparHtml(rotulo) + '</p></div>';
  }

  function renderizarGrafico14Dias(visitas){
    var caixa = document.getElementById("graficoVisitas");
    if (!visitas.length){
      caixa.innerHTML = '<div class="estado-vazio">Ainda não há visitas registradas. Assim que alguém acessar o seu portfólio, o gráfico dos últimos 14 dias aparece aqui.</div>';
      return;
    }

    var dias = [];
    for (var i = 13; i >= 0; i--){
      var d = new Date();
      d.setDate(d.getDate() - i);
      var iso = d.toISOString().slice(0, 10);
      dias.push({ iso: iso, rotulo: String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0"), total: 0 });
    }
    var porDia = {};
    dias.forEach(function(dia){ porDia[dia.iso] = dia; });
    visitas.forEach(function(v){
      var iso = String(v.data).slice(0, 10);
      if (porDia[iso]) porDia[iso].total += 1;
    });

    var maior = Math.max.apply(null, dias.map(function(d){ return d.total; }));
    if (maior === 0) maior = 1;

    caixa.innerHTML = '<div class="grafico-barras">' + dias.map(function(dia){
      var altura = Math.round((dia.total / maior) * 100);
      return '<div class="grafico-barra-col" title="' + dia.total + ' visita(s) em ' + dia.rotulo + '">' +
        '<div class="grafico-barra" style="height:' + Math.max(altura, dia.total > 0 ? 4 : 1) + '%;"></div>' +
        '<span class="grafico-barra-label">' + dia.rotulo + '</span>' +
      '</div>';
    }).join("") + '</div>';
  }

  function renderizarOrigens(visitas){
    var caixa = document.getElementById("listaOrigens");
    if (!visitas.length){
      caixa.innerHTML = '<div class="estado-vazio">Sem visitas ainda pra saber de onde as pessoas estão vindo.</div>';
      return;
    }
    var contagem = {};
    visitas.forEach(function(v){
      var origem = v.origem || "direto";
      contagem[origem] = (contagem[origem] || 0) + 1;
    });
    var lista = Object.keys(contagem).map(function(k){ return { origem: k, total: contagem[k] }; });
    lista.sort(function(a, b){ return b.total - a.total; });
    lista = lista.slice(0, 6);
    var maior = lista[0].total || 1;

    caixa.innerHTML = '<div class="lista-origens">' + lista.map(function(item){
      var largura = Math.round((item.total / maior) * 100);
      return '<div class="origem-item">' +
        '<span class="origem-nome">' + Core.escaparHtml(item.origem) + '</span>' +
        '<span class="origem-barra-fundo"><span class="origem-barra" style="width:' + largura + '%;"></span></span>' +
        '<span class="origem-valor">' + item.total + '</span>' +
      '</div>';
    }).join("") + '</div>';
  }

  /* ---------- Tabela de vídeos ---------- */

  async function carregarVideos(){
    var resultado = await Core.consultar(
      window.db.from("videos").select("*").order("ordem", { ascending: true }),
      "vídeos"
    );
    videosEmMemoria = resultado.data || [];
    renderizarTabelaVideos();
  }

  function renderizarTabelaVideos(){
    var corpo = document.getElementById("corpoTabelaVideos");
    if (!videosEmMemoria.length){
      corpo.innerHTML = '<tr><td colspan="8" class="estado-vazio">Nenhum vídeo cadastrado ainda. Clique em "Adicionar vídeo" pra colocar o primeiro.</td></tr>';
      return;
    }
    corpo.innerHTML = videosEmMemoria.map(function(v, indice){
      var exemplo = ehExemplo(v.titulo);
      return '<tr draggable="true" data-indice="' + indice + '" class="' + (exemplo ? "linha-exemplo" : "") + '">' +
        '<td><span class="alcinha" title="Arraste pra reordenar">⠿</span></td>' +
        '<td>' + Core.escaparHtml(v.titulo) + (exemplo ? '<span class="selo-exemplo">exemplo</span>' : '') + '</td>' +
        '<td>' + Core.escaparHtml(v.nicho) + '</td>' +
        '<td>' + Core.escaparHtml(v.formato) + '</td>' +
        '<td>' + Core.escaparHtml(v.marca) + '</td>' +
        '<td>' + Core.escaparHtml(v.destaque || "-") + '</td>' +
        '<td><button class="btn-icon btn-olho" data-id="' + v.id + '" data-visivel="' + v.visivel + '" title="' + (v.visivel ? "Visível no site" : "Escondido do site") + '">' + iconeOlho(v.visivel) + '</button></td>' +
        '<td class="celula-acoes">' +
          '<button class="btn-icon btn-editar-video" data-id="' + v.id + '" title="Editar">' + iconeLapis() + '</button>' +
          '<button class="btn-icon btn-apagar-video" data-id="' + v.id + '" title="Apagar">' + iconeLixo() + '</button>' +
        '</td>' +
      '</tr>';
    }).join("");

    corpo.querySelectorAll(".btn-editar-video").forEach(function(botao){
      botao.addEventListener("click", function(e){ e.stopPropagation(); abrirEdicao(botao.getAttribute("data-id")); });
    });
    corpo.querySelectorAll(".btn-apagar-video").forEach(function(botao){
      botao.addEventListener("click", function(e){ e.stopPropagation(); apagarVideo(botao.getAttribute("data-id")); });
    });
    corpo.querySelectorAll(".btn-olho").forEach(function(botao){
      botao.addEventListener("click", function(e){
        e.stopPropagation();
        var novoValor = botao.getAttribute("data-visivel") !== "true";
        alternarVisivel(botao.getAttribute("data-id"), novoValor);
      });
    });

    configurarArrastar(corpo);
  }

  function iconeOlho(visivel){
    if (visivel){
      return '<svg class="icon" viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>';
    }
    return '<svg class="icon" viewBox="0 0 24 24" style="opacity:.45;"><path d="M3 3l18 18"/><path d="M10.6 5.2A9.9 9.9 0 0 1 12 5c6 0 10 7 10 7a17.6 17.6 0 0 1-3.2 3.9M6.6 6.6C4 8.3 2 12 2 12s4 7 10 7a9.7 9.7 0 0 0 4.2-1"/><path d="M9.5 9.5a3 3 0 0 0 4.2 4.2"/></svg>';
  }
  function iconeLapis(){
    return '<svg class="icon" viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
  }
  function iconeLixo(){
    return '<svg class="icon" viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>';
  }

  async function alternarVisivel(id, novoValor){
    await Core.consultar(window.db.from("videos").update({ visivel: novoValor }).eq("id", id), "vídeos");
    await carregarVideos();
    await carregarKpisEGraficos();
  }

  async function apagarVideo(id){
    if (!window.confirm("Apagar este vídeo? Essa ação não pode ser desfeita.")) return;
    await Core.consultar(window.db.from("videos").delete().eq("id", id), "vídeos");
    await carregarVideos();
    await carregarKpisEGraficos();
  }

  function abrirEdicao(id){
    var video = videosEmMemoria.find(function(v){ return v.id === id; });
    if (!video) return;
    document.getElementById("tituloModalVideo").textContent = "Editar vídeo";
    document.getElementById("videoId").value = video.id;
    document.getElementById("videoTitulo").value = video.titulo || "";
    document.getElementById("videoLink").value = video.link || "";
    document.getElementById("videoNicho").value = video.nicho || "";
    document.getElementById("videoFormato").value = video.formato || "";
    document.getElementById("videoMarca").value = video.marca || "";
    document.getElementById("videoDestaque").value = video.destaque || "";
    document.getElementById("btnApagarVideo").style.display = "";
    document.getElementById("erroVideo").textContent = "";
    Core.abrirModal("modalVideo");
  }

  function abrirNovo(){
    document.getElementById("tituloModalVideo").textContent = "Adicionar vídeo";
    document.getElementById("formVideo").reset();
    document.getElementById("videoId").value = "";
    document.getElementById("btnApagarVideo").style.display = "none";
    document.getElementById("erroVideo").textContent = "";
    Core.abrirModal("modalVideo");
  }

  /* ---------- Arrastar pra reordenar ---------- */

  function configurarArrastar(corpo){
    var linhas = corpo.querySelectorAll("tr[draggable]");
    linhas.forEach(function(linha){
      linha.addEventListener("dragstart", function(){
        arrastandoIndice = Number(linha.getAttribute("data-indice"));
        linha.classList.add("arrastando");
      });
      linha.addEventListener("dragend", function(){
        linha.classList.remove("arrastando");
      });
      linha.addEventListener("dragover", function(e){ e.preventDefault(); });
      linha.addEventListener("drop", function(e){
        e.preventDefault();
        var indiceDestino = Number(linha.getAttribute("data-indice"));
        if (arrastandoIndice === null || arrastandoIndice === indiceDestino) return;
        var itemMovido = videosEmMemoria.splice(arrastandoIndice, 1)[0];
        videosEmMemoria.splice(indiceDestino, 0, itemMovido);
        arrastandoIndice = null;
        renderizarTabelaVideos();
        salvarNovaOrdem();
      });
    });
  }

  async function salvarNovaOrdem(){
    var atualizacoes = videosEmMemoria.map(function(video, indice){
      if (video.ordem === indice) return null;
      video.ordem = indice;
      return Core.consultar(window.db.from("videos").update({ ordem: indice }).eq("id", video.id), "vídeos");
    }).filter(Boolean);
    await Promise.all(atualizacoes);
  }

  /* ---------- Formulário (salvar) ---------- */

  function configurarFormulario(){
    document.getElementById("btnNovoVideo").addEventListener("click", abrirNovo);

    document.getElementById("formVideo").addEventListener("submit", async function(e){
      e.preventDefault();
      var id = document.getElementById("videoId").value;
      var dados = {
        titulo: document.getElementById("videoTitulo").value.trim(),
        link: document.getElementById("videoLink").value.trim(),
        nicho: document.getElementById("videoNicho").value.trim(),
        formato: document.getElementById("videoFormato").value.trim(),
        marca: document.getElementById("videoMarca").value.trim(),
        destaque: document.getElementById("videoDestaque").value.trim()
      };
      var erroCaixa = document.getElementById("erroVideo");
      erroCaixa.textContent = "";

      var resultado;
      if (id){
        resultado = await Core.consultar(window.db.from("videos").update(dados).eq("id", id), "vídeos");
      } else {
        dados.ordem = videosEmMemoria.length;
        dados.visivel = true;
        resultado = await Core.consultar(window.db.from("videos").insert(dados), "vídeos");
      }
      if (resultado.erro){
        erroCaixa.textContent = "Não deu pra salvar. Confira os campos e tente de novo.";
        return;
      }
      Core.fecharModal("modalVideo");
      await carregarVideos();
      await carregarKpisEGraficos();
    });

    document.getElementById("btnApagarVideo").addEventListener("click", async function(){
      var id = document.getElementById("videoId").value;
      if (!id) return;
      Core.fecharModal("modalVideo");
      await apagarVideo(id);
    });
  }

  configurarFormulario();

  return { carregar: carregar };
})();
