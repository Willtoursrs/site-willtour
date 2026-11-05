// Explorador da API do Pax Pro: cada aba faz o GET do manual (V2.1) DIRETO
// do navegador - aparece no Network com a URL real - e mostra o response na
// tela, com os filtros que cada rota aceita.
const V = new URL(import.meta.url).search; // ?v=... do index.html (anti-cache)
const { PAXPRO_CODE } = await import(`./chaves.local.js${V}`);
const { montarClientes } = await import(`./clientes.js${V}`);
const { montarVendas } = await import(`./vendas.js${V}`);
const { montarEmbarques } = await import(`./embarques.js${V}`);
const { montarAtendimento } = await import(`./aba-atendimento.js${V}`);

const BASE = 'https://app.paxpro.com.br';
document.getElementById('api-base').textContent = BASE;

// ---------- chamadas ----------

// Token vale 1h: um login so ao abrir a pagina.
const tokenPromise = fetch(`${BASE}/noauth/v1/login`, { headers: { 'agency-api-code': PAXPRO_CODE } })
  .then((r) => {
    if (!r.ok) throw new Error(`login: HTTP ${r.status}`);
    return r.json();
  })
  .then((d) => d.token);

// O Pax Pro limita as requisicoes por segundo (HTTP 429): espera e tenta de novo.
async function apiGet(path, params, tentativa = 0) {
  const token = await tokenPromise;
  const limpos = Object.fromEntries(Object.entries(params || {}).filter(([, v]) => v !== '' && v != null));
  const qs = Object.keys(limpos).length ? '?' + new URLSearchParams(limpos) : '';
  const url = `${BASE}${path}${qs}`;
  const t0 = performance.now();
  const res = await fetch(url, { headers: { Authentication: token } });
  if (res.status === 429 && tentativa < 5) {
    await new Promise((r) => setTimeout(r, 1000 + 300 * tentativa));
    return apiGet(path, params, tentativa + 1);
  }
  const texto = await res.text();
  let body;
  try { body = JSON.parse(texto); } catch { body = texto; }
  return { url, status: res.status, ok: res.ok, ms: Math.round(performance.now() - t0), body };
}

// ---------- abas (rotas do manual) ----------

const hoje = new Date();
const br = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

const ABAS = [
  { id: 'agencia', nome: 'Agência', gets: [
    { titulo: 'Agência', path: '/api/v1/agencia' },
    { titulo: 'Produtos', path: '/api/v1/agencia/produto' },
    { titulo: 'Status de venda', path: '/api/v1/agencia/venda/status' },
  ] },
  { id: 'atendimento', nome: 'Atendimento', custom: montarAtendimento },
  { id: 'clientes', nome: 'Clientes', custom: montarClientes },
  { id: 'vendas', nome: 'Venda', custom: montarVendas },
  { id: 'embarques', nome: 'Embarques', custom: montarEmbarques },
];

const DICAS = {
  page: 'página (100 itens)',
  dataInicio: 'dd/MM/yyyy',
  dataFim: 'dd/MM/yyyy',
};

// ---------- render generico do response ----------

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const isScalar = (v) => v == null || typeof v !== 'object';

function celula(v) {
  if (v == null || v === '') return '<span style="color:var(--ink-muted)">—</span>';
  if (isScalar(v)) return esc(v);
  if (Array.isArray(v) && v.every(isScalar)) return esc(v.join(', '));
  const n = Array.isArray(v) ? `${v.length} ${v.length === 1 ? 'item' : 'itens'}` : 'objeto';
  return `<details><summary>${n}</summary><div class="obj">${esc(JSON.stringify(v, null, 2))}</div></details>`;
}

