const fmtBRL = v => v.toLocaleString('pt-BR', {style:'currency', currency:'BRL', maximumFractionDigits:0});
const donutColors = ['var(--accent)','var(--sunset)','var(--aqua)','var(--violet)','var(--yellow)'];
const V = new URL(import.meta.url).search; // ?v=... do index.html (anti-cache)
const { FAIXAS: FAIXAS_IDADE } = await import(`../dashboard/clientes.js${V}`);
const FAIXAS = FAIXAS_IDADE.map(([, , nome]) => nome);
let PEOPLE, DESTINOS, STATS;

function renderKpis(){
  const kpis = [
    {label:'Vendas cruzadas', value: `${STATS.vendasCruzadas} / ${STATS.totalVendas}`, sub: Math.round(STATS.vendasCruzadas/STATS.totalVendas*100)+'% das vendas com cliente identificado', cls:'accent'},
    {label:'Clientes únicos', value: STATS.clientesUnicos, sub: `de ${STATS.totalContatosClient} clientes pessoa física no cadastro`},
    {label:'Ticket médio', value: fmtBRL(STATS.brutoCruzado/STATS.vendasCruzadas), sub: 'por venda cruzada'},
    {label:'Gasto médio', value: fmtBRL(bruttoTotal()/PEOPLE.length), sub: 'por cliente único'},
  ];
  document.getElementById('kpis').innerHTML = kpis.map(k => `
    <div class="kpi ${k.cls||''}">
      <div class="label">${k.label}</div>
      <div class="value">${k.value}</div>
      <div class="sub">${k.sub}</div>
    </div>`).join('');
}

function bruttoTotal(){ return PEOPLE.reduce((a,p)=>a+p.bruto,0); }

function renderGenero(){
  const withGenero = PEOPLE.filter(p=>p.genero);
  const counts = {};
  withGenero.forEach(p => counts[p.genero] = (counts[p.genero]||0)+1);
  const entries = Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  const total = withGenero.length;

  document.getElementById('genero-note').textContent =
    'estimado pelo primeiro nome (a API não tem esse campo)';

  let offset = 0;
  const circ = 2*Math.PI*54;
  let arcs = '';
  entries.forEach(([name,count],i)=>{
    const frac = count/PEOPLE.length;
    arcs += `<circle cx="70" cy="70" r="54" fill="none" stroke="${donutColors[i%donutColors.length]}" stroke-width="20"
      stroke-dasharray="${(frac*circ).toFixed(1)} ${circ.toFixed(1)}" stroke-dashoffset="${(-offset*circ).toFixed(1)}" transform="rotate(-90 70 70)"/>`;
    offset += frac;
  });

  const legend = entries.map(([name,count],i)=>`
    <div class="row"><span class="swatch" style="background:${donutColors[i%donutColors.length]}"></span>${name}<span class="n">${count} · ${(count/total*100).toFixed(0)}%</span></div>
  `).join('');

  document.getElementById('genero-card').innerHTML = `
    <svg width="140" height="140" viewBox="0 0 140 140">
      <circle cx="70" cy="70" r="54" fill="none" stroke="var(--surface-2)" stroke-width="20"/>
      ${arcs}
      <text x="70" y="66" text-anchor="middle" font-family="Fraunces, serif" font-size="20" fill="var(--ink)" font-weight="600">${total}</text>
      <text x="70" y="83" text-anchor="middle" font-family="Inter, sans-serif" font-size="10.5" fill="var(--ink-muted)">registros</text>
    </svg>
    <div class="legend">${legend}</div>`;
}

function renderIdade(){
  const withAge = PEOPLE.filter(p=>p.idade!=null);
  document.getElementById('idade-note').textContent = `${withAge.length} de ${PEOPLE.length} clientes com data de nascimento válida`;
  const counts = {};
  FAIXAS.forEach(f=>counts[f]=0);
  withAge.forEach(p=>counts[p.faixa]++);
  const max = Math.max(...Object.values(counts),1);
  const rows = FAIXAS.map(f=>`
    <div class="hbar-row">
      <div class="hbar-name">${f}</div>
      <div class="hbar-track"><div class="hbar-fill" style="width:${(counts[f]/max*100).toFixed(1)}%; background:var(--accent)"></div></div>
      <div class="hbar-val">${counts[f]} · ${withAge.length ? (counts[f]/withAge.length*100).toFixed(0):0}%</div>
    </div>`).join('');
  const media = withAge.length ? (withAge.reduce((a,p)=>a+p.idade,0)/withAge.length).toFixed(1) : '—';
  document.getElementById('idade-card').innerHTML = rows + `
    <p class="section-note" style="margin-top:12px">Idade média: <b style="color:var(--ink)">${media} anos</b></p>`;
}

function renderDestinos(){
  const top = DESTINOS.slice(0,14);
  const max = Math.max(...top.map(d=>d.count));
  const html = top.map(d=>`
    <div class="hbar-row">
      <div class="hbar-name" title="${d.nome}">${d.nome}</div>
      <div class="hbar-track"><div class="hbar-fill" style="width:${(d.count/max*100).toFixed(1)}%; background:var(--sunset)"></div></div>
      <div class="hbar-val">${d.count}</div>
    </div>`).join('');
  document.getElementById('destinos-card').innerHTML = html;
}

