/* ============================================================
   Aba Marcas: sua base de contatos de empresa, em formato de
   planilha, com busca, filtro por situação e exportação em CSV.
   ============================================================ */

window.AdminMarcas = (function(){
  "use strict";

  var Core = window.AdminCore;
  var marcasEmMemoria = [];

  var rotuloSituacao = {
    lead: "Lead",
    conversando: "Conversando",
    cliente: "Cliente",
    parada: "Parada"
  };

  function ehExemplo(texto){
    return String(texto || "").indexOf("[Exemplo]") === 0;
  }

  async function carregar(){
    var resultado = await Core.consultar(
      window.db.from("marcas").select("*").order("criado_em", { ascending: false }),
      "marcas"
    );
    marcasEmMemoria = resultado.data || [];
    renderizarTabela();
  }

  function marcasFiltradas(){
    var termo = document.getElementById("buscaMarcas").value.trim().toLowerCase();
    var situacao = document.getElementById("filtroSituacao").value;
    return marcasEmMemoria.filter(function(m){
      if (situacao && m.situacao !== situacao) return false;
      if (!termo) return true;
      var alvo = ((m.marca || "") + " " + (m.instagram || "") + " " + (m.email || "")).toLowerCase();
      return alvo.indexOf(termo) !== -1;
    });
  }

  function renderizarTabela(){
    var corpo = document.getElementById("corpoTabelaMarcas");
    var lista = marcasFiltradas();

    if (!marcasEmMemoria.length){
      corpo.innerHTML = '<tr><td colspan="6" class="estado-vazio">Nenhuma marca cadastrada ainda. Clique em "Adicionar marca" ou espere o formulário do site trazer o primeiro lead.</td></tr>';
      return;
    }
    if (!lista.length){
      corpo.innerHTML = '<tr><td colspan="6" class="estado-vazio">Nada encontrado com esse filtro.</td></tr>';
      return;
    }

    corpo.innerHTML = lista.map(function(m){
      var exemplo = ehExemplo(m.marca);
      var telefoneLimpo = String(m.telefone || "").replace(/\D/g, "");
      var instagramLimpo = String(m.instagram || "").replace(/^@/, "");
      var botoesContato = "";
      if (telefoneLimpo){
        botoesContato += '<a href="https://wa.me/' + telefoneLimpo + '" target="_blank" rel="noopener" title="WhatsApp" onclick="event.stopPropagation()">W</a>';
      }
      if (instagramLimpo){
        botoesContato += '<a href="https://instagram.com/' + Core.escaparHtml(instagramLimpo) + '" target="_blank" rel="noopener" title="Instagram" onclick="event.stopPropagation()">IG</a>';
      }
      return '<tr data-id="' + m.id + '" class="' + (exemplo ? "linha-exemplo" : "") + '">' +
        '<td>' + Core.escaparHtml(m.marca) + (exemplo ? '<span class="selo-exemplo">exemplo</span>' : '') + '</td>' +
        '<td>' + Core.escaparHtml(m.instagram || "-") + '</td>' +
        '<td>' + Core.escaparHtml(m.email || "-") + '</td>' +
        '<td><span class="pilula pilula-' + m.situacao + '">' + (rotuloSituacao[m.situacao] || m.situacao) + '</span></td>' +
        '<td>' + Core.formatarDataBR(m.ultimo_contato) + '</td>' +
        '<td><div class="contato-rapido">' + (botoesContato || "-") + '</div></td>' +
      '</tr>';
    }).join("");

    corpo.querySelectorAll("tr[data-id]").forEach(function(linha){
      linha.addEventListener("click", function(){ abrirEdicao(linha.getAttribute("data-id")); });
    });
  }

  function abrirEdicao(id){
    var marca = marcasEmMemoria.find(function(m){ return m.id === id; });
    if (!marca) return;
    document.getElementById("tituloModalMarca").textContent = "Editar marca";
    document.getElementById("marcaId").value = marca.id;
    document.getElementById("marcaNome").value = marca.marca || "";
    document.getElementById("marcaInstagram").value = marca.instagram || "";
    document.getElementById("marcaTelefone").value = marca.telefone || "";
    document.getElementById("marcaEmail").value = marca.email || "";
    document.getElementById("marcaSituacao").value = marca.situacao || "lead";
    document.getElementById("marcaUltimoContato").value = marca.ultimo_contato ? String(marca.ultimo_contato).slice(0, 10) : "";
    document.getElementById("marcaObs").value = marca.obs || "";
    document.getElementById("btnApagarMarca").style.display = "";
    document.getElementById("erroMarca").textContent = "";
    Core.abrirModal("modalMarca");
  }

  function abrirNova(){
    document.getElementById("tituloModalMarca").textContent = "Adicionar marca";
    document.getElementById("formMarca").reset();
    document.getElementById("marcaId").value = "";
    document.getElementById("marcaSituacao").value = "lead";
    document.getElementById("btnApagarMarca").style.display = "none";
    document.getElementById("erroMarca").textContent = "";
    Core.abrirModal("modalMarca");
  }

  async function apagarMarca(id){
    if (!window.confirm("Apagar esta marca? Essa ação não pode ser desfeita.")) return;
    await Core.consultar(window.db.from("marcas").delete().eq("id", id), "marcas");
    await carregar();
  }

  function baixarCsv(){
    var colunas = ["Marca", "Instagram", "E-mail", "Telefone", "Situação", "Observação", "Último contato"];
    var linhas = marcasFiltradas().map(function(m){
      return [
        m.marca || "", m.instagram || "", m.email || "", m.telefone || "",
        rotuloSituacao[m.situacao] || m.situacao || "", m.obs || "", Core.formatarDataBR(m.ultimo_contato)
      ];
    });
    Core.baixarCSV("marcas.csv", colunas, linhas);
  }

  /* ---------- Importar de uma planilha CSV ---------- */

  var CAMPOS_IMPORTAVEIS = ["marca", "instagram", "telefone", "email", "situacao", "obs", "ultimo_contato"];
  var ROTULO_CAMPO_IMPORT = {
    marca: "Marca (obrigatório)",
    instagram: "Instagram",
    telefone: "Telefone",
    email: "E-mail",
    situacao: "Situação",
    obs: "Observação",
    ultimo_contato: "Último contato"
  };
  var SINONIMOS_COLUNA = {
    marca: ["marca", "empresa", "nome da marca", "nome", "brand", "company", "cliente"],
    instagram: ["instagram", "insta", "ig", "perfil", "usuario", "@"],
    telefone: ["telefone", "whatsapp", "whats", "celular", "fone", "phone"],
    email: ["email", "e-mail", "mail"],
    situacao: ["situacao", "status", "etapa", "funil"],
    obs: ["obs", "observacao", "observacoes", "nota", "notas", "comentario", "descricao"],
    ultimo_contato: ["ultimo contato", "data", "last contact"]
  };

  var estadoImport = { cabecalhos: [], linhas: [], mapeamento: {} };

  // Tira acento e deixa minúsculo, pra comparar nomes de coluna sem
  // depender de maiúscula/acentuação exatas ("E-mail" ~ "email" ~ "Email").
  function normalizarTexto(t){
    return String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  }

  // Lê o texto de um CSV exportado do Excel, Google Sheets etc.
  // Detecta sozinho se o separador é vírgula ou ponto e vírgula
  // (o Excel em português costuma usar ";"), e entende campos entre
  // aspas com vírgula/quebra de linha dentro.
  function analisarCSV(texto){
    if (texto.charCodeAt(0) === 0xFEFF) texto = texto.slice(1);
    var primeiraLinha = texto.split(/\r\n|\n|\r/)[0] || "";
    var qtdVirgula = (primeiraLinha.match(/,/g) || []).length;
    var qtdPontoVirgula = (primeiraLinha.match(/;/g) || []).length;
    var separador = qtdPontoVirgula > qtdVirgula ? ";" : ",";

    var linhas = [];
    var linhaAtual = [];
    var campoAtual = "";
    var dentroAspas = false;

    for (var i = 0; i < texto.length; i++){
      var c = texto[i];
      if (dentroAspas){
        if (c === '"'){
          if (texto[i + 1] === '"'){ campoAtual += '"'; i++; }
          else { dentroAspas = false; }
        } else {
          campoAtual += c;
        }
      } else if (c === '"'){
        dentroAspas = true;
      } else if (c === separador){
        linhaAtual.push(campoAtual); campoAtual = "";
      } else if (c === "\n" || c === "\r"){
        if (c === "\r" && texto[i + 1] === "\n") i++;
        linhaAtual.push(campoAtual); campoAtual = "";
        linhas.push(linhaAtual); linhaAtual = [];
      } else {
        campoAtual += c;
      }
    }
    if (campoAtual.length || linhaAtual.length){
      linhaAtual.push(campoAtual);
      linhas.push(linhaAtual);
    }
    linhas = linhas.filter(function(l){ return l.some(function(v){ return String(v).trim() !== ""; }); });

    if (!linhas.length) return { cabecalhos: [], linhas: [] };
    return { cabecalhos: linhas[0].map(function(h){ return String(h).trim(); }), linhas: linhas.slice(1) };
  }

  function sugerirIndiceColuna(cabecalhos, campo){
    var termos = SINONIMOS_COLUNA[campo] || [];
    var normalizados = cabecalhos.map(normalizarTexto);
    for (var t = 0; t < termos.length; t++){
      var idx = normalizados.indexOf(termos[t]);
      if (idx !== -1) return idx;
    }
    for (var t2 = 0; t2 < termos.length; t2++){
      for (var i = 0; i < normalizados.length; i++){
        if (normalizados[i].indexOf(termos[t2]) !== -1) return i;
      }
    }
    return -1;
  }

  // A coluna "situacao" no banco só aceita 4 valores certinhos. Se a
  // planilha tiver outra palavra (ex: "Novo", "Fechado", "Contatado"),
  // tenta adivinhar qual das 4 opções combina, e usa "lead" como
  // segurança pra nunca travar a importação inteira por causa disso.
  function normalizarSituacaoImport(valor){
    var v = normalizarTexto(valor);
    if (!v) return "lead";
    if (/(cliente|fechad|ganh)/.test(v)) return "cliente";
    if (/(convers|negocia|proposta|contatad|andamento)/.test(v)) return "conversando";
    if (/(parad|perdid|descart|cancel|inativ)/.test(v)) return "parada";
    return "lead";
  }

  // Aceita data em ISO (2026-01-01) ou no formato brasileiro
  // (01/01/2026, 1-1-26). Se não reconhecer, devolve null em vez de
  // mandar um texto que quebraria a importação inteira.
  function normalizarDataImport(valor){
    var v = String(valor || "").trim();
    if (!v) return null;
    var iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return iso[1] + "-" + iso[2] + "-" + iso[3];
    var br = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (br){
      var dia = br[1].padStart(2, "0");
      var mes = br[2].padStart(2, "0");
      var ano = br[3].length === 2 ? "20" + br[3] : br[3];
      if (Number(mes) >= 1 && Number(mes) <= 12 && Number(dia) >= 1 && Number(dia) <= 31) return ano + "-" + mes + "-" + dia;
    }
    return null;
  }

  function resetarImportacao(){
    estadoImport = { cabecalhos: [], linhas: [], mapeamento: {} };
    document.getElementById("arquivoCsvMarcas").value = "";
    document.getElementById("importErro").textContent = "";
    document.getElementById("importPasso1").style.display = "";
    document.getElementById("importPasso2").style.display = "none";
    document.getElementById("importPasso3").style.display = "none";
  }

  function abrirImportacao(){
    resetarImportacao();
    Core.abrirModal("modalImportarMarcas");
  }

  function lidarComArquivoCsv(e){
    var arquivo = e.target.files[0];
    if (!arquivo) return;
    var leitor = new FileReader();
    leitor.onload = function(){
      var resultado = analisarCSV(String(leitor.result));
      if (!resultado.cabecalhos.length){
        document.getElementById("importErro").textContent = "Não consegui ler esse arquivo. Confira se é mesmo um CSV.";
        return;
      }
      estadoImport.cabecalhos = resultado.cabecalhos;
      estadoImport.linhas = resultado.linhas;
      estadoImport.mapeamento = {};
      CAMPOS_IMPORTAVEIS.forEach(function(campo){
        estadoImport.mapeamento[campo] = sugerirIndiceColuna(resultado.cabecalhos, campo);
      });

      renderizarMapeamento();
      renderizarPreviaImportacao();
      document.getElementById("importPasso1").style.display = "none";
      document.getElementById("importPasso2").style.display = "";
    };
    leitor.readAsText(arquivo, "UTF-8");
  }

  function renderizarMapeamento(){
    var caixa = document.getElementById("importMapeamento");
    caixa.innerHTML = CAMPOS_IMPORTAVEIS.map(function(campo){
      var opcoes = '<option value="">— Não importar —</option>' +
        estadoImport.cabecalhos.map(function(cab, i){
          var selecionado = estadoImport.mapeamento[campo] === i ? " selected" : "";
          return '<option value="' + i + '"' + selecionado + '>' + Core.escaparHtml(cab) + '</option>';
        }).join("");
      return '<div class="campo"><label>' + ROTULO_CAMPO_IMPORT[campo] + '</label>' +
        '<select data-campo-import="' + campo + '">' + opcoes + '</select></div>';
    }).join("");
  }

  function pegarValorMapeado(linha, campo){
    var idx = estadoImport.mapeamento[campo];
    return (idx !== undefined && idx !== -1 && linha[idx] !== undefined) ? String(linha[idx]).trim() : "";
  }

  function renderizarPreviaImportacao(){
    var thead = document.getElementById("importPreviewCabecalho");
    var tbody = document.getElementById("importPreviewCorpo");

    thead.innerHTML = CAMPOS_IMPORTAVEIS.map(function(campo){
      return "<th>" + ROTULO_CAMPO_IMPORT[campo].replace(" (obrigatório)", "") + "</th>";
    }).join("");

    tbody.innerHTML = estadoImport.linhas.slice(0, 5).map(function(linha){
      return "<tr>" + CAMPOS_IMPORTAVEIS.map(function(campo){
        return "<td>" + (Core.escaparHtml(pegarValorMapeado(linha, campo)) || "-") + "</td>";
      }).join("") + "</tr>";
    }).join("");

    var total = estadoImport.linhas.length;
    var idxMarca = estadoImport.mapeamento.marca;
    var validas = idxMarca === -1 ? 0 : estadoImport.linhas.filter(function(l){ return String(l[idxMarca] || "").trim() !== ""; }).length;

    var resumo = document.getElementById("importResumoLinhas");
    resumo.className = "faixa " + (validas ? "faixa-ok" : "faixa-erro");
    resumo.textContent = total + " linha" + (total === 1 ? "" : "s") + " encontrada" + (total === 1 ? "" : "s") + " no arquivo. " +
      (validas
        ? (validas + " ser" + (validas === 1 ? "á" : "ão") + " importada" + (validas === 1 ? "" : "s") + " (veja o preview abaixo).")
        : "Nenhuma linha tem a coluna \"Marca\" preenchida — escolha a coluna certa acima.");

    document.getElementById("btnConfirmarImportacao").disabled = !validas;
  }

  async function confirmarImportacao(){
    var idxMarca = estadoImport.mapeamento.marca;
    if (idxMarca === -1){
      document.getElementById("importErro").textContent = "Escolha qual coluna tem o nome da marca antes de importar.";
      return;
    }

    var registros = [];
    var ignoradas = 0;
    estadoImport.linhas.forEach(function(linha){
      var marca = pegarValorMapeado(linha, "marca");
      if (!marca){ ignoradas++; return; }
      registros.push({
        marca: marca,
        instagram: pegarValorMapeado(linha, "instagram") || null,
        telefone: pegarValorMapeado(linha, "telefone") || null,
        email: pegarValorMapeado(linha, "email") || null,
        situacao: normalizarSituacaoImport(pegarValorMapeado(linha, "situacao")),
        obs: pegarValorMapeado(linha, "obs") || null,
        ultimo_contato: normalizarDataImport(pegarValorMapeado(linha, "ultimo_contato"))
      });
    });

    if (!registros.length){
      document.getElementById("importErro").textContent = "Nenhuma linha válida pra importar.";
      return;
    }

    var botao = document.getElementById("btnConfirmarImportacao");
    var textoOriginal = botao.textContent;
    botao.disabled = true;
    document.getElementById("importErro").textContent = "";

    var TAMANHO_LOTE = 200;
    var importadas = 0;
    var falhou = false;

    for (var i = 0; i < registros.length; i += TAMANHO_LOTE){
      var lote = registros.slice(i, i + TAMANHO_LOTE);
      botao.textContent = "Importando " + Math.min(i + TAMANHO_LOTE, registros.length) + "/" + registros.length + "...";
      var resultado = await Core.consultar(window.db.from("marcas").insert(lote), "marcas (importação)");
      if (resultado.erro){ falhou = true; break; }
      importadas += lote.length;
    }

    botao.textContent = textoOriginal;
    botao.disabled = false;

    if (falhou){
      document.getElementById("importErro").textContent = importadas > 0
        ? importadas + " marcas foram importadas antes de um erro acontecer. Veja o aviso no topo da página."
        : "Não consegui importar. Veja o aviso no topo da página pra saber o que houve.";
      await carregar();
      return;
    }

    await carregar();
    document.getElementById("importPasso2").style.display = "none";
    document.getElementById("importPasso3").style.display = "";
    document.getElementById("importSucessoTexto").textContent =
      importadas + " marca" + (importadas === 1 ? "" : "s") + " importada" + (importadas === 1 ? "" : "s") + " com sucesso!" +
      (ignoradas ? (" " + ignoradas + " linha" + (ignoradas === 1 ? "" : "s") + " foi" + (ignoradas === 1 ? "" : "ram") + " ignorada" + (ignoradas === 1 ? "" : "s") + " por não ter o nome da marca.") : "");
  }

  function baixarModeloCsv(){
    Core.baixarCSV(
      "modelo-marcas.csv",
      ["Marca", "Instagram", "Telefone", "E-mail", "Situação", "Observação", "Último contato"],
      [["[Exemplo] Empresa Fictícia", "@exemplo", "(11) 91234-5678", "contato@exemplo.com", "Lead", "Vim da planilha de prospecção", "01/01/2026"]]
    );
  }

  function configurarImportacao(){
    document.getElementById("btnImportarMarcas").addEventListener("click", abrirImportacao);
    document.getElementById("arquivoCsvMarcas").addEventListener("change", lidarComArquivoCsv);
    document.getElementById("btnTrocarArquivoCsv").addEventListener("click", resetarImportacao);
    document.getElementById("btnConfirmarImportacao").addEventListener("click", confirmarImportacao);
    document.getElementById("btnBaixarModeloCsv").addEventListener("click", baixarModeloCsv);
    document.getElementById("importMapeamento").addEventListener("change", function(e){
      var campo = e.target.getAttribute("data-campo-import");
      if (!campo) return;
      estadoImport.mapeamento[campo] = e.target.value === "" ? -1 : Number(e.target.value);
      renderizarPreviaImportacao();
    });
  }

  function configurar(){
    document.getElementById("btnNovaMarca").addEventListener("click", abrirNova);
    document.getElementById("btnBaixarMarcas").addEventListener("click", baixarCsv);
    document.getElementById("buscaMarcas").addEventListener("input", renderizarTabela);
    document.getElementById("filtroSituacao").addEventListener("change", renderizarTabela);
    configurarImportacao();
    document.getElementById("btnApagarMarca").addEventListener("click", async function(){
      var id = document.getElementById("marcaId").value;
      if (!id) return;
      Core.fecharModal("modalMarca");
      await apagarMarca(id);
    });

    document.getElementById("formMarca").addEventListener("submit", async function(e){
      e.preventDefault();
      var id = document.getElementById("marcaId").value;
      var dados = {
        marca: document.getElementById("marcaNome").value.trim(),
        instagram: document.getElementById("marcaInstagram").value.trim(),
        telefone: document.getElementById("marcaTelefone").value.trim(),
        email: document.getElementById("marcaEmail").value.trim(),
        situacao: document.getElementById("marcaSituacao").value,
        ultimo_contato: document.getElementById("marcaUltimoContato").value || null,
        obs: document.getElementById("marcaObs").value.trim()
      };
      var erroCaixa = document.getElementById("erroMarca");
      erroCaixa.textContent = "";

      var resultado;
      if (id){
        resultado = await Core.consultar(window.db.from("marcas").update(dados).eq("id", id), "marcas");
      } else {
        resultado = await Core.consultar(window.db.from("marcas").insert(dados), "marcas");
      }
      if (resultado.erro){
        erroCaixa.textContent = "Não deu pra salvar. Confira os campos e tente de novo.";
        return;
      }
      Core.fecharModal("modalMarca");
      await carregar();
    });
  }

  configurar();

  return { carregar: carregar };
})();