function tabela(linhas, onClick) {
  if (!linhas.length) return '<p class="meta-line">Nenhum registro.</p>';
  const cols = [...new Set(linhas.flatMap((l) => Object.keys(l)))];
  const head = cols.map((c) => `<th>${esc(c)}</th>`).join('');
  const body = linhas.map((l, i) =>
    `<tr data-i="${i}" class="${onClick ? 'click' : ''}">${cols.map((c) => `<td>${celula(l[c])}</td>`).join('')}</tr>`).join('');
  return `<div class="tbl-wrap"><table class="api"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

const chaveValor = (o) => tabela(Object.entries(o).map(([campo, valor]) => ({ campo, valor })));

// Monta o HTML do response conforme o formato (paginado, objeto, lista...).
function renderBody(body, onRow) {
  if (!isObj(body) && !Array.isArray(body)) return `<pre>${esc(body)}</pre>`;
  if (Array.isArray(body)) return tabela(body, onRow);
  if (Array.isArray(body.data)) {
    const { data, ...meta } = body;
    const resumo = Object.entries(meta).map(([k, v]) => `${k}: <b>${esc(v)}</b>`).join(' · ');
    return `<p class="meta-line">${resumo}</p>${tabela(data, onRow)}`;
  }
  const escalares = Object.fromEntries(Object.entries(body).filter(([, v]) => isScalar(v)));
  const compostos = Object.entries(body).filter(([, v]) => !isScalar(v));
  let html = Object.keys(escalares).length ? chaveValor(escalares) : '';
  for (const [k, v] of compostos) {
    html += `<h3>${esc(k)}</h3>`;
    html += Array.isArray(v) ? tabela(v) : chaveValor(v);
  }
  return html;
}

// ---------- bloco de um GET (linha do GET + filtros + response) ----------

// A linha do GET so aparece quando a chamada da erro (para debug, ver o Network).
function getLine(r) {
  if (!r || r.ok) return '<div class="get-ok" hidden></div>';
  return `<div class="get-line"><span class="st err">HTTP ${r.status} · ${r.ms} ms</span>` +
    `<span class="url"><b>GET</b>${esc(decodeURIComponent(r.url))}</span></div>`;
}

function montarGet(cfg, el) {
  const params = { ...(cfg.params || {}) };
  const temFiltro = Object.keys(params).length > 0;
  el.innerHTML = `
    <h2>${esc(cfg.titulo)}</h2>
    ${temFiltro ? `<form class="api-form">
      ${Object.entries(params).map(([k, v]) => `
        <div class="filter-field"><label>${k} <span style="text-transform:none;color:var(--ink-muted)">${DICAS[k] || ''}</span></label>
        <input name="${k}" value="${esc(v)}"></div>`).join('')}
      <button type="submit">Buscar</button>
      ${'page' in params ? '<button type="button" class="sec" data-pg="-1">‹ Anterior</button><button type="button" class="sec" data-pg="1">Próxima ›</button>' : ''}
    </form>` : ''}
    <div class="res"></div>
    ${cfg.detalhe ? `<div class="sub-panel">
      <h2>${esc(cfg.detalhe.titulo)}</h2>
      <form class="api-form det-form">
        <div class="filter-field"><label>${cfg.detalhe.campo}</label><input name="id"></div>
        <button type="submit">Buscar</button>
      </form>
      <p class="hint">Clique numa linha da tabela acima (usa o campo <b>id</b>) ou digite o ${cfg.detalhe.campo}.</p>
      <div class="det-res"></div>
    </div>` : ''}`;

  const form = el.querySelector('form.api-form:not(.det-form)');
  const res = el.querySelector('.res');
  let ultimo = null;

  async function buscar() {
    if (form) for (const inp of form.querySelectorAll('input')) params[inp.name] = inp.value.trim();
    res.innerHTML = getLine(null);
    const r = await apiGet(cfg.path, params);
    ultimo = r;
    const linhas = Array.isArray(r.body?.data) ? r.body.data : null;
    res.innerHTML = getLine(r) + renderBody(r.body, cfg.detalhe ? true : null) +
      `<details class="raw"><summary>Response JSON (cru)</summary><pre>${esc(JSON.stringify(r.body, null, 2))}</pre></details>`;
    if (cfg.detalhe && linhas) {
      res.querySelectorAll('tr.click').forEach((tr) => tr.addEventListener('click', (e) => {
        if (e.target.closest('details')) return;
        res.querySelectorAll('tr.sel').forEach((x) => x.classList.remove('sel'));
        tr.classList.add('sel');
        buscarDetalhe(linhas[+tr.dataset.i].id);
      }));
    }
  }

  async function buscarDetalhe(id) {
    if (!id) return;
    el.querySelector('.det-form input').value = id;
    const out = el.querySelector('.det-res');
    out.innerHTML = getLine(null);
    const r = await apiGet(cfg.detalhe.path(id));
    out.innerHTML = getLine(r) + renderBody(r.body) +
      `<details class="raw"><summary>Response JSON (cru)</summary><pre>${esc(JSON.stringify(r.body, null, 2))}</pre></details>`;
    out.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  form?.addEventListener('submit', (e) => { e.preventDefault(); buscar(); });
  el.querySelectorAll('[data-pg]').forEach((b) => b.addEventListener('click', () => {
    const inp = form.querySelector('input[name="page"]');
    const total = ultimo?.body?.totalPages || 1;
    inp.value = Math.min(Math.max(1, (+inp.value || 1) + +b.dataset.pg), Math.max(total, 1));
    buscar();
  }));
  el.querySelector('.det-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    buscarDetalhe(e.target.querySelector('input').value.trim());
  });
  buscar();
}

// ---------- abas ----------

const hub = document.getElementById('hub');
const painel = document.getElementById('painel');
const montadas = {};

function abrir(id) {
  hub.querySelectorAll('.hub-card').forEach((b) => b.classList.toggle('active', b.dataset.view === id));
  for (const [k, div] of Object.entries(montadas)) div.hidden = k !== id;
  if (montadas[id]) return;
  // Monta a aba so na primeira vez (evita estourar o limite de requisicoes).
  const div = document.createElement('div');
  montadas[id] = div;
  painel.appendChild(div);
  const aba = ABAS.find((a) => a.id === id);
  if (aba.custom) return aba.custom(div, { apiGet, getLine, renderBody });
  for (const cfg of aba.gets) {
    const bloco = document.createElement('div');
    bloco.className = 'sub-panel';
    div.appendChild(bloco);
    montarGet(cfg, bloco);
  }
}

hub.innerHTML = ABAS.map((a) =>
  `<button class="hub-card" data-view="${a.id}" type="button"><span class="hub-label">${a.nome}</span></button>`).join('');
hub.querySelectorAll('.hub-card').forEach((b) => b.addEventListener('click', () => abrir(b.dataset.view)));
abrir('vendas');
