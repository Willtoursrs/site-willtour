// Aba Venda: GET /api/v1/agencia/venda (todas as paginas, com dataInicio e
// dataFim, que a API aceita), KPIs + grafico de faturamento por mes, tabela
// com busca por nome e paginacao no rodape; a seta ▸ abre os itens da venda.

const { buildPaxpro } = await import(`./api/transform.js${new URL(import.meta.url).search}`);

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const semAcento = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const fmtBRL = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const pad = (n) => String(n).padStart(2, '0');

const PRIMEIRO_ANO = 2025;
// Custo fixo mensal da agencia: loja fisica + capital de giro.
const CUSTO_MENSAL = { 'Loja física': 3000, 'Capital de giro': 2000 };
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// 'dd/MM/yyyy' -> 'yyyy-MM-dd' ('' se invalida)
const iso = (br) => {
  const m = (br || '').match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
};

// Tipos de produto: preenchido pelo GET /api/v1/agencia/produto (enum
// AIRFARE -> 'Passagem aérea' etc) ao abrir a aba.
let PRODUTO_LBL = {};
// id -> nome, de GET /fornecedor e GET /cliente (para o accordion dos produtos).
let FORNECEDORES = new Map();
let CLIENTES = new Map();
let LISTA_FORNECEDORES = [];
let LISTA_CLIENTES = [];
const nomeProduto = (tipo) => PRODUTO_LBL[tipo] || tipo;

// Colunas da tabela (pedido do Will): so estas, nesta ordem.
const COLUNAS = [
  ['numero', 'Nº'], ['nomeVenda', 'Nome da venda'], ['viajantes', 'Viajantes'],
  ['totalBruto', 'Faturamento'], ['totalResultado', 'Comissão'],
  ['dataVenda', 'Data da venda'], ['dataInicio', 'Data da viagem'], ['dataFim', 'Data da volta'],
];

// Viajantes distintos da venda: o mesmo cliente em aereo + hotel + transfer conta 1 vez.
// Conta pelo NOME normalizado (o Pax Pro tem cliente duplicado com outro id, ex.:
// "LEONARDO   DE FARIA GIGNON" 1546932 e 1546936); sem nome, usa o clienteId.
const chavePax = (id) => {
  const nome = CLIENTES.get(id);
  return nome ? semAcento(nome).replace(/\s+/g, ' ').trim() : `id:${id}`;
};
const qtdViajantes = (v) => new Set((v.produtos || []).filter((p) => p.ativo !== false)
  .flatMap((p) => (p.viajantes || []).map((vj) => chavePax(vj.clienteId)))).size;

function valorColuna(v, c) {
  if (c === 'viajantes') return qtdViajantes(v);
  if (c === 'totalBruto' || c === 'totalResultado') return v[c] == null ? null : Number(v[c]).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  return v[c];
}

// Linha extra (accordion) com os produtos da venda, um bloco por produto.
// Sem id/vendaId; fornecedorId vira o nome; viajantes viram so os nomes.
const OCULTOS_PRODUTO = new Set(['id', 'vendaId', 'ativo']);

function campoProduto(k, val) {
  if (k === 'produto') return `${esc(nomeProduto(val))} <small style="color:var(--ink-muted)">${esc(val)}</small>`;
  if (k === 'companhia') return celula(val?.nome);
  if (k === 'itinerario') {
    // Um voo por linha, em ordem de saida: voo, origem -> destino, saida e chegada.
    const dt = (x) => (x || '').replace(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}:\d{2}).*/, '$1/$2/$3 $4');
    const ord = (x) => (x || '').replace(/^(\d{2})\/(\d{2})\/(\d{4}) ?(.*)/, '$3$2$1 $4');
    const voos = [...(val || [])].sort((a, b) => ord(a.dataSaida).localeCompare(ord(b.dataSaida)));
    if (!voos.length) return celula(null);
    return `<table class="voos"><thead><tr><th>Voo</th><th>Trecho</th><th>Saída</th><th>Chegada</th></tr></thead><tbody>${voos.map((t) => {
      const cod = (x) => esc((x || '').split(' - ')[0]);
      return `<tr><td>${esc(t.voo || '—')}</td>
        <td title="${esc(t.origem)} → ${esc(t.destino)}">${cod(t.origem)} → ${cod(t.destino)}</td>
        <td>${dt(t.dataSaida)}</td><td>${dt(t.dataChegada)}</td></tr>`;
    }).join('')}</tbody></table>`;
  }
  if (k === 'viajantes') {
    const nomes = (val || []).map((vj) => CLIENTES.get(vj.clienteId) || `cliente ${vj.clienteId}`);
    return nomes.length ? nomes.map((n) => `<div>${esc(n)}</div>`).join('') : celula(null);
  }
  return celula(val);
}

