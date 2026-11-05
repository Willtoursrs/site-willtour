// Aba Clientes: busca TODAS as paginas de GET /api/v1/agencia/cliente e
// mostra tabela (busca por nome, idade, paginacao no rodape) + persona.

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const semAcento = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ---------- idade ----------

export function idade(dataNasc) {
  const m = (dataNasc || '').match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  const hoje = new Date();
  let anos = hoje.getFullYear() - +m[3];
  if (hoje.getMonth() + 1 < +m[2] || (hoje.getMonth() + 1 === +m[2] && hoje.getDate() < +m[1])) anos--;
  return anos >= 0 && anos < 120 ? anos : null;
}

export const FAIXAS = [[0, 11, '0–11'], [12, 17, '12–17'], [18, 29, '18–29'], [30, 44, '30–44'], [45, 59, '45–59'], [60, 200, '60+']];
export const faixa = (i) => (i == null ? null : FAIXAS.find(([a, b]) => i >= a && i <= b)[2]);

// ---------- sexo (a API nao tem esse campo: estimado pelo primeiro nome) ----------

const FEM = new Set(['alice', 'beatriz', 'lilian', 'helen', 'ellen', 'raquel', 'isabel', 'ingrid', 'miriam', 'ruth',
  'carmen', 'michele', 'michelle', 'nicole', 'gisele', 'simone', 'denise', 'aline', 'cristiane', 'adriane', 'celine',
  'rosimeire', 'rosemeire', 'irene', 'ivone', 'yasmin', 'jasmin', 'karen', 'esther', 'ester', 'lais', 'ines', 'agnes',
  'rosangela', 'solange', 'eliane', 'viviane', 'tatiane', 'luciene', 'elaine', 'jaqueline', 'jacqueline', 'caroline',
  'carolina', 'evelyn', 'elizabeth', 'isis', 'thais', 'dulce', 'cleide', 'neide', 'rose', 'mabel', 'rachel', 'maite',
  'anallu', 'dani', 'gabi', 'lu', 'cris', 'mari', 'marli', 'nair', 'noemi', 'suely', 'sueli', 'nely', 'ely', 'lis', 'liz']);
const MASC = new Set(['luca', 'lucca', 'nicola', 'joshua', 'jonatha', 'garcia', 'costa', 'batista']);
const F_FIM = ['ane', 'iane', 'ene', 'ine', 'ele', 'elle', 'ete', 'ette', 'iz', 'ice', 'ilde', 'ude', 'ilene', 'ise'];

export function sexo(nome) {
  const p = semAcento((nome || '').trim().split(/\s+/)[0]);
  if (!p) return null;
  if (FEM.has(p)) return 'Feminino';
  if (MASC.has(p)) return 'Masculino';
  if (p.endsWith('a') || F_FIM.some((f) => p.endsWith(f))) return 'Feminino';
  return 'Masculino';
}

// ---------- render ----------

function barras(contagem, total) {
  const itens = Object.entries(contagem).sort((a, b) => b[1] - a[1]);
  if (!itens.length) return '<p class="meta-line">Sem dados.</p>';
  const max = Math.max(...itens.map(([, n]) => n));
  return itens.map(([k, n]) => `
    <div class="pbar"><span class="pbar-k">${esc(k)}</span>
      <span class="pbar-track"><span class="pbar-fill" style="width:${(n / max) * 100}%"></span></span>
      <span class="pbar-n">${n} <small>(${Math.round((n / total) * 100)}%)</small></span></div>`).join('');
}

const contar = (lista) => lista.reduce((o, k) => ((o[k] = (o[k] || 0) + 1), o), {});

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function persona(clientes) {
  const pf = clientes.filter((c) => c.tipoPessoa !== 'PJ');
  const sexos = pf.map((c) => c._sexo).filter(Boolean);
  const idades = pf.map((c) => c._idade).filter((i) => i != null);
  const media = idades.length ? Math.round(idades.reduce((s, i) => s + i, 0) / idades.length) : null;
  const ord = [...idades].sort((a, b) => a - b);
  const mediana = ord.length ? ord[Math.floor(ord.length / 2)] : null;
  const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1])[0]?.[0];
  const cSexo = contar(sexos);
  const cFaixa = contar(pf.map((c) => faixa(c._idade)).filter(Boolean));
  const ordemFaixa = Object.fromEntries(FAIXAS.map(([, , f]) => [f, cFaixa[f] || 0]).filter(([, n]) => n));

  return `
    <h2>Persona do cliente</h2>
    <p class="meta-line">Base: <b>${pf.length}</b> clientes pessoa física (de ${clientes.length} na API; ${clientes.length - pf.length} PJ fora da conta).</p>
    <div class="persona-resumo card">
      Perfil mais comum: <b>${esc(top(cSexo) || '—')}</b>, faixa <b>${esc(top(cFaixa) || '—')} anos</b>
      (média ${media ?? '—'}, mediana ${mediana ?? '—'}).
    </div>
    <div class="persona-grid">
      <div class="card"><h3>Sexo</h3>
        <p class="hint">Estimado pelo primeiro nome (a API não tem esse campo) · ${sexos.length} de ${pf.length}</p>
        ${barras(cSexo, sexos.length)}</div>
      <div class="card"><h3>Faixa etária</h3>
        <p class="hint">Pelo campo dataNascimento · ${idades.length} de ${pf.length} preenchidos</p>
        ${barras(ordemFaixa, idades.length)}</div>
    </div>`;
}

