// Filtro da página de circuitos: Região, País, Ordenar (listas flutuantes) e Ver todos.
// Cada card precisa de: data-preco (EUR), data-dias, data-regiao ("Itália|Europa Ocidental"),
// data-paises ("França|Itália") e data-top (1 = mais vendido).
(function () {
    var barra = document.getElementById('circ-filtro');
    var trilho = document.getElementById('circ-grade');
    if (!barra || !trilho) return;

    // Vendas só a partir de 2 meses à frente: esconde datas antes disso e tira o circuito que ficar sem nenhuma
    var NOMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    var MESES = { Jan: 0, Fev: 1, Mar: 2, Abr: 3, Mai: 4, Jun: 5, Jul: 6, Ago: 7, Set: 8, Out: 9, Nov: 10, Dez: 11 };
    var limite = new Date(); limite.setHours(0, 0, 0, 0); limite.setMonth(limite.getMonth() + 2);
    trilho.querySelectorAll('.destination-card').forEach(function (card) {
        var sobrou = 0;
        card.querySelectorAll('.oferta-saidas p').forEach(function (p) {
            var m = p.innerHTML.match(/^<b>(\d{4}):<\/b>\s*(.*)$/);
            if (!m) return;
            var ano = +m[1];
            var grupos = m[2].split('·').map(function (g) {
                var x = g.trim().match(/^(\w{3})\s+(.*)$/);
                if (!x || !(x[1] in MESES)) return '';
                var dias = x[2].split(',').map(function (d) { return d.trim(); }).filter(function (d) {
                    return new Date(ano, MESES[x[1]], +d) >= limite;
                });
                return dias.length ? '<span class="saida-mes"><b>' + NOMES[MESES[x[1]]] + ' ' + ano + ':</b> ' + dias.join(', ') + '</span>' : '';
            }).filter(Boolean);
            sobrou += grupos.length;
            if (grupos.length) p.innerHTML = grupos.join('');  // um mês por linha
            else p.remove();
        });
        if (!sobrou) card.remove();
    });

    var cards = Array.prototype.slice.call(trilho.querySelectorAll('.destination-card'));
    var guardados = document.createElement('div');
    guardados.hidden = true;
    trilho.parentNode.appendChild(guardados);

    var PADRAO = { ordem: 'menor', pais: '', regiao: '' };
    var estado = Object.assign({}, PADRAO);
    var nomesOrdem = { vendidos: 'Mais vendidos', menor: 'Menor preço', maior: 'Maior preço', dias: 'Menor duração' };
    var bt = function (a) { return barra.querySelector('[data-acao="' + a + '"]'); };
    var listaRegiao = barra.querySelector('[data-lista="regiao"]');
    var listaPais = barra.querySelector('[data-lista="pais"]');

    function valores(c, k) { return (c.dataset[k] || '').split('|').filter(Boolean); }
    function tem(c, k, v) { return !v || valores(c, k).indexOf(v) !== -1; }
    function num(c, k) { return parseFloat(c.dataset[k]) || 0; }

    // Monta uma lista suspensa com os valores existentes nos cards (e a quantidade de cada)
    function montaLista(el, chave, attr, rotuloTodos, base) {
        var cont = {};
        base.forEach(function (c) { valores(c, chave).forEach(function (v) { cont[v] = (cont[v] || 0) + 1; }); });
        var h = '<button type="button" ' + attr + '="">' + rotuloTodos + '</button>';
        Object.keys(cont).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); }).forEach(function (v) {
            h += '<button type="button" ' + attr + '="' + v + '">' + v + ' <small>(' + cont[v] + ')</small></button>';
        });
        el.innerHTML = h;
    }
    montaLista(listaRegiao, 'regiao', 'data-regiao-op', 'Todas as regiões', cards);

    function aplica() {
        // Países da lista acompanham a região escolhida
        var daRegiao = cards.filter(function (c) { return tem(c, 'regiao', estado.regiao); });
        montaLista(listaPais, 'paises', 'data-pais-op', 'Todos os países', daRegiao);

        var lista = daRegiao.filter(function (c) { return tem(c, 'paises', estado.pais); });
        lista.sort(function (a, b) {
            if (estado.ordem === 'maior') return num(b, 'preco') - num(a, 'preco');
            if (estado.ordem === 'dias') return num(a, 'dias') - num(b, 'dias') || num(a, 'preco') - num(b, 'preco');
            if (estado.ordem === 'vendidos') return num(b, 'top') - num(a, 'top') || num(a, 'preco') - num(b, 'preco');
            return num(a, 'preco') - num(b, 'preco');
        });
        // Grade completa: mostra 2 linhas e o botão "Ver mais circuitos" abre +2 linhas a cada clique
        cards.forEach(function (c) { guardados.appendChild(c); });
        lista.forEach(function (c) { trilho.appendChild(c); });
        estado.linhas = estado.linhas || 2;
        mostraLinhas();
        bt('regiao').querySelector('span').textContent = estado.regiao || 'Região';
        bt('pais').querySelector('span').textContent = estado.pais || 'País';
        bt('ordenar').querySelector('span').textContent = estado.ordem === PADRAO.ordem ? 'Ordenar' : nomesOrdem[estado.ordem];
        bt('regiao').classList.toggle('ativo', !!estado.regiao);
        bt('pais').classList.toggle('ativo', !!estado.pais);
        bt('ordenar').classList.toggle('ativo', estado.ordem !== PADRAO.ordem);
        barra.querySelectorAll('[data-ordem]').forEach(function (b) { b.classList.toggle('sel', b.dataset.ordem === estado.ordem); });
        barra.querySelectorAll('[data-regiao-op]').forEach(function (b) { b.classList.toggle('sel', b.dataset.regiaoOp === estado.regiao); });
        barra.querySelectorAll('[data-pais-op]').forEach(function (b) { b.classList.toggle('sel', b.dataset.paisOp === estado.pais); });
    }

    var btMais = document.createElement('button');
    btMais.type = 'button'; btMais.className = 'circ-mais';
    btMais.innerHTML = '<span>Ver mais circuitos</span><i class="fa-solid fa-chevron-down"></i>';
    trilho.parentNode.insertBefore(btMais, trilho.nextSibling);
    function colunas() { return getComputedStyle(trilho).gridTemplateColumns.split(' ').filter(Boolean).length || 1; }
    function mostraLinhas() {
        var itens = Array.prototype.slice.call(trilho.children), max = colunas() * estado.linhas;
        itens.forEach(function (c, i) { c.style.display = i < max ? '' : 'none'; });
        btMais.style.display = itens.length > max ? '' : 'none';
    }
    btMais.addEventListener('click', function () { estado.linhas += 2; mostraLinhas(); });
    window.addEventListener('resize', mostraLinhas);

    function fechaListas() { barra.querySelectorAll('.circ-drop.aberto').forEach(function (d) { d.classList.remove('aberto'); }); }

    // X dentro do botão do filtro em uso: limpa só aquele filtro (área de toque boa no celular)
    ['regiao', 'pais', 'ordenar'].forEach(function (a) {
        var x = document.createElement('span');
        x.className = 'circ-x'; x.setAttribute('role', 'button'); x.setAttribute('aria-label', 'Remover filtro');
        x.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        bt(a).appendChild(x);
    });

    barra.addEventListener('click', function (e) {
        var x = e.target.closest('.circ-x');
        if (x) {
            var qual = x.parentNode.dataset.acao;
            if (qual === 'regiao') { estado.regiao = ''; estado.pais = ''; }
            if (qual === 'pais') estado.pais = '';
            if (qual === 'ordenar') estado.ordem = PADRAO.ordem;
            estado.linhas = 2; fechaListas(); aplica(); return;
        }
        var b = e.target.closest('button');
        if (!b) return;
        var acao = b.dataset.acao;
        if (acao === 'ordenar' || acao === 'pais' || acao === 'regiao') {
            var drop = b.parentNode, estava = drop.classList.contains('aberto');
            fechaListas();
            if (!estava) drop.classList.add('aberto');
            return;
        }
        if (b.dataset.ordem) estado.ordem = b.dataset.ordem;
        else if (b.hasAttribute('data-regiao-op')) { estado.regiao = b.dataset.regiaoOp; estado.pais = ''; }
        else if (b.hasAttribute('data-pais-op')) estado.pais = b.dataset.paisOp;
        else return;
        estado.linhas = 2; fechaListas(); aplica();
    });
    document.addEventListener('click', function (e) { if (!e.target.closest('#circ-filtro')) fechaListas(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fechaListas(); });

    aplica();
}());
