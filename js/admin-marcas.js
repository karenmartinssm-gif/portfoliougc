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

  function configurar(){
    document.getElementById("btnNovaMarca").addEventListener("click", abrirNova);
    document.getElementById("btnBaixarMarcas").addEventListener("click", baixarCsv);
    document.getElementById("buscaMarcas").addEventListener("input", renderizarTabela);
    document.getElementById("filtroSituacao").addEventListener("change", renderizarTabela);
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
