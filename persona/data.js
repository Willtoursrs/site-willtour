// Dados da persona AO VIVO: o navegador chama o Pax Pro direto (mesma chave e
// mesmas regras do dashboard). Cliente vem de GET /cliente; compra, de quem
// viajou em cada venda (produtos[].viajantes[].clienteId).
const V = new URL(import.meta.url).search; // ?v=... do index.html (anti-cache)
const { PAXPRO_CODE } = await import(`../dashboard/chaves.local.js${V}`);
const { idade, faixa, sexo } = await import(`../dashboard/clientes.js${V}`);

const BASE = 'https://app.paxpro.com.br';
const PRIMEIRO_ANO = 2025;

const semAcento = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// O Pax Pro tem cliente duplicado com outro id: a pessoa e identificada pelo nome.
const chavePessoa = (nome) => semAcento(nome).replace(/\s+/g, ' ').trim();

async function apiGet(token, path, params, tentativa = 0) {
  const res = await fetch(`${BASE}${path}?${new URLSearchParams(params)}`, { headers: { Authentication: token } });
  if (res.status === 429 && tentativa < 5) { // limite de requisicoes por segundo
    await new Promise((r) => setTimeout(r, 1000 + 300 * tentativa));
    return apiGet(token, path, params, tentativa + 1);
  }
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

async function todasPaginas(token, path, params = {}) {
  const lista = [];
  for (let page = 1; ; page++) {
    const d = await apiGet(token, path, { ...params, page });
    lista.push(...(d.data || []));
    if (page >= (d.totalPages || 1)) return lista;
  }
}

// Teste/chargeback nao sao venda (regra do dashboard); cancelada e orcamento tambem nao.
const ehVenda = (v) => !/teste|chargeback/.test(semAcento(v.nomeVenda)) && !/CANCEL|ESTIMATE/.test(v.status || '');
const valorViajante = (vj) => Number(vj.taxasCliente?.totalBruto || 0);

const dataHora = (s) => {
  const m = (s || '').match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})/);
  return m ? Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]) : 0;
};

// O campo destino so diz Nacional/Internacional. O destino real vem do itinerario:
// o aeroporto onde o passageiro fica mais tempo (conexao fica de fora); so ida = ultimo trecho.
function destinoFinal(itinerario) {
  const voos = [...(itinerario || [])].sort((a, b) => dataHora(a.dataSaida) - dataHora(b.dataSaida));
  if (!voos.length) return null;
  let parada = voos[voos.length - 1];
  let maior = -1;
  for (let i = 0; i < voos.length - 1; i++) {
    const tempo = dataHora(voos[i + 1].dataSaida) - dataHora(voos[i].dataChegada);
    if (tempo > maior) { maior = tempo; parada = voos[i]; }
  }
  return (parada.destino || '').replace(/^[A-Z0-9]{3} - /, '').replace(/\s*(International\s+)?Airport\s*$/i, '').trim() || null;
}

export async function carregarDados() {
  const login = await fetch(`${BASE}/noauth/v1/login`, { headers: { 'agency-api-code': PAXPRO_CODE } });
  if (!login.ok) throw new Error(`login: HTTP ${login.status}`);
  const { token } = await login.json();

  const hoje = new Date();
  const clientes = await todasPaginas(token, '/api/v1/agencia/cliente');
  const todas = await todasPaginas(token, '/api/v1/agencia/venda', {
    dataInicio: `01/01/${PRIMEIRO_ANO}`, dataFim: `31/12/${hoje.getFullYear() + 2}`,
  });
  const vendas = todas.filter(ehVenda);

  const pf = new Map(clientes.filter((c) => c.tipoPessoa !== 'PJ').map((c) => [c.id, c]));
  const pessoas = new Map();
  const destinos = new Map();
  const cruzadas = [];

  for (const v of vendas) {
    const naVenda = new Set();
    for (const p of (v.produtos || []).filter((x) => x.ativo !== false)) {
      const d = p.produto === 'AIRFARE' ? destinoFinal(p.itinerario) : null;
      if (d) destinos.set(d, (destinos.get(d) || 0) + 1);
      for (const vj of p.viajantes || []) {
        const c = pf.get(vj.clienteId);
        if (!c) continue;
        const k = chavePessoa(c.nome);
        if (!pessoas.has(k)) pessoas.set(k, { nome: c.nome.trim(), genero: sexo(c.nome), idade: null, faixa: null, bruto: 0, vendas: 0 });
        const pessoa = pessoas.get(k);
        pessoa.bruto += valorViajante(vj);
        pessoa.idade ??= idade(c.dataNascimento); // duplicado pode ter so um dos cadastros com data
        pessoa.faixa = faixa(pessoa.idade);
        if (!naVenda.has(k)) { naVenda.add(k); pessoa.vendas++; }
      }
    }
    if (naVenda.size) cruzadas.push(v);
  }

  return {
    PEOPLE: [...pessoas.values()],
    DESTINOS: [...destinos].map(([nome, count]) => ({ nome, count })).sort((a, b) => b.count - a.count),
    STATS: {
      totalVendas: vendas.length,
      vendasCruzadas: cruzadas.length,
      vendasNaoCruzadas: vendas.length - cruzadas.length,
      brutoCruzado: cruzadas.reduce((s, v) => s + Number(v.totalBruto || 0), 0),
      clientesUnicos: pessoas.size,
      totalContatosClient: new Set([...pf.values()].map((c) => chavePessoa(c.nome))).size,
      geradoEm: hoje.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
    },
  };
}