function detalheProdutos(v, ncols) {
  const blocos = (v.produtos || []).map((p, n) => {
    // viajantes sempre primeiro, em qualquer servico
    const campos = Object.entries(p)
      .filter(([k]) => !OCULTOS_PRODUTO.has(k))
      .sort(([a], [b]) => (b === 'viajantes') - (a === 'viajantes'))
      .map(([k, val]) => (k === 'fornecedorId' ? ['fornecedor', FORNECEDORES.get(val) || val] : [k, val]));
    const titulo = p.tipoProduto || nomeProduto(p.produto);
    return `<div class="prod-bloco"><h4>${n + 1}. ${esc(titulo)}
      ${p.companhia?.nome ? `· ${esc(p.companhia.nome)}` : ''}</h4>
      <div class="prod-campos">${campos.map(([k, val]) =>
        `<div class="prod-campo${k === 'itinerario' ? ' largo' : ''}"><span>${esc(k)}</span><div>${campoProduto(k, val)}</div></div>`).join('')}</div></div>`;
  }).join('');
  return `<tr class="acc-linha"><td colspan="${ncols}"><div class="acc-conteudo">${blocos}</div></td></tr>`;
}

// Chargeback e venda de teste nao entram nos KPIs nem no grafico (mesma
// regra do painel antigo); na tabela aparecem todas.
const ehTeste = (v) => /teste|chargeback/.test(semAcento(v.nomeVenda));

function celula(v) {
  if (v == null || v === '') return '<span style="color:var(--ink-muted)">—</span>';
  if (typeof v !== 'object') return esc(v);
  if (Array.isArray(v) && v.every((x) => x == null || typeof x !== 'object')) return esc(v.join(', '));
  const n = Array.isArray(v) ? `${v.length} ${v.length === 1 ? 'item' : 'itens'}` : 'objeto';
  return `<details><summary>${n}</summary><div class="obj">${esc(JSON.stringify(v, null, 2))}</div></details>`;
}

// Receita - custo fixo (por mes do periodo): azul = sobrou, vermelho = faltou.
function custoCard(receita, meses) {
  const mensal = Object.values(CUSTO_MENSAL).reduce((a, b) => a + b, 0);
  const custo = mensal * meses;
  const saldo = receita - custo;
  return {
    label: saldo >= 0 ? 'Resultado no azul' : 'Resultado no vermelho',
    value: `${saldo >= 0 ? '+' : '−'}${fmtBRL(Math.abs(saldo))}`,
    sub: `receita − despesas do período (${fmtBRL(custo)})`,
    cls: saldo >= 0 ? 'azul' : 'vermelho',
  };
}

// Quadro "Despesas do período": lancamento por lancamento (1 por custo por
// mes do filtro), recolhivel. Hoje vem do custo fixo; depois, do Fluxo de caixa.
function lancamentosDespesa(deIso, meses) {
  if (!deIso || !meses) return [];
  let [a, m] = deIso.split('-').map(Number);
  const out = [];
  for (let i = 0; i < meses; i++) {
    for (const [desc, valor] of Object.entries(CUSTO_MENSAL)) out.push({ data: `01/${pad(m)}/${a}`, desc, valor });
    if (++m > 12) { m = 1; a++; }
  }
  return out;
}

function despesasPeriodo(deIso, meses, aberto) {
  const lanc = lancamentosDespesa(deIso, meses);
  const total = lanc.reduce((t, l) => t + l.valor, 0);
  const linhas = lanc.map((l) => `<tr><td>${l.data}</td><td>${esc(l.desc)}</td><td class="num">${fmtBRL(l.valor)}</td></tr>`).join('');
  return `<details class="desp card"${aberto ? ' open' : ''}>
    <summary><span class="desp-titulo">Despesas do período</span>
      <span class="desp-info">${lanc.length} lançamentos · <b>${fmtBRL(total)}</b></span></summary>
    ${lanc.length ? `<div class="tbl-wrap"><table class="api desp-tbl"><thead><tr><th>Data</th><th>Descrição</th><th class="num">Valor</th></tr></thead>
      <tbody>${linhas}</tbody></table></div>` : '<p class="meta-line">Nenhuma despesa no período.</p>'}
    <p class="hint">Custo fixo mensal por enquanto (integração com o Fluxo de caixa: depois).</p>
  </details>`;
}

