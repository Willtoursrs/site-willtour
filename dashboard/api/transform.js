// Transforma as respostas cruas das APIs (Pax Pro e Agendor) nos registros
// do dashboard. Sem dependencias de Node: roda no navegador e no
// atualizar_dashboard.js.

const PRODUCT_LABELS = {
  AIRFARE: 'Passagem aérea', BUS: 'Rodoviário', CAR_RENTAL: 'Aluguel de veículo',
  DAILY_HOSTING: 'Diária de hospedagem', OTHER: 'Outros', TICKET: 'Ingresso',
  TOUR_PACKAGE: 'Pacote turístico', TRAVEL_INSURANCE: 'Seguro viagem',
};

// Operadoras/consolidadoras reais (nao itens de despesa avulsa tipo "Receita
// Federal do Brasil", "Starbucks" etc que tambem aparecem como fornecedor
// quando a venda tem reembolso de despesa embutido).
const KNOWN_OPERATORS = [
  'Orinter Tour & Travel', 'Tyller Passagens', 'TP Air',
  'GTA - Global Travel Assistance', 'Bedsonline', 'Oner Travel',
  'Asia Top Travel', 'Mondee Consolidadora', 'JEL - Van Transportes Turisticos',
  'Parque Beto Carrero World',
];

const CITY_BY_CODE = {
  ADD: 'Adis Abeba', AEP: 'Buenos Aires', AMS: 'Amsterdã', AQP: 'Arequipa',
  ARN: 'Estocolmo', BEL: 'Belém', BER: 'Berlim', BPS: 'Porto Seguro',
  BSB: 'Brasília', BUD: 'Budapeste', BYO: 'Bonito', CGB: 'Cuiabá',
  CGH: 'São Paulo', CGR: 'Campo Grande', CNF: 'Belo Horizonte',
  CPV: 'Campina Grande', CWB: 'Curitiba', EZE: 'Buenos Aires', FCO: 'Roma',
  FLN: 'Florianópolis', FOR: 'Fortaleza', FRA: 'Frankfurt',
  GIG: 'Rio de Janeiro', GOT: 'Gotemburgo', GRU: 'São Paulo', HAN: 'Hanói',
  IGU: 'Foz do Iguaçu', JFK: 'Nova York', LHR: 'Londres', LIM: 'Lima',
  LIN: 'Milão', MAD: 'Madri', MCZ: 'Maceió', MXP: 'Milão', NAT: 'Natal',
  NVT: 'Navegantes', ORK: 'Cork', POA: 'Porto Alegre', PRG: 'Praga',
  REC: 'Recife', SCL: 'Santiago', SSA: 'Salvador', TOS: 'Tromsø',
  VCP: 'Campinas', VIX: 'Vitória',
};

// ---------- utilitarios ----------

