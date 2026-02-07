// 1. Variáveis Globais (Sincronizadas com o Banco)
let vendas = [];
let valorEmCaixa = 0; // Agora inicia em 0 e carrega do banco

// URL da API (Render)
const API_URL = "https://perfume-api-zs6w.onrender.com/vendas";
const CAIXA_URL = "https://perfume-api-zs6w.onrender.com/caixa"; // Nova URL para o Caixa

// 2. Carregar Vendas e Caixa ao Iniciar
async function carregarDadosIniciais() {
  try {
    // Busca Vendas e Caixa simultaneamente
    const [resVendas, resCaixa] = await Promise.all([
      fetch(API_URL),
      fetch(CAIXA_URL),
    ]);

    vendas = await resVendas.json();
    const caixaData = await resCaixa.json();
    valorEmCaixa = caixaData.total; // Pega o valor total salvo no banco

    console.log("Dados carregados do MongoDB");
    renderizarCaixa();
  } catch (error) {
    console.error("Erro ao carregar do servidor:", error);
  }
}

// 3. Registrar Nova Venda
document.getElementById("form-venda").addEventListener("submit", async (e) => {
  e.preventDefault();

  const novaVenda = {
    cliente: document.getElementById("cliente").value,
    perfume: document.getElementById("perfume").value,
    valorOriginal: parseFloat(document.getElementById("valor").value),
    valor: parseFloat(document.getElementById("valor").value),
    status: "pendente",
  };

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(novaVenda),
    });

    if (response.ok) {
      alert("Venda salva no MongoDB!");
      e.target.reset();
      carregarDadosIniciais();
    }
  } catch (error) {
    alert("Erro ao salvar no servidor.");
  }
});

// 4. Navegação entre telas
function navegar(pagina) {
  document
    .getElementById("tela-vendas")
    .classList.toggle("hidden", pagina !== "vendas");
  document
    .getElementById("tela-caixa")
    .classList.toggle("hidden", pagina !== "caixa");
  if (pagina === "caixa") renderizarCaixa();
}

// 5. Desenhar os cards e atualizar contadores
function renderizarCaixa() {
  const lista = document.getElementById("lista-pendentes");
  const displayPendente = document.getElementById("total-pendente");
  const displayCaixa = document.getElementById("valor-caixa-dia");

  // Pega o que foi digitado (em letras minúsculas para não ter erro)
  const termoBusca =
    document.getElementById("filtro-cliente")?.value.toLowerCase() || "";

  // Filtra as vendas: primeiro por status 'pendente', depois pelo nome do cliente
  const pendentes = vendas.filter((v) => {
    const correspondeStatus = v.status === "pendente";
    const correspondeNome = v.cliente.toLowerCase().includes(termoBusca);
    return correspondeStatus && correspondeNome;
  });
  const totalPendente = pendentes.reduce((acc, v) => acc + v.valor, 0);

  if (displayPendente)
    displayPendente.innerText = totalPendente.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

  if (displayCaixa)
    displayCaixa.innerText = valorEmCaixa.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

  if (pendentes.length === 0) {
    lista.innerHTML =
      '<div class="text-center py-10 text-gray-400 font-medium italic">Tudo recebido! 🙌</div>';
  } else {
    lista.innerHTML = pendentes
      .map((v) => {
        const totalOriginal = v.valorOriginal || v.valor;
        return `
          <div class="bg-white p-4 rounded-2xl shadow-sm border-l-4 border-amber-500 mb-4">
              <div class="flex justify-between items-start">
                  <div>
                      <p class="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">● Pendente</p>
                      <p class="text-[11px] font-bold text-gray-400 uppercase leading-none">${
                        v.cliente
                      }</p>
                      <h3 class="font-bold text-gray-800 text-lg leading-tight">${
                        v.perfume
                      }</h3>
                  </div>
                  <div class="text-right">
                      <p class="text-[9px] font-bold text-gray-400 uppercase leading-none italic">Valor Total</p>
                      <p class="text-xs font-bold text-gray-500 font-mono italic">R$ ${totalOriginal.toFixed(
                        2
                      )}</p>
                  </div>
              </div>
              <div class="flex justify-between items-center mt-4">
                  <div class="bg-amber-50 px-3 py-2 rounded-xl border border-amber-100">
                      <p class="text-[9px] text-amber-700 font-black uppercase tracking-tighter leading-none">Falta Receber:</p>
                      <p class="text-xl font-black text-amber-800 font-mono leading-none mt-1 italic">R$ ${v.valor.toFixed(
                        2
                      )}</p>
                  </div>
                  <button onclick="confirmarRecebimento('${v._id}', ${
          v.valor
        })" 
                      class="bg-indigo-600 text-white px-4 py-2 rounded-xl font-black text-[11px] shadow-md uppercase active:scale-95 transition-all">
                      Abater<br>Pago
                  </button>
              </div>
          </div>`;
      })
      .join("");
  }
}

// 6. Função de Abatimento (Atualiza Venda e Caixa no Banco)
async function confirmarRecebimento(id, valorDevido) {
  const inputValor = prompt(
    `Valor atual: R$ ${valorDevido.toFixed(2)}\nQuanto está sendo pago?`,
    valorDevido.toFixed(2)
  );

  if (inputValor === null || inputValor === "") return;
  const valorPago = parseFloat(inputValor.replace(",", "."));

  if (isNaN(valorPago) || valorPago <= 0 || valorPago > valorDevido + 0.01) {
    alert("Valor inválido!");
    return;
  }

  const novoValorRestante = valorDevido - valorPago;
  const novoStatus = novoValorRestante < 0.01 ? "pago" : "pendente";

  try {
    // Enviamos o valorPago para o banco atualizar o caixa lá também
    const response = await fetch(`${API_URL}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        valor: novoValorRestante,
        status: novoStatus,
        valorPago: valorPago, // O Back-end usará isso para somar no caixa
      }),
    });

    if (response.ok) {
      alert(
        novoStatus === "pago"
          ? "Pagamento total!"
          : `Recebido R$ ${valorPago.toFixed(2)}`
      );
      carregarDadosIniciais();
    }
  } catch (error) {
    alert("Erro de conexão com o servidor.");
  }
}

// 7. Zerar o Saldo em Caixa (No Banco)
async function zerarCaixa() {
  if (confirm("Zerar o caixa em todos os aparelhos simultaneamente?")) {
    try {
      await fetch(`${CAIXA_URL}/zerar`, { method: "POST" });
      carregarDadosIniciais();
    } catch (error) {
      alert("Erro ao zerar caixa.");
    }
  }
}

// Inicialização total
carregarDadosIniciais();