// Card de aniversariantes do mes escolhido (dia, nome e idade que completa).
function aniversariantes(clientes, mes) {
  const ano = new Date().getFullYear();
  const lista = clientes
    .map((c) => ({ c, m: (c.dataNascimento || '').match(/^(\d{2})\/(\d{2})\/(\d{4})/) }))
    .filter(({ m }) => m && +m[2] === mes + 1)
    .sort((a, b) => +a.m[1] - +b.m[1]);
  const hoje = new Date();
  const linhas = lista.map(({ c, m }) => {
    const passou = mes < hoje.getMonth() || (mes === hoje.getMonth() && +m[1] < hoje.getDate());
    const eHoje = mes === hoje.getMonth() && +m[1] === hoje.getDate();
    return `<div class="aniv${passou ? ' passou' : ''}${eHoje ? ' hoje' : ''}"><span class="aniv-dia">${m[1]}/${m[2]}</span>
      <span class="aniv-nome">${esc(c.nome)}</span><span class="aniv-idade">${ano - +m[3]} anos</span></div>`;
  }).join('');
  return `<h3>Aniversariantes de ${MESES[mes]}</h3>
    <p class="hint">${lista.length} cliente(s) · pelo campo dataNascimento</p>
    ${linhas || '<p class="meta-line">Ninguém faz aniversário neste mês.</p>'}`;
}

// Ordem das colunas: campos da API, com idade logo depois de dataNascimento.
function linhas(clientes) {
  return clientes.map((c) => {
    const o = {};
    for (const [k, v] of Object.entries(c)) {
      if (k.startsWith('_') || k === 'dataNascimento') continue;
      if (k === 'endereco') { o.dataNascimento = c.dataNascimento; o.idade = c._idade; }
      o[k] = v;
    }
    if (!('dataNascimento' in o)) { o.dataNascimento = c.dataNascimento; o.idade = c._idade; }
    o['sexo (estimado)'] = c._sexo;
    return o;
  });
}