const round2 = (n) => Math.round(n * 100) / 100;
const cidade = (code) => CITY_BY_CODE[code] || code;
const isoDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// '24/03/2025 10:00:00' ou '24/03/2025' -> Date (ou null)
function parseBR(v) {
  const m = (v || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
}

function operadoraFrom(nomes) {
  const entries = nomes.map((e) => e.trim()).filter(Boolean);
  for (const e of entries) {
    const known = KNOWN_OPERATORS.find((k) => k.toLowerCase() === e.toLowerCase());
    if (known) return known;
  }
  return entries[0] || '-';
}

// Encadeia os trechos de uma metade da viagem (ida ou volta), mas so continua
// enquanto o trecho seguinte sair no MESMO DIA do primeiro (conexao) - se a
// proxima perna so sai no dia seguinte (parada mais longa), para ali. Ex:
// GRU-LHR (dia 1) + LHR-ORK (dia 2) mostra so GRU-LHR.
function chainRoute(legs) {
  if (!legs.length) return '-';
  const base = isoDate(legs[0].dt);
  const chain = [legs[0]];
  for (const l of legs.slice(1)) {
    if (isoDate(l.dt) !== base) break;
    chain.push(l);
  }
  return [chain[0].orig, ...chain.map((l) => l.dest)].join('-');
}

// Divide os trechos (ja em ordem cronologica) em duas metades - ida e volta -
// por posicao, nao por data (a data de retorno as vezes e a de CHEGADA do
// ultimo trecho, um dia depois em voo noturno).
function idaVolta(legs) {
  const half = Math.floor(legs.length / 2);
  return half ? [legs.slice(0, half), legs.slice(half)] : [legs, []];
}

// Destino real = ponto de "virada" (meio da ida-e-volta), nao o ultimo trecho:
// SP -> Recife -> Campina Grande -> Recife -> SP tem destino Campina Grande.
const destinoFrom = (legs) => (legs.length ? cidade(legs[Math.floor((legs.length - 1) / 2)].dest) : '-');

function embarquesFrom(legs, base) {
  const out = [];
  const [ida, volta] = idaVolta(legs);
  if (ida.length) out.push({ data: isoDate(ida[0].dt), tipo: 'Embarque', ...base, rota: chainRoute(ida) });
  if (volta.length) out.push({ data: isoDate(volta[0].dt), tipo: 'Retorno', ...base, rota: chainRoute(volta) });
  return out;
}

function legsFromProduto(p) {
  return (p.itinerario || [])
    .map((t) => ({
      dt: parseBR(t.dataSaida),
      orig: (t.origem || '').slice(0, 3).toUpperCase(),
      dest: (t.destino || '').slice(0, 3).toUpperCase(),
    }))
    .filter((l) => l.dt && l.orig && l.dest)
    .sort((a, b) => a.dt - b.dt);
}

// vendas/clientes/fornecedores/statusLbl = respostas da API do Pax Pro;
// financeiro = Map(vendaId -> resposta de /venda/{id}/financeiro).
export function buildPaxpro({ statusLbl, clientes: clientesList, fornecedores: fornList, vendas, financeiro }) {
  const clientes = new Map(clientesList.map((c) => [c.id, (c.nome || '').trim()]));
  const fornecedores = new Map(fornList.map((f) => [f.id, (f.nomeEmpresa || '').trim()]));
  const sales = [];
  const embarques = [];
  const seen = new Set();
  let excluidas = 0;

  for (const v of vendas) {
    if (seen.has(v.id)) continue;
    seen.add(v.id);
    const produtos = (v.produtos || []).filter((p) => p.ativo !== false);
    const cliente = clientes.get(v.clienteResponsavelCompra) || '';
    const paxIds = [...new Set(produtos.flatMap((p) => (p.viajantes || []).map((vj) => vj.clienteId)))];
    const paxNames = paxIds.map((id) => clientes.get(id)).filter(Boolean);
    const fornNames = produtos.map((p) => fornecedores.get(p.fornecedorId) || '');
    const cias = produtos.map((p) => (p.companhia?.nome || '').trim());

    // Chargeback e venda de teste nunca contam (faturamento nem embarques).
    const campos = [cliente, v.nomeVenda || '', ...paxNames, ...fornNames, ...cias].join(' ').toLowerCase();
    if (campos.includes('chargeback') || campos.includes('teste')) { excluidas++; continue; }
    const dt = parseBR(v.dataVenda);
    if (!dt) continue;

    const labels = [...new Set(produtos.map((p) => PRODUCT_LABELS[p.produto] || 'Outros'))];
    if (!labels.length) labels.push('Outros');

    // Companhia AEREA (so informativa); o faturamento vai pra operadora.
    const aereos = produtos.filter((p) => p.produto === 'AIRFARE');
    const companhia = (aereos[0]?.companhia?.nome || '').trim() || '-';
    const legs = aereos.flatMap(legsFromProduto).sort((a, b) => a.dt - b.dt);

    // Financeiro: a receber do cliente / a pagar ao fornecedor = parcelas
    // ainda nao pagas; pagamentos = total por forma de pagamento do cliente.
    let clienteRec = 0;
    let fornPag = 0;
    const pagamentos = {};
    const fin = financeiro.get(v.id);
    if (fin) {
      for (const pg of fin.pagamentoCliente || []) {
        const forma = pg.formaPagamento || 'Outros';
        pagamentos[forma] = round2((pagamentos[forma] || 0) + Number(pg.valorTotal || 0));
        clienteRec += (pg.parcelas || []).filter((x) => !x.pago).reduce((s, x) => s + Number(x.valor || 0), 0);
      }
      for (const pg of fin.pagamentoFornecedor || []) {
        fornPag += (pg.parcelas || []).filter((x) => !x.pago).reduce((s, x) => s + Number(x.valor || 0), 0);
      }
    }
    for (const k of Object.keys(pagamentos)) if (Math.abs(pagamentos[k]) <= 0.001) delete pagamentos[k];

    const vendaId = String(v.numero ?? v.id);
    const emb = parseBR(v.dataInicio);
    sales.push({
      id: vendaId,
      dt: isoDate(dt),
      emb: emb ? isoDate(emb) : '',
      cliente,
      passageiros: paxNames.length ? paxNames.join(' / ') : cliente,
      bruto: round2(Number(v.totalBruto || 0)),
      liquido: round2(Number(v.totalLiquido || 0)),
      receita: round2(Number(v.totalResultado || 0)),
      origem: '-', // a API do Pax Pro nao expoe a origem do cliente
      produtos: labels,
      produto_label: labels.length === 1 ? labels[0] : 'Pacote de viagem',
      status: String(v.status || '').split(',').filter(Boolean).map((s) => statusLbl[s.trim()] || s.trim()).join(', '),
      nome_venda: (v.nomeVenda || '').trim(),
      companhia,
      operadora: operadoraFrom(fornNames),
      destino: destinoFrom(legs),
      cliente_rec: round2(clienteRec),
      forn_pag: round2(-fornPag),
      pagamentos,
    });

    // Embarques: cada passagem aerea vira ida + volta.
    for (const p of aereos) {
      const nomes = (p.viajantes || []).map((vj) => clientes.get(vj.clienteId)).filter(Boolean);
      embarques.push(...embarquesFrom(legsFromProduto(p), {
        venda: vendaId,
        companhia: (p.companhia?.nome || '').trim() || '-',
        passageiros: nomes.join(', ') || '-',
        destino: destinoFrom(legsFromProduto(p)),
      }));
    }
  }

  sales.sort((a, b) => a.dt.localeCompare(b.dt) || a.id.localeCompare(b.id));
  embarques.sort((a, b) => a.data.localeCompare(b.data) || a.tipo.localeCompare(b.tipo));
  return { sales, embarques, excluidas };
}

export function buildNegocios(people, deals) {
  // "Origem do cliente" vive na PESSOA (leadOrigin), nao no negocio.
  const origemByPerson = new Map(people.filter((p) => p.leadOrigin).map((p) => [p.id, p.leadOrigin.name]));
  const isoz = (v) => (v ? v.slice(0, 10) : null);

  const negocios = [];
  for (const d of deals) {
    const etapa = d.dealStage?.name || '';
    const funil = d.dealStage?.funnel?.name || '';
    if (funil !== 'Leads' && funil !== 'Orçamentos') continue;
    const origem = origemByPerson.get(d.person?.id) || '-';
    // Barbearia e parceria, nao processo comercial da agencia.
    if (etapa.toLowerCase().includes('barbearia') || origem.toLowerCase().includes('barbearia')) continue;
    negocios.push({
      codigo: d.id,
      pessoa: d.person?.name || '-',
      titulo: d.title || '-',
      responsavel: d.owner?.name || '-',
      funil,
      etapa,
      status: d.dealStatus?.name || '',
      valor: Number(d.value || 0),
      dt_cadastro: isoz(d.createdAt),
      dt_conclusao: isoz(d.wonAt || d.lostAt),
      origem,
      motivo_perda: d.lossReason?.name ?? null,
    });
  }
  negocios.sort((a, b) => (a.dt_cadastro || '').localeCompare(b.dt_cadastro || ''));
  return negocios;
}