// ---------- KPIs + grafico (mesmo visual do painel antigo) ----------

// Meses do periodo filtrado, ate o mes atual (mes futuro ainda nao tem custo).
function mesesPeriodo(deIso, ateIso) {
  if (!deIso || !ateIso) return 0;
  const hoje = new Date();
  const fimHoje = `${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}-31`;
  const fim = ateIso < fimHoje ? ateIso : fimHoje;
  if (fim < deIso) return 0;
  const [a1, m1] = deIso.split('-').map(Number);
  const [a2, m2] = fim.split('-').map(Number);
  return (a2 - a1) * 12 + (m2 - m1) + 1;
}

function kpis(vendas, meses) {
  const bruto = vendas.reduce((a, v) => a + Number(v.totalBruto || 0), 0);
  const receita = vendas.reduce((a, v) => a + Number(v.totalResultado || 0), 0);
  const clientes = new Set(vendas.map((v) => v.clienteResponsavelCompra)).size;
  return [
    { label: 'Faturamento bruto', value: fmtBRL(bruto), sub: `${vendas.length} ${vendas.length === 1 ? 'venda' : 'vendas'} · totalBruto`, cls: 'accent' },
    { label: 'Receita (comissão)', value: fmtBRL(receita), sub: bruto ? `${((receita / bruto) * 100).toFixed(1)}% do bruto · totalResultado` : '—' },
    { label: 'Ticket médio', value: fmtBRL(vendas.length ? bruto / vendas.length : 0), sub: 'por venda' },
    { label: 'Clientes', value: clientes, sub: 'clienteResponsavelCompra distintos' },
    custoCard(receita, meses),
  ].map((k) => `<div class="kpi ${k.cls || ''}"><div class="label">${k.label}</div><div class="value">${k.value}</div><div class="sub">${k.sub}</div></div>`).join('');
}

function grafico(vendas) {
  const porMes = {};
  for (const v of vendas) {
    const d = iso(v.dataVenda);
    if (!d) continue;
    const k = d.slice(0, 7);
    porMes[k] ??= { bruto: 0, receita: 0, n: 0 };
    porMes[k].bruto += Number(v.totalBruto || 0);
    porMes[k].receita += Number(v.totalResultado || 0);
    porMes[k].n++;
  }
  const data = Object.keys(porMes).sort().map((mes) => ({ mes, ...porMes[mes] }));
  const W = 1132, H = 300, padL = 64, padR = 16, padT = 34, padB = 40;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  if (!data.length) return `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" class="axis-muted">Sem vendas no período</text>`;

  const max = Math.max(...data.map((d) => d.bruto), 1);
  const passo = max > 200000 ? 50000 : max > 50000 ? 25000 : 10000;
  const topo = Math.max(Math.ceil(max / passo) * passo, passo);
  const bw = plotW / data.length;
  const base = padT + plotH;
  const MIN_REC = 16;
  let out = '';
  for (let i = 0; i <= 4; i++) {
    const v = (topo / 4) * i;
    const y = base - (v / topo) * plotH;
    out += `<line class="grid-line" x1="${padL}" x2="${W - padR}" y1="${y}" y2="${y}"/>`;
    out += `<text class="tick-label axis-muted" x="${padL - 10}" y="${y + 4}" text-anchor="end">${(v / 1000).toFixed(0)}k</text>`;
  }
  out += `<line x1="${padL}" x2="${W - padR}" y1="${base}" y2="${base}" stroke="var(--baseline)" stroke-width="1"/>`;
  data.forEach((d, i) => {
    const barW = Math.min(bw * 0.56, 64);
    const x = padL + i * bw + (bw - barW) / 2;
    let barH = (d.bruto / topo) * plotH;
    if (d.receita > 0 && barH < MIN_REC + 8) barH = MIN_REC + 8;
    let recH = (d.receita / topo) * plotH;
    if (d.receita > 0) recH = Math.max(recH, MIN_REC);
    recH = Math.max(Math.min(recH, barH - 2), 0);
    const [a, m] = d.mes.split('-');
    out += `<g class="bar-group" data-ano="${a}" data-mes="${+m}">`;
    out += `<rect x="${x - bw * 0.1}" y="${padT}" width="${barW + bw * 0.2}" height="${plotH + 16}" fill="transparent"/>`;
    out += `<rect class="bar" x="${x}" y="${base - barH}" width="${barW}" height="${Math.max(barH - recH + 3, 1)}" rx="3"/>`;
    out += `<rect class="bar-receita" x="${x}" y="${base - recH}" width="${barW}" height="${Math.max(recH, 1)}"/>`;
    if (d.receita > 0) {
      out += recH >= 15
        ? `<text class="bar-receita-label" x="${x + barW / 2}" y="${base - recH / 2 + 4}" text-anchor="middle">${fmtBRL(d.receita)}</text>`
        : `<text class="bar-receita-label out" x="${x + barW / 2}" y="${base - recH - 5}" text-anchor="middle">${fmtBRL(d.receita)}</text>`;
    }
    out += `<text class="bar-label" x="${x + barW / 2}" y="${base - barH - 8}" text-anchor="middle">${fmtBRL(d.bruto)}</text>`;
    out += `<text class="bar-sub" x="${x + barW / 2}" y="${base - barH - 22}" text-anchor="middle">${d.n} venda${d.n > 1 ? 's' : ''}</text>`;
    out += `<text class="tick-label axis-muted" x="${x + barW / 2}" y="${base + 20}" text-anchor="middle">${MES_CURTO[+m - 1]}/${a.slice(2)}</text>`;
    out += '</g>';
  });
  return out;
}