export async function montarClientes(el, { apiGet, getLine }) {
  el.innerHTML = `<div class="sub-panel persona-topo"><div class="persona"></div>
      <div class="card aniv-card"></div></div>
    <div class="sub-panel"><h2>Clientes</h2><div class="gets"></div><div class="filtros"></div><div class="cli"></div></div>`;
  const gets = el.querySelector('.gets');

  // Busca todas as paginas (100 por pagina) e mostra cada GET feito.
  const todos = [];
  for (let page = 1; ; page++) {
    gets.insertAdjacentHTML('beforeend', getLine(null));
    const r = await apiGet('/api/v1/agencia/cliente', { page });
    gets.lastElementChild.outerHTML = getLine(r);
    if (!r.ok) return;
    todos.push(...(r.body.data || []));
    if (page >= (r.body.totalPages || 1)) break;
  }
  for (const c of todos) {
    c._idade = idade(c.dataNascimento);
    c._sexo = c.tipoPessoa === 'PJ' ? null : sexo(c.nome);
  }

  const cli = el.querySelector('.cli');
  const st = { busca: '', de: '', ate: '', tam: 20, pag: 1, mes: new Date().getMonth() };
  // A rota de cliente aceita so `page` (testado: dataInicio/dataFim sao
  // ignorados), entao o filtro de data e feito aqui, sobre o dataRegistro.
  el.querySelector('.filtros').innerHTML = `
    <form class="api-form">
      <div class="filter-field"><label>dataRegistro de <span style="text-transform:none;color:var(--ink-muted)">dd/MM/yyyy</span></label>
        <input name="de" placeholder="01/01/2026" autocomplete="off"></div>
      <div class="filter-field"><label>até <span style="text-transform:none;color:var(--ink-muted)">dd/MM/yyyy</span></label>
        <input name="ate" placeholder="31/12/2026" autocomplete="off"></div>
      <div class="filter-field"><label>Pesquisar por nome</label>
        <input name="busca" placeholder="Digite o nome…" style="width:260px" autocomplete="off"></div>
      <button type="submit">Buscar</button>
      <button type="button" class="sec" data-limpar>Limpar</button>
    </form>
    <p class="hint">A API de cliente só aceita o parâmetro <b>page</b>; o filtro de data é aplicado aqui sobre o <b>dataRegistro</b> (data de cadastro).</p>`;
  cli.innerHTML = `
    <div class="tabela"></div>
    <div class="paginacao">
      <label>Por página
        <select name="tam"><option>10</option><option selected>20</option><option>30</option><option>50</option><option value="0">Todas</option></select>
      </label>
      <span class="pg-info"></span>
      <button type="button" data-pg="-1">‹ Anterior</button>
      <span class="pg-num"></span>
      <button type="button" data-pg="1">Próxima ›</button>
    </div>`;

  // Persona e aniversariantes: sempre sobre TODOS os clientes da API.
  el.querySelector('.persona').innerHTML = persona(todos);
  function renderAniv() {
    el.querySelector('.aniv-card').innerHTML =
      `<label class="aniv-mes">Mês <select>${MESES.map((m, i) => `<option value="${i}"${i === st.mes ? ' selected' : ''}>${m}</option>`).join('')}</select></label>` +
      aniversariantes(todos, st.mes);
    el.querySelector('.aniv-card select').addEventListener('change', (e) => { st.mes = +e.target.value; renderAniv(); });
  }
  renderAniv();

  const iso = (br) => {
    const m = (br || '').match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
  };

  function render() {
    const q = semAcento(st.busca);
    const de = iso(st.de);
    const ate = iso(st.ate);
    const filtrados = todos.filter((c) => {
      const reg = iso(c.dataRegistro);
      return (!q || semAcento(c.nome).includes(q)) && (!de || reg >= de) && (!ate || reg <= ate);
    });

    const tam = st.tam || filtrados.length || 1;
    const paginas = Math.max(1, Math.ceil(filtrados.length / tam));
    st.pag = Math.min(Math.max(1, st.pag), paginas);
    const ini = (st.pag - 1) * tam;
    const pagina = filtrados.slice(ini, ini + tam);
    const rows = linhas(pagina);
    const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    cli.querySelector('.tabela').innerHTML = rows.length
      ? `<div class="tbl-wrap"><table class="api"><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((r) => `<tr>${cols.map((c) => `<td${c === 'nome' ? ' class="nome"' : ''}>${r[c] == null || r[c] === '' ? '<span style="color:var(--ink-muted)">—</span>' : esc(r[c])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
      : '<p class="meta-line">Nenhum cliente encontrado.</p>';
    cli.querySelector('.pg-info').textContent =
      `Mostrando ${filtrados.length ? ini + 1 : 0}–${ini + pagina.length} de ${filtrados.length}${q ? ` (filtrado de ${todos.length})` : ''}`;
    cli.querySelector('.pg-num').textContent = `Página ${st.pag} de ${paginas}`;
    cli.querySelector('[data-pg="-1"]').disabled = st.pag <= 1;
    cli.querySelector('[data-pg="1"]').disabled = st.pag >= paginas;
  }

  // Filtros so aplicam ao clicar em Buscar (ou Enter).
  const form = el.querySelector('.filtros form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = (n) => form.querySelector(`input[name="${n}"]`).value.trim();
    for (const n of ['de', 'ate']) {
      if (v(n) && !iso(v(n))) { alertaData(n); return; }
    }
    Object.assign(st, { busca: v('busca'), de: v('de'), ate: v('ate'), pag: 1 });
    render();
  });
  form.querySelector('[data-limpar]').addEventListener('click', () => {
    form.reset();
    Object.assign(st, { busca: '', de: '', ate: '', pag: 1 });
    render();
  });
  function alertaData(n) {
    const inp = form.querySelector(`input[name="${n}"]`);
    inp.style.borderColor = 'var(--crit)';
    inp.focus();
    inp.addEventListener('input', () => { inp.style.borderColor = ''; }, { once: true });
  }
  cli.querySelector('select[name="tam"]').addEventListener('change', (e) => { st.tam = +e.target.value; st.pag = 1; render(); });
  cli.querySelectorAll('[data-pg]').forEach((b) => b.addEventListener('click', () => { st.pag += +b.dataset.pg; render(); }));
  render();
}