function renderIdadeValorTable(){
  const withAge = PEOPLE.filter(p=>p.idade!=null);
  const rows = FAIXAS.map(f=>{
    const grupo = withAge.filter(p=>p.faixa===f);
    if(!grupo.length) return null;
    const media = grupo.reduce((a,p)=>a+p.bruto,0)/grupo.length;
    return `<tr><td>${f}</td><td class="num">${grupo.length}</td><td class="num strong">${fmtBRL(media)}</td></tr>`;
  }).filter(Boolean).join('');
  document.getElementById('idade-valor-table').innerHTML = `
    <thead><tr><th>Faixa</th><th class="num">Clientes</th><th class="num">Gasto médio</th></tr></thead>
    <tbody>${rows}</tbody>`;
}

function renderGeneroValorTable(){
  const withGenero = PEOPLE.filter(p=>p.genero);
  const generos = Array.from(new Set(withGenero.map(p=>p.genero)));
  const rows = generos.map(g=>{
    const grupo = withGenero.filter(p=>p.genero===g);
    const media = grupo.reduce((a,p)=>a+p.bruto,0)/grupo.length;
    return `<tr><td>${g}</td><td class="num">${grupo.length}</td><td class="num strong">${fmtBRL(media)}</td></tr>`;
  }).join('');
  document.getElementById('genero-valor-table').innerHTML = `
    <thead><tr><th>Gênero</th><th class="num">Clientes</th><th class="num">Gasto médio</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="3">Amostra insuficiente</td></tr>'}</tbody>`;
}

function renderPersona(){
  const withAge = PEOPLE.filter(p=>p.idade!=null);
  const media = withAge.length ? (withAge.reduce((a,p)=>a+p.idade,0)/withAge.length).toFixed(1) : '—';
  const ticketCliente = fmtBRL(bruttoTotal()/PEOPLE.length);
  const topDestinos = DESTINOS.slice(0,5).map(d=>d.nome).join(', ');
  const maior = (lista) => {
    const n = {};
    lista.forEach(k => n[k] = (n[k]||0)+1);
    return Object.entries(n).sort((a,b)=>b[1]-a[1])[0] || ['—',0];
  };
  const [faixaTop, faixaN] = maior(withAge.map(p=>p.faixa));
  const [generoTop, generoN] = maior(PEOPLE.map(p=>p.genero));
  document.getElementById('persona-card').innerHTML = `
    <div class="persona-badge">
      <div class="initials">${Math.round(media)}</div>
      <div class="name">Perfil típico</div>
      <div class="tag">com base em ${PEOPLE.length} clientes</div>
    </div>
    <div class="persona-facts">
      <div class="persona-fact"><span class="k">Idade</span><span class="v">Média de ${media} anos; a faixa mais comum é ${faixaTop} (${withAge.length ? Math.round(faixaN/withAge.length*100) : 0}% de quem tem data de nascimento).</span></div>
      <div class="persona-fact"><span class="k">Gênero</span><span class="v">${generoTop} em ${PEOPLE.length ? Math.round(generoN/PEOPLE.length*100) : 0}% dos clientes (estimado pelo primeiro nome). Ver ressalvas abaixo.</span></div>
      <div class="persona-fact"><span class="k">Gasto</span><span class="v">${ticketCliente} de gasto médio por cliente.</span></div>
      <div class="persona-fact"><span class="k">Destino</span><span class="v">${topDestinos} lideram as passagens aéreas vendidas.</span></div>
    </div>`;
}

function renderCaveats(){
  const semIdade = PEOPLE.length - PEOPLE.filter(p=>p.idade!=null).length;
  document.getElementById('caveat-box').innerHTML = `
    <span class="mark">!</span>
    <div>
      <b>Leia antes de usar este relatório para decisões</b>
      <ul>
        <li>O <b>gênero</b> não existe na API do Pax Pro: é <b>estimado pelo primeiro nome</b> e pode errar em nomes ambíguos.</li>
        <li>${STATS.vendasNaoCruzadas} de ${STATS.totalVendas} vendas não têm viajante pessoa física no cadastro de clientes. Vendas de teste, chargeback, canceladas e orçamentos ficam fora.</li>
        <li>${semIdade} de ${PEOPLE.length} clientes estão sem data de nascimento válida e ficam fora das contas de idade.</li>
        <li>O gasto de cada cliente é o valor dos itens em que ele viajou, então uma pessoa que paga a viagem da família aparece só com a parte dela.</li>
        <li>O destino é calculado pelo itinerário (aeroporto com a maior permanência), não por um campo próprio, e pode errar em roteiros com várias paradas.</li>
        <li>Amostra pequena (${PEOPLE.length} clientes, ${STATS.vendasCruzadas} vendas): médias por subgrupo são sensíveis a valores extremos isolados.</li>
      </ul>
    </div>`;
}

function renderAll(){
  document.getElementById('gerado-em').textContent = STATS.geradoEm;
  renderKpis();
  renderGenero();
  renderIdade();
  renderDestinos();
  renderIdadeValorTable();
  renderGeneroValorTable();
  renderPersona();
  renderCaveats();
}

const status = document.getElementById('status');
try {
  const { carregarDados } = await import(`./data.js${V}`);
  ({ PEOPLE, DESTINOS, STATS } = await carregarDados());
  renderAll();
  status.remove();
} catch (e) {
  status.textContent = `Não foi possível carregar os dados do Pax Pro: ${e.message}`;
}