// ---------- resumos por produto ----------

// Valor do item = soma do totalBruto (taxasCliente) de cada viajante.
const valorProduto = (p) => (p.viajantes || []).reduce((a, vj) => a + Number(vj.taxasCliente?.totalBruto || 0), 0);

function resumo(vendas, chave, filtro = () => true) {
  const g = {};
  for (const v of vendas) {
    for (const p of (v.produtos || []).filter(filtro)) {
      const k = chave(p);
      g[k] ??= { itens: 0, vendas: new Set(), pax: 0, valor: 0 };
      g[k].itens++;
      g[k].vendas.add(v.id);
      g[k].pax += (p.viajantes || []).length;
      g[k].valor += valorProduto(p);
    }
  }
  return Object.entries(g).map(([k, x]) => ({ k, ...x, vendas: x.vendas.size })).sort((a, b) => b.valor - a.valor || b.itens - a.itens);
}

// Grafico de barras horizontais (valor bruto por categoria), uma cor por barra.
const CORES = ['var(--accent)', 'var(--sunset)', 'var(--aqua)', 'var(--violet)', 'var(--yellow)', 'var(--crit)', 'var(--good)', 'var(--ink-muted)'];

// metrica 'valor' (R$) ou 'itens' (quantidade vendida) define barra, ordem e destaque.
function graficoResumo(titulo, linhas, metrica = 'valor') {
  linhas = [...linhas].sort((a, b) => b[metrica] - a[metrica] || b.valor - a.valor);
  if (!linhas.length) return `<div class="card"><h3>${titulo}</h3><p class="meta-line">Sem itens no período.</p></div>`;
  const total = linhas.reduce((t, l) => t + l.valor, 0);
  const totalM = linhas.reduce((t, l) => t + l[metrica], 0);
  const max = Math.max(...linhas.map((l) => l[metrica]), 1);
  const pct = (l) => (totalM ? ((l[metrica] / totalM) * 100).toFixed(0) : 0);
  const nItens = (n) => `${n} ${n === 1 ? 'item' : 'itens'}`;
  const barras = linhas.map((l, i) => `
    <div class="hbar" title="${esc(l.k)}: ${fmtBRL(l.valor)} · ${l.itens} itens · ${l.vendas} vendas · ${l.pax} passageiros">
      <span class="hbar-nome">${esc(l.k)}</span>
      <span class="hbar-trilho"><span class="hbar-barra" style="width:${Math.max((l[metrica] / max) * 100, l[metrica] > 0 ? 1 : 0)}%;background:${CORES[i % CORES.length]}"></span></span>
      <span class="hbar-valor">${metrica === 'itens'
        ? `${nItens(l.itens)}<small>${pct(l)}% · ${fmtBRL(l.valor)}</small>`
        : `${fmtBRL(l.valor)}<small>${pct(l)}% · ${nItens(l.itens)}</small>`}</span>
    </div>`).join('');
  return `<div class="card"><h3>${titulo}</h3>
    <p class="hint">${metrica === 'itens' ? `Por quantidade de itens · ${totalM} itens · ${fmtBRL(total)}` : `Total ${fmtBRL(total)} · ${linhas.reduce((t, l) => t + l.itens, 0)} itens`} · ${linhas.reduce((t, l) => t + l.pax, 0)} passageiros</p>
    <div class="hbars">${barras}</div></div>`;
}

