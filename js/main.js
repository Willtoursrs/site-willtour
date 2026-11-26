(function () {

    'use strict';

    function showHomePage(event, sectionId) {
        if (event) {
            event.preventDefault();
        }

        if (sectionId) {
            window.location.href = 'index.html#' + sectionId;
        } else {
            window.location.href = 'index.html';
        }
    };

    // Abrir Viagens Corporativas (Rota SPA)
    function showCorporatePage(event) {
        if (event) {
            event.preventDefault();
            window.location.href = 'corporativo.html';
        }
    }

    // Abrir Viagens de Lazer (Rota SPA)
    function showLeisurePage(event) {
        if (event) {
            event.preventDefault();
            window.location.href = 'lazer.html';
        }
    }

    // Abrir Ofertas de Viagem (Rota SPA)
    function showOffersPage(event) {
        if (event) {
            event.preventDefault();
            window.location.href = 'ofertas.html';
        }
    }
	
	//SCRIPTS DE COMPORTAMENTO//

        // Lógica de Toggle do Menu Mobile
        const mobileBtn = document.getElementById('mobile-btn');
        const mobileNav = document.getElementById('mobile-nav');

        if (mobileBtn && mobileNav) {
            mobileBtn.addEventListener('click', () => {
                mobileNav.classList.toggle('hidden');
            });
        }

        // Fechar menu mobile ao clicar em um link
        if (mobileNav) {
            const mobileLinks = mobileNav.querySelectorAll('a');
            mobileLinks.forEach(link => {
                link.addEventListener('click', () => {
                    mobileNav.classList.add('hidden');
                });
            });
        }

        // ── SISTEMA DE ROTAS LIMPAS COM HISTORY API (Sem o símbolo # no endereço) ──
        

        // Lógica do Carrossel de Imagens
        let currentSlide = 0;
        const slides = document.querySelectorAll('.slide-bg');
        const dots = document.querySelectorAll('.carousel-dot');
        const totalSlides = slides ? slides.length : 0;
        const slideInterval = 4000;
        let timer;

        function showSlide(index) {
            if (!slides || slides.length === 0) return;
            if (index >= totalSlides) index = 0;
            if (index < 0) index = totalSlides - 1;

            const oldSlide = currentSlide;

            slides.forEach((slide, i) => {
                if (slide) {
                    slide.classList.remove('active', 'previous');
                    if (i === index) {
                        slide.classList.add('active');
                    } else if (i === oldSlide) {
                        slide.classList.add('previous');
                    }
                }
            });

            if (dots) {
                dots.forEach((dot, i) => {
                    if (dot) {
                        if (i === index) {
                            dot.classList.replace('bg-white/40', 'bg-white');
                            dot.classList.add('scale-125');
                        } else {
                            dot.classList.replace('bg-white', 'bg-white/40');
                            dot.classList.remove('scale-125');
                        }
                    }
                });
            }

            currentSlide = index;
        }

        function nextSlide() {
            showSlide(currentSlide + 1);
        }

        function goToSlide(index) {
            clearInterval(timer);
            showSlide(index);
            startCarousel();
        }

        function startCarousel() {
            if (totalSlides > 0) {
                timer = setInterval(nextSlide, slideInterval);
            }
        }

        // Inicializar com rotas e carrossel
        document.addEventListener("DOMContentLoaded", () => {
            showSlide(0);
            startCarousel();
            //handleRouting(); // Processa a URL de entrada caso o cliente tenha entrado por um link direto
        });

        // Toggle do Touch nos Cards Interativos
        function toggleCard(element) {
            if (!element) return;
            const isActive = element.classList.contains('active');
            const container = element.closest('.benefits-grid') || element.closest('.services-container');
            if (container) {
                container.querySelectorAll('.hover-btn').forEach(btn => btn.classList.remove('active'));
            }
            
            if (!isActive) {
                element.classList.add('active');
            }
        }

        document.addEventListener('click', function(e) {
            if (!e.target.closest('.hover-btn')) {
                document.querySelectorAll('.hover-btn').forEach(btn => btn.classList.remove('active'));
            }
        });
 
     // RASTREAMENTO AVANÇADO GA4 — WILL TOUR SRS
    
      // ── 1. VIRTUAL PAGEVIEWS ───────────────────────────────────────────────
      // O rastreamento de visualização de página foi movido de forma segura diretamente para dentro das funções principais de navegação acima para evitar erros globais de runtime.

      // Eventos enviados com os MESMOS nomes configurados no Google Analytics:
      // Clique_no_WhatsApp, Profundidade_de_Rolagem, Clique_em_Card, Buscou_Passagem (+ Ver_Oferta no pop-up)
      function rastrear(nome, dados) {
          if (typeof gtag === 'function') gtag('event', nome, dados || {});
      }

      // ── CLIQUE NO WHATSAPP (inclui o botão do pop-up; o "Ver mais" dos cards não conta) ──
      document.addEventListener('click', function (e) {
          var link = e.target.closest ? e.target.closest('a[href*="wa.me"]') : null;
          if (!link || link.closest('.destination-card')) return;
          var origem = link.classList.contains('oferta-modal-whats') ? 'pop-up oferta'
                     : link.classList.contains('whatsapp-pulse') ? 'botão flutuante' : 'botão do site';
          var oferta = link.closest('.oferta-modal') ? (link.closest('.oferta-modal').querySelector('h3') || {}).textContent : '';
          rastrear('Clique_no_WhatsApp', { origem: origem, oferta: (oferta || '').trim() });
      });

      // ── PROFUNDIDADE DE ROLAGEM ──
      var depthsFired = {};
      window.addEventListener('scroll', function () {
          var total = document.documentElement.scrollHeight - window.innerHeight;
          if (total <= 0) return;
          var pct = Math.round((window.scrollY / total) * 100);
          [25, 50, 75, 90].forEach(function (depth) {
              if (pct >= depth && !depthsFired[depth]) {
                  depthsFired[depth] = true;
                  rastrear('Profundidade_de_Rolagem', { percentual: depth });
              }
          });
      });

      // ── CARDS DE SERVIÇO / BENEFÍCIOS ──
      document.querySelectorAll('.hover-btn').forEach(function (card) {
          card.addEventListener('click', function () {
              var span = card.querySelector('span');
              rastrear('Clique_em_Card', { card: span ? span.innerText.trim() : 'card' });
          });
      });

      // ── BUSCOU PASSAGEM: só quando o cliente realmente clica no widget da Befly (1 vez por visita) ──
      var widget = document.querySelector('befly-widget');
      if (widget) {
          var buscou = false;
          ['click', 'focusin'].forEach(function (ev) {
              widget.addEventListener(ev, function () {
                  if (buscou) return;
                  buscou = true;
                  rastrear('Buscou_Passagem', {});
              });
          });
      }

    // ===== CARROSSEL DE OFERTAS: setas para os lados (também arrasta no celular) =====
    document.querySelectorAll('.carrossel-ofertas').forEach(function (trilho) {
        // Página de ofertas: agrupa de 8 em 8 (4 em cima, 4 embaixo); a seta passa para as próximas 8
        if (trilho.classList.contains('carrossel-2linhas')) {
            var cards = Array.prototype.slice.call(trilho.querySelectorAll(':scope > .destination-card'));
            for (var n = 0; n < cards.length; n += 8) {
                var pagina = document.createElement('div');
                pagina.className = 'carrossel-pagina';
                cards.slice(n, n + 8).forEach(function (c) { pagina.appendChild(c); });
                trilho.appendChild(pagina);
            }
        }
        var wrap = document.createElement('div');
        wrap.className = 'carrossel-wrap';
        trilho.parentNode.insertBefore(wrap, trilho);
        wrap.appendChild(trilho);
        ['esq', 'dir'].forEach(function (lado) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'carrossel-seta ' + lado;
            b.setAttribute('aria-label', lado === 'esq' ? 'Ofertas anteriores' : 'Mais ofertas');
            b.innerHTML = '<i class="fa-solid fa-chevron-' + (lado === 'esq' ? 'left' : 'right') + '"></i>';
            b.addEventListener('click', function () {
                trilho.scrollBy({ left: (lado === 'esq' ? -1 : 1) * trilho.clientWidth, behavior: 'smooth' });
            });
            wrap.appendChild(b);
        });
        // Bolinhas em cima: mostram em qual página de ofertas o cliente está
        var bolinhas = document.createElement('div');
        bolinhas.className = 'carrossel-bolinhas';
        wrap.parentNode.insertBefore(bolinhas, wrap);
        function montaBolinhas() {
            var total = Math.max(1, Math.round(trilho.scrollWidth / trilho.clientWidth));
            if (bolinhas.children.length === total) return;
            bolinhas.innerHTML = '';
            for (var k = 0; k < total; k++) {
                (function (k) {
                    var d = document.createElement('button');
                    d.type = 'button';
                    d.setAttribute('aria-label', 'Página ' + (k + 1) + ' de ofertas');
                    d.addEventListener('click', function () { trilho.scrollTo({ left: k * trilho.clientWidth, behavior: 'smooth' }); });
                    bolinhas.appendChild(d);
                })(k);
            }
            bolinhas.style.display = total > 1 ? '' : 'none';
        }
        function atualizaSetas() {
            var max = trilho.scrollWidth - trilho.clientWidth - 5;
            wrap.querySelector('.esq').disabled = trilho.scrollLeft <= 5;
            wrap.querySelector('.dir').disabled = trilho.scrollLeft >= max;
            montaBolinhas();
            var atual = trilho.scrollLeft >= max ? bolinhas.children.length - 1 : Math.round(trilho.scrollLeft / trilho.clientWidth);
            Array.prototype.forEach.call(bolinhas.children, function (d, k) { d.classList.toggle('ativa', k === atual); });
        }
        trilho.addEventListener('scroll', atualizaSetas);
        window.addEventListener('resize', atualizaSetas);
        atualizaSetas();
    });

    // ===== CARD RESUMIDO: mostra só destino, noites, "A partir de" e parcelas; o resto aparece no pop-up =====
    // O HTML do card continua completo (lista e preço); o resumo é montado aqui a partir dele.
    document.querySelectorAll('.carrossel-ofertas .destination-card, .circ-grade .destination-card').forEach(function (card) {
        var lista = card.querySelector('ul');
        var preco = lista ? lista.nextElementSibling : null;
        if (!lista || !preco) return;
        var texto = preco.textContent.replace(/\s+/g, ' ');
        var itens = Array.prototype.map.call(lista.querySelectorAll('li'), function (li) { return li.textContent.trim(); });
        var duracao = itens.filter(function (t) { return /\d+\s*(noites|dias)/i.test(t); })[0] || '';
        var m = duracao.match(/\d+\s*(noites|dias)/i);
        duracao = m ? m[0].replace(/dias/i, 'dias') : '';
        var valor, sufixo = '';
        var dois = texto.match(/Valor para (2 pessoas|a família):\s*((R\$|USD|EUR)\s*[\d.,]+)/i);
        if (dois) {
            valor = dois[2]; sufixo = dois[1].toLowerCase() === 'a família' ? 'para a família' : 'para 2 pessoas';
        } else {
            var principal = texto.match(/(R\$|USD|EUR)\s*[\d.,]+/);
            valor = principal ? principal[0] : '';
            var ref = preco.querySelector('span span');
            sufixo = ref ? ref.textContent.trim().replace(/^\/\s*/, '') : '';
            if (sufixo === 'Total') sufixo = '';
            if (/^pessoa/i.test(sufixo)) sufixo = 'por ' + sufixo;
        }
        var parc = texto.match(/(\d+)x sem juros/i);
        // Ícones do que está incluso, lidos da lista do card
        var tudo = itens.join(' | ').toLowerCase();
        var inclusos = [
            [/voo|aéreo|aereo/, 'fa-plane', 'Voo'],
            [/hotel|resort|acomodação|acomodacao|noites/, 'fa-hotel', 'Hotel'],
            [/all inclusive/, 'fa-utensils', 'All inclusive'],
            [/café|cafe/, 'fa-mug-hot', 'Café'],
            [/transfer|traslado/, 'fa-van-shuttle', 'Transfer'],
            [/passeio|city tour/, 'fa-map-location-dot', 'Passeios'],
            [/ônibus|onibus/, 'fa-bus', 'Ônibus'],
            [/ingresso/, 'fa-ticket', 'Ingressos'],
            [/guia/, 'fa-user-tie', 'Guia'],
            [/seguro/, 'fa-shield-heart', 'Seguro']
        ].filter(function (x) { return x[0].test(tudo); });
        if (inclusos.some(function (x) { return x[2] === 'All inclusive'; })) {
            inclusos = inclusos.filter(function (x) { return x[2] !== 'Café'; });
        }
        var icones = inclusos.slice(0, 5).map(function (x) {
            return '<span><i class="fa-solid ' + x[1] + '"></i>' + x[2] + '</span>';
        }).join('');
        var resumo = document.createElement('div');
        resumo.className = 'oferta-resumo';
        resumo.innerHTML =
            (duracao ? '<p class="oferta-resumo-dur">' + duracao + '</p>' : '') +
            (icones ? '<div class="oferta-resumo-icones">' + icones + '</div>' : '') +
            '<p class="oferta-resumo-de">A partir de:</p>' +
            '<p class="oferta-resumo-valor">' + valor + '</p>' +
            (card.dataset.reais ? '<p class="oferta-resumo-reais" hidden></p>' : '') +
            (sufixo ? '<p class="oferta-resumo-suf">' + (dois ? 'valor total ' + sufixo : sufixo) + '</p>' : '') +
            (parc ? '<p class="oferta-resumo-parc">em até ' + parc[1] + 'x sem juros</p>' : '');
        // O aviso "*Os preços podem variar sem aviso prévio" fica no pop-up, junto do preço completo
        lista.parentNode.insertBefore(resumo, lista);
        card.classList.add('card-compacto');
    });

    // Câmbio do dia para o "valor estimado em reais" dos circuitos — 100% automático, no navegador do cliente.
    // Euro comercial (AwesomeAPI; reserva: open.er-api) + MARGEM, calibrada para ficar igual ao câmbio do operador
    // (17/11/2026: comercial 6,365 → operador 6,53 = +2,6%). Se as duas APIs falharem, não mostra o valor em reais.
    var MARGEM_CAMBIO = 1.026;
    // Trava: só aceita euro entre R$ 4,80 e R$ 8,00 (já com a margem); fora disso não mostra o valor em reais
    function guardaCambio(v) {
        var c = v * MARGEM_CAMBIO;
        if (c >= 4.8 && c <= 8) { window.WT_CAMBIO = { eur: c }; preencheReais(); }
    }
    // Card da lista (circuitos com data-reais): "valor aproximado: R$ ..." logo abaixo do valor em euro
    function preencheReais() {
        document.querySelectorAll('.oferta-resumo-reais').forEach(function (el) {
            var card = el.closest('.destination-card'), eur = parseFloat(card && card.dataset.preco);
            if (!eur) return;
            // Reais em cima (maior) e "a partir de EUR x" embaixo; sem câmbio, o card fica só em euro
            var resumo = el.parentNode, de = resumo.querySelector('.oferta-resumo-de'), val = resumo.querySelector('.oferta-resumo-valor');
            el.innerHTML = '<span>valor aproximado</span><b>R$ ' + Math.round(eur * window.WT_CAMBIO.eur).toLocaleString('pt-BR') + '</b>';
            el.hidden = false;
            if (de) { resumo.insertBefore(el, de); de.hidden = true; }
            if (val && !val.dataset.trocado) { val.textContent = 'a partir de ' + val.textContent.trim(); val.dataset.trocado = '1'; val.classList.add('oferta-resumo-eur-peq'); }
        });
    }
    fetch('https://economia.awesomeapi.com.br/json/last/EUR-BRL')
        .then(function (r) { return r.json(); })
        .then(function (j) { guardaCambio(parseFloat(j.EURBRL.bid)); })
        .catch(function () {
            fetch('https://open.er-api.com/v6/latest/EUR').then(function (r) { return r.json(); })
                .then(function (j) { guardaCambio(j.rates.BRL); }).catch(function () {});
        });

    // ===== POP-UP DA OFERTA: botão "Ver mais" abre os detalhes; dentro, botão leva ao WhatsApp =====
    // Para mostrar mais informações só no pop-up, coloque no card: <div class="oferta-detalhes hidden">...</div>
    var modal = document.createElement('div');
    modal.className = 'oferta-modal';
    modal.innerHTML = '<div class="oferta-modal-box" role="dialog" aria-modal="true">' +
        '<button type="button" class="oferta-modal-fechar" aria-label="Fechar"><i class="fa-solid fa-xmark"></i></button>' +
        '<div class="oferta-modal-img"></div><div class="oferta-modal-corpo"></div></div>';
    document.body.appendChild(modal);
    function fechaModal() { modal.classList.remove('aberto'); document.body.style.overflow = ''; }
    modal.addEventListener('click', function (e) { if (e.target === modal || e.target.closest('.oferta-modal-fechar')) fechaModal(); });
    // Segundo pop-up: roteiro completo dos circuitos (abre por cima do primeiro)
    var modalRot = document.createElement('div');
    modalRot.className = 'oferta-modal oferta-modal-rot';
    modalRot.innerHTML = '<div class="oferta-modal-box" role="dialog" aria-modal="true">' +
        '<button type="button" class="oferta-modal-fechar" aria-label="Fechar"><i class="fa-solid fa-xmark"></i></button>' +
        '<div class="oferta-modal-corpo"></div></div>';
    document.body.appendChild(modalRot);
    modalRot.addEventListener('click', function (e) { if (e.target === modalRot || e.target.closest('.oferta-modal-fechar')) modalRot.classList.remove('aberto'); });
    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        if (modalRot.classList.contains('aberto')) modalRot.classList.remove('aberto'); else fechaModal();
    });

    document.querySelectorAll('.destination-card a[href*="wa.me"]').forEach(function (botao) {
        botao.addEventListener('click', function (e) {
            e.preventDefault();
            var card = botao.closest('.destination-card');
            var img = card.querySelector('img');
            var titulo = card.querySelector('h3');
            var lista = card.querySelector('ul');
            var preco = card.querySelector('ul') ? card.querySelector('ul').nextElementSibling : null;
            var detalhes = card.querySelector('.oferta-detalhes');
            modal.querySelector('.oferta-modal-img').innerHTML = img ? '<img src="' + img.src + '" alt="' + (titulo ? titulo.textContent.trim() : '') + '">' : '';
            var corpo = modal.querySelector('.oferta-modal-corpo');
            corpo.innerHTML = '';
            [titulo, lista, detalhes].forEach(function (el) { if (el) corpo.appendChild(el.cloneNode(true)); });
            if (preco) {
                var p = preco.cloneNode(true); p.classList.add('oferta-preco'); corpo.insertBefore(p, detalhes ? corpo.lastChild : null);
                // Circuitos (teste no Sul de Portugal): valor estimado em reais pelo câmbio do dia (dados/cambio.json)
                var eur = parseFloat(card.dataset.preco);
                var suf = p.querySelector('span.font-black > span');
                if (card.dataset.reais && eur && window.WT_CAMBIO && suf) {
                    var brl = Math.round(eur * window.WT_CAMBIO.eur).toLocaleString('pt-BR');
                    var pilha = document.createElement('span');
                    pilha.className = 'oferta-reais';
                    pilha.innerHTML = '<b>R$ ' + brl + '</b><small>valor aproximado em reais</small>';
                    // "/ pessoa em quarto duplo" vai para a linha de baixo e vale para o euro e para o real
                    var linhaSuf = document.createElement('span');
                    linhaSuf.className = 'oferta-sufixo';
                    linhaSuf.textContent = suf.textContent.replace(/^\s*\/\s*/, 'por ');
                    suf.replaceWith(pilha);
                    var linha = pilha.parentNode;
                    // euro (número + asterisco) num bloco só, para alinhar pela base com o bloco dos reais
                    var blocoEur = document.createElement('span'); blocoEur.className = 'oferta-eur';
                    while (linha.firstChild !== pilha) blocoEur.appendChild(linha.firstChild);
                    linha.insertBefore(blocoEur, pilha);
                    var caixa = document.createElement('div'); caixa.className = 'oferta-valores';
                    linha.parentNode.insertBefore(caixa, linha);
                    caixa.appendChild(linha); caixa.appendChild(linhaSuf);
                }
            }
            var whats = document.createElement('a');
            whats.href = botao.href; whats.target = '_blank'; whats.rel = 'noopener';
            whats.className = 'oferta-modal-whats';
            whats.innerHTML = '<i class="fa-brands fa-whatsapp text-xl"></i><span>Reservar pelo WhatsApp</span>';
            corpo.appendChild(whats);
            // Circuitos: botão para abrir o roteiro completo em outro pop-up
            var roteiro = card.querySelector('.oferta-roteiro');
            if (roteiro) {
                var btRot = document.createElement('button');
                btRot.type = 'button';
                btRot.className = 'oferta-modal-roteiro-bt';
                btRot.innerHTML = '<i class="fa-solid fa-route"></i><span>Ver roteiro completo</span>';
                btRot.addEventListener('click', function () {
                    var c2 = modalRot.querySelector('.oferta-modal-corpo');
                    c2.innerHTML = '<h3 class="text-brandNavy font-extrabold">' + (titulo ? titulo.textContent.trim() : '') + '</h3>' +
                        '<div class="oferta-rot-topo"><p class="oferta-rot-sub">Roteiro dia a dia</p></div>';
                    var cid = card.querySelector('.oferta-cidades');
                    if (cid) {
                        var faixa = document.createElement('div');
                        faixa.className = 'oferta-cidades oferta-rot-cidades';
                        cid.querySelectorAll('.cid').forEach(function (x) { faixa.appendChild(x.cloneNode(true)); });
                        c2.querySelector('.oferta-rot-topo').appendChild(faixa);
                    }
                    var r = roteiro.cloneNode(true); r.classList.remove('hidden'); c2.appendChild(r);
                    var w2 = document.createElement('a');
                    w2.href = botao.href; w2.target = '_blank'; w2.rel = 'noopener';
                    w2.className = 'oferta-modal-whats';
                    w2.innerHTML = '<i class="fa-brands fa-whatsapp text-xl"></i><span>Reserve agora mesmo</span>';
                    c2.appendChild(w2);
                    modalRot.classList.add('aberto');
                    modalRot.querySelector('.oferta-modal-box').scrollTop = 0;
                    if (typeof gtag === 'function') {
                        gtag('event', 'Ver_Roteiro', { oferta: titulo ? titulo.textContent.trim() : '' });
                    }
                });
                corpo.insertBefore(btRot, whats);
            }
            // Duas colunas no computador: esquerda = descrição e saídas; direita = preço e botões
            var colA = document.createElement('div'); colA.className = 'oferta-col-a';
            var colB = document.createElement('div'); colB.className = 'oferta-col-b';
            Array.prototype.slice.call(corpo.children).forEach(function (el) {
                (el.matches('.oferta-preco, .oferta-modal-roteiro-bt, .oferta-modal-whats') ? colB : colA).appendChild(el);
            });
            corpo.appendChild(colA); corpo.appendChild(colB);
            var rodape = card.querySelector('.oferta-rodape');
            if (rodape) { var r = rodape.cloneNode(true); r.classList.remove('hidden'); corpo.appendChild(r); }
            modal.classList.add('aberto');
            document.body.style.overflow = 'hidden';
            if (typeof gtag === 'function') {
                gtag('event', 'Ver_Oferta', { oferta: titulo ? titulo.textContent.trim() : '' });
            }
        });
    });

    // Exporta apenas as funções necessárias
    Object.assign(window, {
        showHomePage,
        showSlide,
        nextSlide,
        goToSlide,
        startCarousel,
        toggleCard,
        showCorporatePage,
        showLeisurePage,
        showOffersPage,
    });

}());