// Aba Embarques: so passagem aerea, ao vivo do Pax Pro (cada aereo vira ida + volta).
// Venda cancelada e orcamento nao embarcam; teste e chargeback saem no buildPaxpro.
const { buildPaxpro } = await import(`./api/transform.js${new URL(import.meta.url).search}`);

const PRIMEIRO_ANO = 2025;
let EMBARQUES = [];

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const fmtDateBR = (s) => { const [y, m, d] = s.split('-'); return `${d}/${m}/${y.slice(2)}`; };
const paxproLink = (id) => (id ? `<a href="https://app.paxpro.com.br/sale?n=${id}" target="_blank" rel="noopener">${id}</a>` : '-');

// ---- Filtros de "Próximos embarques" ----
const embState = { filter: 'proximos', customStart: null, customEnd: null };

function isoAdd(iso, days){
  const [y,m,d] = iso.split('-').map(Number);
  const dt = new Date(y, m-1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}
function weekdayOf(iso){
  const [y,m,d] = iso.split('-').map(Number);
  return new Date(y, m-1, d).getDay(); // 0=domingo .. 6=sabado
}
function monthRange(iso, offsetMonths){
  const [y,m] = iso.split('-').map(Number);
  const first = new Date(y, m-1+offsetMonths, 1);
  const last = new Date(y, m+offsetMonths, 0);
  const fmt = dt => `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
  return [fmt(first), fmt(last)];
}

function embRange(filter){
  const today = todayISO();
  if(filter === 'hoje') return [today, today];
  if(filter === 'amanha'){ const t = isoAdd(today,1); return [t, t]; }
  if(filter === 'semana'){
    const wd = weekdayOf(today); // 0=dom..6=sab, semana Seg-Dom
    const daysToSunday = wd === 0 ? 0 : (7 - wd);
    return [today, isoAdd(today, daysToSunday)];
  }
  if(filter === 'semana_que_vem'){
    const wd = weekdayOf(today);
    const daysToNextMonday = wd === 0 ? 1 : (8 - wd);
    const nextMonday = isoAdd(today, daysToNextMonday);
    return [nextMonday, isoAdd(nextMonday, 6)];
  }
  if(filter === 'mes') return [today, monthRange(today,0)[1]];
  if(filter === 'mes_que_vem') return monthRange(today, 1);
  if(filter === 'personalizado') return [embState.customStart || null, embState.customEnd || null];
  return [today, null]; // 'proximos' (padrao): so futuro, sem limite superior
}

const EMB_FILTER_LABELS = [
  {v:'proximos', t:'Próximos'},
  {v:'hoje', t:'Hoje'},
  {v:'amanha', t:'Amanhã'},
  {v:'semana', t:'Essa semana'},
  {v:'semana_que_vem', t:'Semana que vem'},
  {v:'mes', t:'Esse mês'},
  {v:'mes_que_vem', t:'Mês que vem'},
  {v:'personalizado', t:'Escolher período'},
];

function buildEmbFilters(){
  const el = document.getElementById('emb-filters');
  if(!el) return;
  const buttonsHTML = EMB_FILTER_LABELS.map(f =>
    `<button type="button" class="emb-filter ${f.v===embState.filter?'active':''}" data-filter="${f.v}">${f.t}</button>`
  ).join('');
  const rangeHTML = `
    <div class="emb-range" id="emb-range" ${embState.filter==='personalizado' ? '' : 'hidden'}>
      <label>De <input type="date" id="emb-range-start" value="${embState.customStart||''}"></label>
      <label>Até <input type="date" id="emb-range-end" value="${embState.customEnd||''}"></label>
      <button type="button" id="emb-range-apply">Buscar</button>
    </div>`;
  el.innerHTML = `<div class="emb-filter-row">${buttonsHTML}</div>${rangeHTML}`;

  el.querySelectorAll('.emb-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      embState.filter = btn.dataset.filter;
      el.querySelectorAll('.emb-filter').forEach(b => b.classList.toggle('active', b === btn));
      document.getElementById('emb-range').hidden = (embState.filter !== 'personalizado');
      renderUpcomingTrips();
    });
  });
  const applyBtn = document.getElementById('emb-range-apply');
  if(applyBtn){
    applyBtn.addEventListener('click', () => {
      embState.customStart = document.getElementById('emb-range-start').value || null;
      embState.customEnd = document.getElementById('emb-range-end').value || null;
      renderUpcomingTrips();
    });
  }
}

function renderUpcomingTrips(){
  const today = todayISO();
  const table = document.getElementById('trips-table');
  if(embState.filter === 'personalizado' && !embState.customStart && !embState.customEnd){
    table.innerHTML = `<tbody><tr><td>Escolha uma data de início (e opcionalmente de fim) e clique em Buscar</td></tr></tbody>`;
    return;
  }
  const [start, end] = embRange(embState.filter);
  const list = EMBARQUES
    .filter(e => {
      if(!e.data) return false;
      if(start && e.data < start) return false;
      if(end && e.data > end) return false;
      return true;
    })
    .sort((a,b)=> a.data.localeCompare(b.data) || a.tipo.localeCompare(b.tipo));
  if(list.length === 0){ table.innerHTML = `<tbody><tr><td>Nenhum embarque encontrado nesse período</td></tr></tbody>`; return; }
  const rows = list.map(t=>{
    const past = t.data < today;
    return `
    <tr class="${past?'emb-past':''}">
      <td class="strong">${fmtDateBR(t.data)}</td>
      <td>${t.tipo}</td>
      <td class="strong">${t.destino||'-'}</td>
      <td>${t.rota||'-'}</td>
      <td>${t.passageiros}</td>
      <td>${t.companhia}</td>
      <td class="num">${paxproLink(t.venda)}</td>
    </tr>`;
  }).join('');
  table.innerHTML = `
    <thead><tr><th>Data</th><th>Embarque/Retorno</th><th>Destino</th><th>Trecho</th><th>Passageiro(s)</th><th>Companhia</th><th class="num">Venda nº</th></tr></thead>
    <tbody>${rows}</tbody>`;
}

export async function montarEmbarques(el, { apiGet }) {
  el.innerHTML = `<div class="sub-panel">
    <div class="section-head-center"><h2>Próximos embarques</h2></div>
    <div class="emb-filters" id="emb-filters"></div>
    <div class="card table-wrap"><table id="trips-table"><tbody><tr><td>Carregando do Pax Pro…</td></tr></tbody></table></div>
  </div>`;
  buildEmbFilters();
  async function todas(path, params = {}) {
    const lista = [];
    for (let page = 1; ; page++) {
      const r = await apiGet(path, { ...params, page });
      if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
      lista.push(...(r.body.data || []));
      if (page >= (r.body.totalPages || 1)) return lista;
    }
  }
  try {
    const clientes = await todas('/api/v1/agencia/cliente');
    const fornecedores = await todas('/api/v1/agencia/fornecedor');
    const vendas = await todas('/api/v1/agencia/venda', { dataInicio: `01/01/${PRIMEIRO_ANO}`, dataFim: `31/12/${new Date().getFullYear() + 2}` });
    const validas = vendas.filter((v) => !/CANCEL|ESTIMATE/.test(v.status || ''));
    EMBARQUES = buildPaxpro({ statusLbl: {}, clientes, fornecedores, vendas: validas, financeiro: new Map() }).embarques;
    renderUpcomingTrips();
  } catch (e) {
    document.getElementById('trips-table').innerHTML = `<tbody><tr><td>Não foi possível carregar os embarques: ${e.message}</td></tr></tbody>`;
  }
}