// ---------- rankings e ultimas vendas ----------

const dataCurta = (d) => d.split('-').reverse().join('/');
const linkVenda = (id) => `<a href="https://app.paxpro.com.br/sale?n=${esc(id)}" target="_blank" rel="noopener">${esc(id)}</a>`;

// Tabela com seta: abre as vendas de cada linha. comValor=false so conta vendas.
function ranking(titulo, nota, vendas, campo, rotulo, limite, comValor = true) {
  const grupos = {};
  for (const s of vendas) {
    if (!s[campo] || s[campo] === '-') continue;
    (grupos[s[campo]] ||= []).push(s);
  }
  const soma = (l) => l.reduce((a, s) => a + s.bruto, 0);
  const lista = Object.entries(grupos)
    .sort((a, b) => (comValor ? soma(b[1]) - soma(a[1]) : b[1].length - a[1].length)).slice(0, limite);
  const linhas = lista.map(([nome, l]) => `
    <tr class="rank-row"><td class="strong rank-name-cell"><span class="hbar-arrow">▸</span>${esc(nome)}</td><td class="num">${l.length}</td>${comValor ? `<td class="num strong">${fmtBRL(soma(l))}</td>` : ''}</tr>
    <tr class="rank-detail" hidden><td colspan="3"><div class="hbar-detail">${l.map((s) => `<div class="hbar-detail-item">${linkVenda(s.id)} <b>${dataCurta(s.dt)}</b> — ${esc(s.cliente)} — ${fmtBRL(s.bruto)}</div>`).join('')}</div></td></tr>`).join('');
  return `<div><div class="section-head"><h2>${titulo}</h2>${nota ? `<span class="section-note">${nota}</span>` : ''}</div>
    <div class="card table-wrap"><table>${lista.length
      ? `<thead><tr><th>${rotulo}</th><th class="num">Vendas</th>${comValor ? '<th class="num">Bruto acumulado</th>' : ''}</tr></thead><tbody>${linhas}</tbody>`
      : '<tbody><tr><td>Sem dados no período selecionado</td></tr></tbody>'}</table></div></div>`;
}

function ultimasVendas(vendas) {
  const linhas = [...vendas].sort((a, b) => b.dt.localeCompare(a.dt)).slice(0, 12).map((s) => `
    <tr><td class="strong">${dataCurta(s.dt)}</td><td class="num">${linkVenda(s.id)}</td><td>${esc(s.cliente)}</td><td>${esc(s.produto_label)}</td><td>${esc(s.destino)}</td>
      <td class="num">${fmtBRL(s.bruto)}</td><td class="num">${fmtBRL(s.receita)}</td><td class="num good-text">${(s.bruto ? (s.receita / s.bruto) * 100 : 0).toFixed(1)}%</td></tr>`).join('');
  return `<div class="section-head"><h2>Últimas vendas</h2><span class="section-note">pela data da venda</span></div>
    <div class="card table-wrap"><table><thead><tr><th>Data</th><th class="num">Venda nº</th><th>Cliente</th><th>Produto</th><th>Destino</th><th class="num">Bruto</th><th class="num">Receita</th><th class="num">Margem</th></tr></thead><tbody>${linhas}</tbody></table></div>`;
}

// ---------- aba ----------

