// Aba Atendimento (Agendor, funis Leads + Orcamentos, sem Barbearia).
// O Agendor nao libera CORS: os dados vem do atendimento.js, gerado as 10h e 18h
// por atualizar_dashboard.js a partir da API.
const fmtBRL = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtDateBR = (s) => { const [y, m, d] = s.split('-'); return `${d}/${m}/${y.slice(2)}`; };
const quarterOf = (mo) => 'Q' + Math.ceil(Number(mo) / 3);
const monthFull = Object.fromEntries(['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  .map((m, i) => [String(i + 1).padStart(2, '0'), m]));

function paintKpis(elId, kpis) {
  document.getElementById(elId).innerHTML = kpis.map((k) => `
    <div class="kpi ${k.cls || ''}">
      <div class="label">${k.label}</div>
      <div class="value">${k.value}</div>
      <div class="sub">${k.sub}</div>
    </div>`).join('');
}

// ---- Atendimento (Agendor: Leads + Orçamentos, sem Barbearia) ----
function renderKpisAtendimento(negocios){
  // "Virou Orcamento" ja avancou pro funil de Orcamentos - nao conta mais
  // como lead ativo aqui (mas continua aparecendo no card de baixo, como
  // desfecho positivo do funil de leads).
  const leads = negocios.filter(n => n.funil === 'Leads' && n.etapa !== 'Virou Orçamento');
  const orcamentos = negocios.filter(n => n.funil === 'Orçamentos');
  const ganhos = orcamentos.filter(n => n.status === 'Ganho');
  // "Perdido de fato" conta tanto quem ja esta marcado Perdido no Agendor
  // quanto quem esta parado em Desistiu Preço/Sem Retorno (na pratica e
  // perda, mesmo que ninguem tenha voltado pra marcar como Perdido).
  const perdidoDeFato = orcamentos.filter(n => n.status === 'Perdido' || ETAPAS_PERDIDO_DE_FATO.includes(n.etapa));
  const decididos = ganhos.length + perdidoDeFato.length;
  const taxa = decididos ? (ganhos.length / decididos * 100) : 0;
  const valorGanho = ganhos.reduce((a,n)=>a+n.valor, 0);
  const ativos = orcamentos.filter(n => n.status !== 'Ganho' && n.status !== 'Perdido'
    && !ETAPAS_PERDIDO_DE_FATO.includes(n.etapa) && !ETAPAS_PRECISA_REVISAO.includes(n.etapa)).length;

  paintKpis('kpis-atendimento', [
    {label:'Leads', value: leads.length, sub: 'no funil de atendimento', cls:'accent'},
    {label:'Orçamentos ativos', value: ativos, sub: 'ver fase de cada um abaixo'},
    {label:'Orçamentos ganhos', value: ganhos.length, sub: (valorGanho ? `${fmtBRL(valorGanho)} · ` : '') + 'convertidos em venda', cls:'good'},
    {label:'Taxa de conversão', value: decididos ? taxa.toFixed(0)+'%' : '—', sub: decididos ? `${ganhos.length} de ${decididos} decididos` : 'sem orçamentos decididos ainda'},
  ]);
}

// Numero inteiro, nao porcentagem: quantos orçamentos precisam ser feitos,
// em media, pra fechar 1 venda - no periodo filtrado.
function renderRatioCard(negocios){
  const orcamentos = negocios.filter(n => n.funil === 'Orçamentos');
  const ganhos = orcamentos.filter(n => n.status === 'Ganho');
  const el = document.getElementById('ratio-card');
  if(!el) return;
  if(ganhos.length === 0){
    el.innerHTML = `<p class="section-note">Sem venda fechada no período filtrado — ${orcamentos.length} orçamento${orcamentos.length===1?'':'s'} feito${orcamentos.length===1?'':'s'} até agora.</p>`;
    return;
  }
  const razao = Math.round(orcamentos.length / ganhos.length);
  el.innerHTML = `
    <div class="ratio-big"><span class="ratio-num">${razao}</span> orçamento${razao===1?'':'s'} pra cada venda fechada</div>
    <p class="section-note" style="margin-top:8px">${orcamentos.length} orçamentos feitos, ${ganhos.length} viraram venda no período filtrado.</p>`;
}

// hbarList: cada row pode trazer "items" (lista de negocios) - clicar na
// barra abre/fecha um detalhe inline mostrando quem sao esses negocios.
function hbarList(elId, rows, emptyMsg){
  const colors = ['var(--accent)','var(--sunset)','var(--aqua)','var(--yellow)','var(--violet)','#e87ba4','#008300','#e34948'];
  const el = document.getElementById(elId);
  if(rows.length === 0){ el.innerHTML = `<p class="section-note">${emptyMsg}</p>`; return; }
  const max = Math.max(...rows.map(r=>r.count));
  el.innerHTML = rows.map((r,i)=>`
    <div class="hbar-row" data-idx="${i}">
      <div class="hbar-arrow">▸</div>
      <div class="hbar-name" title="${r.name}">${r.name}</div>
      <div class="hbar-track"><div class="hbar-fill" style="width:${(r.count/max*100).toFixed(1)}%; background:${r.color||colors[i%colors.length]}"></div></div>
      <div class="hbar-val">${r.count}</div>
    </div>
    <div class="hbar-detail" id="${elId}-d${i}" hidden></div>`).join('');

  el.querySelectorAll('.hbar-row').forEach(rowEl => {
    rowEl.addEventListener('click', () => {
      const i = Number(rowEl.dataset.idx);
      const detail = document.getElementById(`${elId}-d${i}`);
      if(!detail.hidden){
        detail.hidden = true;
        rowEl.classList.remove('open');
        return;
      }
      el.querySelectorAll('.hbar-detail').forEach(d => d.hidden = true);
      el.querySelectorAll('.hbar-row').forEach(r_ => r_.classList.remove('open'));
      // Ordena por situacao (Ganho, Perdido, Em orçamento/Virou orçamento, Lead) -
      // nunca misturado, mesmo quando o grupo (ex: uma origem) tem negocios
      // em desfechos diferentes.
      const ORDEM_OUTCOME = {good:0, crit:1, warn:2, muted:3};
      const items = (rows[i].items || []).slice().sort((a,b) => ORDEM_OUTCOME[outcomeOf(a).c] - ORDEM_OUTCOME[outcomeOf(b).c]);
      detail.innerHTML = items.length
        ? items.map(it => { const o = outcomeOf(it); return `<div class="hbar-detail-item"><span class="tag tag-${o.c}">${o.t}</span><b>${it.titulo}</b> — ${it.pessoa}</div>`; }).join('')
        : `<div class="hbar-detail-item">Sem detalhe disponível</div>`;
      detail.hidden = false;
      rowEl.classList.add('open');
    });
  });
}

// Etapas que na pratica ja significam perdido, mesmo quando o Status do
// Agendor ainda mostra "Em andamento" (o vendedor raramente volta la pra
// marcar como Perdido depois de "Sem Retorno" ou "Desistiu Preço").
const ETAPAS_PERDIDO_DE_FATO = ['Desistiu Preço', 'Sem Retorno'];
// Etapas que nao sao nem ativas nem perdidas de vez - precisam ser revisadas
// periodicamente (podem virar negocio de novo).
const ETAPAS_PRECISA_REVISAO = ['Lead Frio Tentar Futuramente', 'Viagem +12meses'];

// Tag de desfecho de um negocio (usado em qualquer lista de detalhe) -
// verde=ganhou, vermelho=perdido (marcado ou de fato), amarelo=em orçamento
// (ainda decidindo), cinza=lead ainda nao virou orçamento.
function outcomeOf(n){
  if(n.funil === 'Orçamentos'){
    if(n.status === 'Ganho') return {t:'Ganho', c:'good'};
    if(n.status === 'Perdido' || ETAPAS_PERDIDO_DE_FATO.includes(n.etapa)) return {t:'Perdido', c:'crit'};
    return {t:'Em orçamento', c:'warn'};
  }
  if(n.etapa === 'Virou Orçamento') return {t:'Virou orçamento', c:'warn'};
  if(ETAPAS_PERDIDO_DE_FATO.includes(n.etapa)) return {t:'Perdido', c:'crit'};
  return {t:'Lead', c:'muted'};
}

function renderLeadsCard(negocios){
  const leads = negocios.filter(n=>n.funil==='Leads');
  const byEtapa = {};
  leads.forEach(n => { (byEtapa[n.etapa] = byEtapa[n.etapa]||[]).push(n); });
  const rows = Object.entries(byEtapa).map(([name,items])=>{
    let color;
    if(name === 'Virou Orçamento') color = 'var(--good)';
    else if(ETAPAS_PERDIDO_DE_FATO.includes(name)) color = 'var(--crit)';
    return {name, count:items.length, color, items};
  }).sort((a,b)=>b.count-a.count);
  hbarList('leads-funil-card', rows, 'Sem leads no momento');
}

function renderOrcamentosCard(negocios){
  const orcamentos = negocios.filter(n=>n.funil==='Orçamentos');
  const ganhos = orcamentos.filter(n=>n.status==='Ganho');

  // Perdido de fato = status Perdido no Agendor + etapas que na pratica ja
  // sao perda (mesmo com status "Em andamento" ainda no sistema). Mostra
  // cada motivo como linha propria, nao escondido dentro de um texto so.
  const perdidoStatus = orcamentos.filter(n=>n.status==='Perdido');
  const perdidoPorEtapa = {};
  orcamentos.filter(n=>n.status!=='Ganho' && n.status!=='Perdido' && ETAPAS_PERDIDO_DE_FATO.includes(n.etapa))
    .forEach(n => { (perdidoPorEtapa[n.etapa] = perdidoPorEtapa[n.etapa]||[]).push(n); });

  // Precisa revisao = etapas mortas-mas-nao-de-vez.
  const revisaoPorEtapa = {};
  orcamentos.filter(n=>n.status!=='Ganho' && n.status!=='Perdido' && ETAPAS_PRECISA_REVISAO.includes(n.etapa))
    .forEach(n => { (revisaoPorEtapa[n.etapa] = revisaoPorEtapa[n.etapa]||[]).push(n); });

  // Em andamento de verdade = o resto.
  const ativoPorEtapa = {};
  orcamentos.filter(n=>n.status!=='Ganho' && n.status!=='Perdido' && !ETAPAS_PERDIDO_DE_FATO.includes(n.etapa) && !ETAPAS_PRECISA_REVISAO.includes(n.etapa))
    .forEach(n => { (ativoPorEtapa[n.etapa] = ativoPorEtapa[n.etapa]||[]).push(n); });

  const rows = [];
  if(ganhos.length) rows.push({name:'Ganho — virou venda', count:ganhos.length, color:'var(--good)', items:ganhos});
  Object.entries(ativoPorEtapa).sort((a,b)=>b[1].length-a[1].length).forEach(([name,items]) => rows.push({name, count:items.length, items}));
  Object.entries(revisaoPorEtapa).sort((a,b)=>b[1].length-a[1].length).forEach(([name,items]) => rows.push({name: name+' (revisar)', count:items.length, color:'var(--warn)', items}));
  if(perdidoStatus.length) rows.push({name:'Desistiu sem motivo', count:perdidoStatus.length, color:'var(--crit)', items:perdidoStatus});
  Object.entries(perdidoPorEtapa).sort((a,b)=>b[1].length-a[1].length).forEach(([name,items]) => rows.push({name, count:items.length, color:'var(--crit)', items}));
  hbarList('orc-funil-card', rows, 'Sem orçamentos no momento');
}

function renderOrigemCard(negocios){
  // So orçamentos aqui - lead que nunca virou orçamento nao conta pra
  // origem de cliente (ainda nao e cliente de fato).
  const orcamentos = negocios.filter(n => n.funil === 'Orçamentos');
  const byOrigem = {};
  orcamentos.forEach(n => { if(n.origem && n.origem !== '-') (byOrigem[n.origem] = byOrigem[n.origem]||[]).push(n); });
  const rows = Object.entries(byOrigem).map(([name,items])=>({name, count:items.length, items})).sort((a,b)=>b.count-a.count);
  const semOrigem = orcamentos.length - orcamentos.filter(n=>n.origem && n.origem!=='-').length;
  hbarList('origem-card', rows, 'Sem origem preenchida');
  if(semOrigem){
    document.getElementById('origem-card').insertAdjacentHTML('beforeend', `<p class="section-note" style="margin-top:8px">${semOrigem} negócios sem origem preenchida</p>`);
  }
}

let ganhosExpandido = false;
function renderGanhosTable(negocios){
  const ganhos = negocios.filter(n => n.funil === 'Orçamentos' && n.status === 'Ganho')
    .sort((a,b)=> (b.dt_conclusao||'').localeCompare(a.dt_conclusao||''));
  const table = document.getElementById('ganhos-table');
  const oldToggle = document.getElementById('ganhos-toggle');
  if(oldToggle) oldToggle.remove();
  if(ganhos.length === 0){ table.innerHTML = `<tbody><tr><td>Nenhum orçamento ganho ainda</td></tr></tbody>`; return; }
  const LIMIT = 10;
  const visible = ganhosExpandido ? ganhos : ganhos.slice(0, LIMIT);
  const rowHTML = n => `
    <tr>
      <td class="strong">${n.dt_conclusao ? fmtDateBR(n.dt_conclusao) : '-'}</td>
      <td>${n.titulo}</td>
      <td>${n.pessoa}</td>
      <td>${n.responsavel}</td>
      <td class="num">${n.valor ? fmtBRL(n.valor) : '—'}</td>
    </tr>`;
  table.innerHTML = `
    <thead><tr><th>Data</th><th>Negócio</th><th>Cliente</th><th>Responsável</th><th class="num">Valor ref.</th></tr></thead>
    <tbody>${visible.map(rowHTML).join('')}</tbody>`;
  if(ganhos.length > LIMIT){
    table.insertAdjacentHTML('afterend', `<button type="button" id="ganhos-toggle" class="emb-filter" style="margin-top:10px">${ganhosExpandido ? 'Mostrar menos' : `Ver todos (${ganhos.length})`} <span class="hbar-arrow" style="display:inline-block; ${ganhosExpandido?'transform:rotate(90deg);color:var(--accent);':''}">▸</span></button>`);
    document.getElementById('ganhos-toggle').addEventListener('click', () => {
      ganhosExpandido = !ganhosExpandido;
      renderGanhosTable(negocios);
    });
  }
}

// ---- Filtro de Atendimento (Ano/Trimestre/Mes, pela Data de cadastro) ----
const atState = { year: 'all', quarter: 'all', month: 'all' };

function buildAtFilterOptions(){
  if(typeof NEGOCIOS === 'undefined') return;
  const withDate = NEGOCIOS.filter(n => n.dt_cadastro);
  const years = Array.from(new Set(withDate.map(n => n.dt_cadastro.slice(0,4)))).sort();
  const yearSel = document.getElementById('at-f-year');
  yearSel.innerHTML = `<option value="all">Todos os anos</option>` +
    years.map(y => `<option value="${y}">${y}</option>`).join('');

  const quarterSel = document.getElementById('at-f-quarter');
  quarterSel.innerHTML = `<option value="all">Todos os trimestres</option>` +
    ['Q1','Q2','Q3','Q4'].map(q => `<option value="${q}">${q}</option>`).join('');

  refreshAtMonthOptions();
}

function refreshAtMonthOptions(){
  const monthSel = document.getElementById('at-f-month');
  const prev = atState.month;
  const withDate = (typeof NEGOCIOS !== 'undefined' ? NEGOCIOS : []).filter(n => n.dt_cadastro);
  const months = Array.from(new Set(
    withDate.filter(n => {
      const y = n.dt_cadastro.slice(0,4), mo = n.dt_cadastro.slice(5,7);
      if(atState.year !== 'all' && y !== atState.year) return false;
      if(atState.quarter !== 'all' && quarterOf(mo) !== atState.quarter) return false;
      return true;
    }).map(n => n.dt_cadastro.slice(5,7))
  )).sort();
  monthSel.innerHTML = `<option value="all">Todos os meses</option>` +
    months.map(m => `<option value="${m}">${monthFull[m]}</option>`).join('');
  if(months.includes(prev)) monthSel.value = prev; else atState.month = 'all';
}

function filteredNegocios(){
  if(typeof NEGOCIOS === 'undefined') return [];
  return NEGOCIOS.filter(n => {
    if(!n.dt_cadastro) return atState.year === 'all' && atState.quarter === 'all' && atState.month === 'all';
    const y = n.dt_cadastro.slice(0,4), mo = n.dt_cadastro.slice(5,7);
    if(atState.year !== 'all' && y !== atState.year) return false;
    if(atState.quarter !== 'all' && quarterOf(mo) !== atState.quarter) return false;
    if(atState.month !== 'all' && mo !== atState.month) return false;
    return true;
  });
}

function renderAtFilterSummary(negocios){
  const parts = [];
  parts.push(atState.year === 'all' ? 'todos os anos' : atState.year);
  if(atState.quarter !== 'all') parts.push(atState.quarter);
  if(atState.month !== 'all') parts.push(monthFull[atState.month]);
  document.getElementById('at-filter-summary').textContent = `Exibindo: ${parts.join(' · ')} — ${negocios.length} negócio${negocios.length===1?'':'s'}`;
}

function renderAtendimento(){
  if(typeof NEGOCIOS === 'undefined') return;
  const negocios = filteredNegocios();
  renderKpisAtendimento(negocios);
  renderRatioCard(negocios);
  renderLeadsCard(negocios);
  renderOrcamentosCard(negocios);
  renderOrigemCard(negocios);
  renderGanhosTable(negocios);
  renderAtFilterSummary(negocios);
}

const carregarDados = () => new Promise((ok, erro) => {
  const s = document.createElement('script');
  s.src = `atendimento.js?v=${Date.now()}`;
  s.onload = ok;
  s.onerror = () => erro(new Error('atendimento.js não encontrado'));
  document.body.appendChild(s);
});

export async function montarAtendimento(el) {
  el.innerHTML = `
    <div class="sub-panel">
      <div class="section-head-center"><h2>Atendimento</h2><span class="section-note">CRM Agendor · funis Leads + Orçamentos · atualizado às 10h e 18h<span id="at-gerado"></span></span></div>
      <div class="filters">
        <select id="at-f-year"></select>
        <select id="at-f-quarter"></select>
        <select id="at-f-month"></select>
        <button id="at-f-reset" type="button">Limpar filtros</button>
        <span class="filter-summary" id="at-filter-summary"></span>
      </div>
    </div>
    <section class="sub-panel"><div class="kpis" id="kpis-atendimento"></div></section>
    <section class="sub-panel">
      <div class="section-head"><h2>Quantos orçamentos pra fechar uma venda</h2><span class="section-note">no período filtrado acima</span></div>
      <div class="card" id="ratio-card"></div>
    </section>
    <section class="sub-panel grid-2-even">
      <div><div class="section-head"><h2>O que aconteceu com os leads</h2></div><div class="card" id="leads-funil-card"></div></div>
      <div><div class="section-head"><h2>O que aconteceu com os orçamentos</h2></div><div class="card" id="orc-funil-card"></div></div>
    </section>
    <section class="sub-panel">
      <div class="section-head"><h2>Origem dos clientes</h2><span class="section-note">só orçamentos</span></div>
      <div class="card" id="origem-card"></div>
    </section>
    <section class="sub-panel">
      <div class="section-head"><h2>Orçamentos ganhos (virou venda)</h2><span class="section-note">valor é referência, nem sempre preenchido</span></div>
      <div class="card table-wrap"><table id="ganhos-table"></table></div>
    </section>`;
  try {
    await carregarDados();
  } catch (e) {
    el.innerHTML = `<p class="meta-line">Não foi possível carregar o Atendimento: ${e.message}. Rode <b>node dashboard/atualizar_dashboard.js</b>.</p>`;
    return;
  }
  document.getElementById('at-gerado').textContent = ` · última atualização ${NEGOCIOS_GERADO_EM}`;
  buildAtFilterOptions();
  document.getElementById('at-f-year').addEventListener('change', (e) => { atState.year = e.target.value; refreshAtMonthOptions(); renderAtendimento(); });
  document.getElementById('at-f-quarter').addEventListener('change', (e) => { atState.quarter = e.target.value; refreshAtMonthOptions(); renderAtendimento(); });
  document.getElementById('at-f-month').addEventListener('change', (e) => { atState.month = e.target.value; renderAtendimento(); });
  document.getElementById('at-f-reset').addEventListener('click', () => {
    Object.assign(atState, { year: 'all', quarter: 'all', month: 'all' });
    document.getElementById('at-f-year').value = 'all';
    document.getElementById('at-f-quarter').value = 'all';
    refreshAtMonthOptions();
    document.getElementById('at-f-month').value = 'all';
    renderAtendimento();
  });
  renderAtendimento();
}
