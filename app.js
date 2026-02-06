// 1. Variáveis Globais (Essenciais para o funcionamento)
let vendas = [];
let valorEmCaixa = parseFloat(localStorage.getItem("caixa_dia")) || 0;

// IMPORTANTE: Se for testar no celular, troque 'localhost' pelo seu IP (ex: 192.168.1.100)
const API_URL = "https://perfume-api-zs6w.onrender.com/vendas";

// const API_URL = "http://192.168.1.100:3000/vendas";

// 2. Carregar do Banco ao Iniciar
async function carregarVendas() {
  try {
    const response = await fetch(API_URL);
    vendas = await response.json();
    console.log("Vendas vindas do MongoDB:", vendas);
    renderizarCaixa();
  } catch (error) {
    console.error("Erro ao carregar do servidor:", error);
  }
}

// 3. Registrar Nova Venda (Versão limpa para o Banco de Dados)
document.getElementById("form-venda").addEventListener("submit", async (e) => {
  e.preventDefault();

  // No EventListener do formulário de venda
  const novaVenda = {
    cliente: document.getElementById("cliente").value,
    perfume: document.getElementById("perfume").value,
    valorOriginal: parseFloat(document.getElementById("valor").value), // Fixo para sempre
    valor: parseFloat(document.getElementById("valor").value), // Esse vai diminuir
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
      carregarVendas(); // Recarrega a lista para mostrar o novo card
    }
  } catch (error) {
    alert("Erro ao salvar. O servidor Node está rodando?");
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

  const pendentes = vendas.filter((v) => v.status === "pendente");
  const totalPendente = pendentes.reduce((acc, v) => acc + v.valor, 0);

  // Atualiza os contadores no topo
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
        // Garantia de que o valorOriginal não seja undefined
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
  
              <button onclick="confirmarRecebimento('${v._id}', ${v.valor})" 
                  class="bg-indigo-600 text-white px-4 py-2 rounded-xl font-black text-[11px] shadow-md uppercase active:scale-95 transition-all">
                  Abater<br>Pago
              </button>
          </div>
      </div>
  `;
      })
      .join("");
  }
}

// 6. Função de Abatimento (Paga ou diminui valor)
async function confirmarRecebimento(id, valorDevido) {
  // 1. Pergunta quanto a cliente está pagando
  const inputValor = prompt(
    `Valor atual da dívida: R$ ${valorDevido.toFixed(
      2
    )}\nQuanto a cliente está pagando agora?`,
    valorDevido.toFixed(2)
  );

  // Se cancelar ou não digitar nada, para a função
  if (inputValor === null || inputValor === "") return;

  // Converte vírgula para ponto e transforma em número
  const valorPago = parseFloat(inputValor.replace(",", "."));

  // Validações básicas
  if (isNaN(valorPago) || valorPago <= 0) {
    alert("Por favor, digite um valor válido.");
    return;
  }

  if (valorPago > valorDevido + 0.01) {
    // Margem de erro de centavos
    alert("O valor pago não pode ser maior que a dívida!");
    return;
  }

  // Calcula o que sobra e o novo status
  const novoValorRestante = valorDevido - valorPago;
  const novoStatus = novoValorRestante < 0.01 ? "pago" : "pendente";

  try {
    // 2. Envia para o Back-end (MongoDB) - ATENÇÃO: Enviamos apenas o novo SALDO
    const response = await fetch(`${API_URL}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        valor: novoValorRestante,
        status: novoStatus,
      }),
    });

    if (response.ok) {
      // 3. Atualiza o Dinheiro em Caixa (Soma o que entrou agora)
      valorEmCaixa += valorPago;
      localStorage.setItem("caixa_dia", valorEmCaixa.toString());

      // 4. Feedback visual e recarrega a lista do banco
      if (novoStatus === "pago") {
        alert("Pagamento total recebido! Venda finalizada.");
      } else {
        alert(
          `Recebido R$ ${valorPago.toFixed(
            2
          )}. Ainda faltam R$ ${novoValorRestante.toFixed(2)}`
        );
      }

      carregarVendas(); // Essa função busca os dados novos do MongoDB e redesenha os cards
    } else {
      alert("Erro ao salvar no banco de dados. Tente novamente.");
    }
  } catch (error) {
    console.error("Erro na comunicação com o servidor:", error);
    alert("Erro de conexão. O servidor Node está ligado?");
  }
}

// 7. Zerar o Saldo em Caixa
function zerarCaixa() {
  if (
    confirm(
      "Deseja zerar o valor do caixa hoje? (Vendas pendentes continuam guardadas)"
    )
  ) {
    valorEmCaixa = 0;
    localStorage.setItem("caixa_dia", "0");
    renderizarCaixa();
  }
}

// Inicialização
carregarVendas();