export async function montarVendas(el, { apiGet, getLine }) {
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const anos = Array.from({ length: anoAtual - PRIMEIRO_ANO + 2 }, (_, i) => PRIMEIRO_ANO + i); // inclui o ano que vem (embarques futuros)
  const st = { ano: String(anoAtual), mes: '', busca: '', tam: 20, pag: 1 };
  let vendas = [];

  el.innerHTML = `
    <div class="sub-panel">
      <h2>Venda</h2>
      <form class="api-form filtros">
        <div class="filter-field"><label>Ano</label>
          <select name="ano"><option value="">Todos</option>${anos.map((a) => `<option${String(a) === st.ano ? ' selected' : ''}>${a}</option>`).join('')}</select></div>
        <div class="filter-field"><label>Trimestre</label>
          <select name="tri"><option value="">Todos</option>${[1, 2, 3, 4].map((t) => `<option value="${t}">${t}º trimestre</option>`).join('')}</select></div>
        <div class="filter-field"><label>Mês</label>
          <select name="mes"><option value="">Todos</option>${MESES.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('')}</select></div>
        <div class="filter-field"><label>dataInicio <span style="text-transform:none;color:var(--ink-muted)">dd/MM/yyyy</span></label>
          <input name="dataInicio" autocomplete="off"></div>
        <div class="filter-field"><label>dataFim <span style="text-transform:none;color:var(--ink-muted)">dd/MM/yyyy</span></label>
          <input name="dataFim" autocomplete="off"></div>
        <div class="filter-field"><label>Pesquisar por nome</label>
          <input name="busca" placeholder="Nome da venda ou consultor…" style="width:240px" autocomplete="off"></div>
        <button type="submit">Buscar</button>
        <button type="button" class="sec" data-limpar>Limpar</button>
      </form>
      <p class="hint">Ano e Mês preenchem <b>dataInicio</b>/<b>dataFim</b>, que vão para a API (filtram pela data da venda). A pesquisa por nome é feita aqui, sobre <b>nomeVenda</b> e <b>consultor</b>.</p>
      <div class="gets-enum"></div>
      <div class="gets"></div>
    </div>
    <section class="sub-panel"><div class="kpis kpis-top"></div><div class="despesas"></div></section>
    <section class="sub-panel">
      <div class="section-head"><h2>Faturamento por mês</h2>
        <div class="chart-legend"><span class="item"><span class="swatch bruto"></span>Faturamento (totalBruto)</span>
          <span class="item"><span class="swatch receita"></span>Receita (totalResultado)</span></div></div>
      <div class="card chart-wrap"><svg class="grafico" width="1132" height="300" viewBox="0 0 1132 300"></svg></div>
      <p class="hint">Clique num mês do gráfico para filtrar por ele. Vendas de teste/chargeback ficam fora dos totais e do gráfico.</p>
    </section>
    <section class="sub-panel">
      <div class="resumos"></div>
      <p class="hint">Valor bruto = soma de <b>taxasCliente.totalBruto</b> dos viajantes de cada item (passe o mouse na barra para ver vendas e passageiros). Itens inativos (ativo=false) ficam fora. Segue os filtros acima.</p>
    </section>
    <section class="sub-panel rankings"></section>
    <section class="sub-panel ultimas"></section>
    <div class="sub-panel">
      <div class="tabela"></div>
      <div class="paginacao">
        <label>Por página
          <select name="tam"><option>10</option><option selected>20</option><option>30</option><option>50</option><option value="0">Todas</option></select>
        </label>
        <span class="pg-info"></span>
        <button type="button" data-pg="-1">‹ Anterior</button>
        <span class="pg-num"></span>
        <button type="button" data-pg="1">Próxima ›</button>
      </div>
    </div>
    <section class="sub-panel">
      <div class="section-head"><h2>O que ainda não conseguimos medir</h2></div>
      <div class="gap-box">
        <ul>
          <li><b>Origem do lead nas vendas</b>: a API do Pax Pro não traz essa informação. A origem aparece na aba Atendimento, pelo Agendor.</li>
          <li><b>Nº de clientes atendidos por mês</b>: o Pax Pro só registra vendas, não atendimentos que não viraram venda.</li>
          <li><b>Lucro</b>: os valores aqui são faturamento e comissão, não lucro líquido da operação.</li>
        </ul>
      </div>
    </section>`;

  const form = el.querySelector('form.filtros');
  const campo = (n) => form.querySelector(`[name="${n}"]`);

  // Ano/Mes -> dataInicio/dataFim
  function datasDoPeriodo() {
    const ano = campo('ano').value;
    const mes = +campo('mes').value;
    const tri = +campo('tri').value;
    if (tri && ano && !mes) {
      const fim = tri * 3;
      campo('dataInicio').value = `01/${pad(fim - 2)}/${ano}`;
      campo('dataFim').value = `${pad(new Date(+ano, fim, 0).getDate())}/${pad(fim)}/${ano}`;
    } else if (!ano) {
      campo('dataInicio').value = `01/01/${PRIMEIRO_ANO}`;
      campo('dataFim').value = `31/12/${anos[anos.length - 1]}`;
    } else if (!mes) {
      campo('dataInicio').value = `01/01/${ano}`;
      campo('dataFim').value = `31/12/${ano}`;
    } else {
      campo('dataInicio').value = `01/${pad(mes)}/${ano}`;
      campo('dataFim').value = `${pad(new Date(+ano, mes, 0).getDate())}/${pad(mes)}/${ano}`;
    }
  }
  campo('ano').addEventListener('change', datasDoPeriodo);
  campo('mes').addEventListener('change', () => {
    if (campo('mes').value && !campo('ano').value) campo('ano').value = String(anoAtual);
    if (campo('mes').value) campo('tri').value = '';
    datasDoPeriodo();
  });
  campo('tri').addEventListener('change', () => {
    if (campo('tri').value && !campo('ano').value) campo('ano').value = String(anoAtual);
    if (campo('tri').value) campo('mes').value = '';
    datasDoPeriodo();
  });
  datasDoPeriodo();

  async function buscarApi() {
    for (const n of ['dataInicio', 'dataFim']) {
      if (campo(n).value.trim() && !iso(campo(n).value.trim())) {
        campo(n).style.borderColor = 'var(--crit)';
        campo(n).focus();
        campo(n).addEventListener('input', () => { campo(n).style.borderColor = ''; }, { once: true });
        return;
      }
    }
    const gets = el.querySelector('.gets');
    gets.innerHTML = '';
    const lista = [];
    for (let page = 1; ; page++) {
      gets.insertAdjacentHTML('beforeend', getLine(null));
      const r = await apiGet('/api/v1/agencia/venda', {
        page, dataInicio: campo('dataInicio').value.trim(), dataFim: campo('dataFim').value.trim(),
      });
      gets.lastElementChild.outerHTML = getLine(r);
      if (!r.ok) return;
      lista.push(...(r.body.data || []));
      if (page >= (r.body.totalPages || 1)) break;
    }
    vendas = lista.sort((a, b) => iso(b.dataVenda).localeCompare(iso(a.dataVenda)));
    st.busca = campo('busca').value.trim();
    st.pag = 1;
    render();
  }

  function filtradas() {
    const q = semAcento(st.busca);
    return vendas.filter((v) => !q || semAcento(`${v.nomeVenda} ${v.consultor?.nome || ''}`).includes(q));
  }

  function render() {
    const lista = filtradas();
    const validas = lista.filter((v) => !ehTeste(v));
    const meses = mesesPeriodo(iso(campo('dataInicio').value.trim()), iso(campo('dataFim').value.trim()));
    el.querySelector('.kpis-top').innerHTML = kpis(validas, meses);
    const despAberto = el.querySelector('.despesas details')?.open;
    el.querySelector('.despesas').innerHTML = despesasPeriodo(iso(campo('dataInicio').value.trim()), meses, despAberto);
    el.querySelector('.grafico').innerHTML = grafico(validas);
    const ativo = (p) => p.ativo !== false;
    el.querySelector('.resumos').innerHTML =
      graficoResumo('Por tipo de produto', resumo(validas, (p) => nomeProduto(p.produto), ativo)) +
      graficoResumo(`${esc(nomeProduto('AIRFARE'))} por destino`,
        resumo(validas, (p) => (p.destino ? p.destino.charAt(0) + p.destino.slice(1).toLowerCase() : 'Não informado'),
          (p) => ativo(p) && p.produto === 'AIRFARE'), 'itens');

    const { sales } = buildPaxpro({ statusLbl: {}, clientes: LISTA_CLIENTES, fornecedores: LISTA_FORNECEDORES, vendas: validas, financeiro: new Map() });
    el.querySelector('.rankings').innerHTML = `<div class="grid-2-even">
      ${ranking('Mix de produtos vendidos', 'venda com mais de um produto = pacote', sales, 'produto_label', 'Produto', 10, false)}
      ${ranking('Fornecedor que mais vendemos', '', sales, 'operadora', 'Operadora', 5)}
      ${ranking('Companhia que mais vendemos', 'só companhias aéreas', sales, 'companhia', 'Companhia aérea', 10, false)}
      ${ranking('Maiores clientes', 'por faturamento bruto acumulado', sales, 'cliente', 'Cliente', 10)}
    </div>`;
    el.querySelector('.ultimas').innerHTML = sales.length ? ultimasVendas(sales) : '';

    const tam = st.tam || lista.length || 1;
    const paginas = Math.max(1, Math.ceil(lista.length / tam));
    st.pag = Math.min(Math.max(1, st.pag), paginas);
    const ini = (st.pag - 1) * tam;
    const pagina = lista.slice(ini, ini + tam);
    const cols = COLUNAS.map(([c]) => c);
    el.querySelector('.tabela').innerHTML = pagina.length
      ? `<div class="tbl-wrap"><table class="api"><thead><tr><th></th>${COLUNAS.map(([c, t]) => `<th${['viajantes', 'totalBruto', 'totalResultado'].includes(c) ? ' class="num"' : ''}>${t}</th>`).join('')}</tr></thead>
        <tbody>${pagina.map((v, i) => `<tr data-i="${ini + i}"><td class="acc-col">${(v.produtos || []).length ? `<button type="button" class="acc-btn" data-acc="${ini + i}" title="Ver produtos"><span class="acc-seta">▸</span></button>` : ''}</td>${cols.map((c) =>
          `<td${c === 'nomeVenda' ? ' class="nome"' : ['viajantes', 'totalBruto', 'totalResultado'].includes(c) ? ' class="num"' : ''}>${celula(valorColuna(v, c))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
      : '<p class="meta-line">Nenhuma venda encontrada.</p>';
    // Accordion: abre/fecha a linha de produtos logo abaixo da venda.
    el.querySelectorAll('.tabela .acc-btn').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      const tr = b.closest('tr');
      const botoes = tr.querySelectorAll('.acc-btn');
      if (tr.nextElementSibling?.classList.contains('acc-linha')) {
        tr.nextElementSibling.remove();
        botoes.forEach((x) => x.classList.remove('aberto'));
        return;
      }
      tr.insertAdjacentHTML('afterend', detalheProdutos(lista[+b.dataset.acc], cols.length + 1));
      botoes.forEach((x) => x.classList.add('aberto'));
    }));
    el.querySelector('.pg-info').textContent =
      `Mostrando ${lista.length ? ini + 1 : 0}–${ini + pagina.length} de ${lista.length}${st.busca ? ` (filtrado de ${vendas.length})` : ''}`;
    el.querySelector('.pg-num').textContent = `Página ${st.pag} de ${paginas}`;
    el.querySelector('[data-pg="-1"]').disabled = st.pag <= 1;
    el.querySelector('[data-pg="1"]').disabled = st.pag >= paginas;
  }


  form.addEventListener('submit', (e) => { e.preventDefault(); buscarApi(); });
  form.querySelector('[data-limpar]').addEventListener('click', () => {
    campo('ano').value = String(anoAtual);
    campo('mes').value = '';
    campo('tri').value = '';
    campo('busca').value = '';
    datasDoPeriodo();
    buscarApi();
  });
  // Clique num mes do grafico = filtra Ano + Mes daquele mes e busca.
  el.querySelector('.grafico').addEventListener('click', (e) => {
    const g = e.target.closest('.bar-group');
    if (!g) return;
    campo('ano').value = g.dataset.ano;
    campo('mes').value = g.dataset.mes;
    campo('tri').value = '';
    datasDoPeriodo();
    buscarApi();
  });
  el.querySelector('.rankings').addEventListener('click', (e) => {
    const linha = e.target.closest('.rank-row');
    if (!linha || e.target.closest('a')) return;
    const detalhe = linha.nextElementSibling;
    detalhe.hidden = !detalhe.hidden;
    linha.classList.toggle('open', !detalhe.hidden);
  });
  el.querySelector('select[name="tam"]').addEventListener('change', (e) => { st.tam = +e.target.value; st.pag = 1; render(); });
  el.querySelectorAll('[data-pg]').forEach((b) => b.addEventListener('click', () => { st.pag += +b.dataset.pg; render(); }));

  // Enum de produtos antes das vendas (para os nomes amigaveis).
  const genum = el.querySelector('.gets-enum');
  genum.innerHTML = getLine(null);
  const rEnum = await apiGet('/api/v1/agencia/produto');
  genum.innerHTML = getLine(rEnum);
  if (rEnum.ok) PRODUTO_LBL = rEnum.body;
  buscarApi();
  // Nomes de fornecedores e clientes (todas as paginas), para o accordion.
  async function todasPaginas(path) {
    const lista = [];
    for (let page = 1; ; page++) {
      genum.insertAdjacentHTML('beforeend', getLine(null));
      const r = await apiGet(path, { page });
      genum.lastElementChild.outerHTML = getLine(r);
      if (!r.ok) return lista;
      lista.push(...(r.body.data || []));
      if (page >= (r.body.totalPages || 1)) return lista;
    }
  }
  LISTA_FORNECEDORES = await todasPaginas('/api/v1/agencia/fornecedor');
  LISTA_CLIENTES = await todasPaginas('/api/v1/agencia/cliente');
  FORNECEDORES = new Map(LISTA_FORNECEDORES.map((f) => [f.id, (f.nomeEmpresa || '').trim()]));
  CLIENTES = new Map(LISTA_CLIENTES.map((c) => [c.id, (c.nome || '').trim()]));
  if (vendas.length) render(); // recalcula Viajantes ja com os nomes
}
