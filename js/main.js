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
        // Envio direto do evento de GA4
        if (typeof gtag === 'function') {
            gtag('event', 'page_view', { page_title: 'Viagens Corporativas', page_path: '/corporativo' });
        }
    }

    // Abrir Viagens de Lazer (Rota SPA)
    function showLeisurePage(event) {
        if (event) {
            event.preventDefault();
            window.location.href = 'lazer.html';
        }

        // Envio direto do evento de GA4
        if (typeof gtag === 'function') {
            gtag('event', 'page_view', { page_title: 'Viagens de Lazer', page_path: '/lazer' });
        }
    }

    // Abrir Ofertas de Viagem (Rota SPA)
    function showOffersPage(event) {
        if (event) {
            event.preventDefault();
            window.location.href = 'ofertas.html';
        }
        // Envio direto do evento de GA4
        if (typeof gtag === 'function') {
            gtag('event', 'page_view', { page_title: 'Ofertas de Viagem', page_path: '/ofertas' });
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

      // ── 2. CLIQUE NO WHATSAPP ──────────────────────────────────────────────
      document.querySelectorAll('a[href*="wa.me"]').forEach(function(link) {
          if (link) {
              link.addEventListener('click', function() {
                  if (typeof gtag === 'function') {
                      gtag('event', 'whatsapp_click', { event_category: 'contato', event_label: 'Botão WhatsApp' });
                  }
              });
          }
      });

      // ── 3. SCROLL DEPTH ────────────────────────────────────────────────────
      const depthsFired = {};
      window.addEventListener('scroll', function() {
          const scrolled = window.scrollY;
          const docHeight = document.documentElement ? document.documentElement.scrollHeight : document.body.scrollHeight;
          const total = docHeight - window.innerHeight;
          if (total <= 0) return;
          const pct = Math.round((scrolled / total) * 100);
          [25, 50, 75, 90].forEach(function(depth) {
              if (pct >= depth && !depthsFired[depth]) {
                  depthsFired[depth] = true;
                  if (typeof gtag === 'function') {
                      gtag('event', 'scroll_depth', { event_category: 'engajamento', event_label: depth + '%', value: depth });
                  }
              }
          });
      });

      // ── 4. CARDS DE SERVIÇO ────────────────────────────────────────────────
      document.querySelectorAll('.hover-btn').forEach(function(card) {
          if (card) {
              card.addEventListener('click', function() {
                  const span = card.querySelector('span');
                  const label = span ? span.innerText.trim() : 'card';
                  if (typeof gtag === 'function') {
                      gtag('event', 'card_click', { event_category: 'interacao', event_label: label });
                  }
              });
          }
      });

      // ── 5. WIDGET BEFLY USADO ──────────────────────────────────────────────
      document.addEventListener('visibilitychange', function() {
          if (document.visibilityState === 'hidden') {
              if (typeof gtag === 'function') {
                  gtag('event', 'widget_usado', { event_category: 'busca', event_label: 'Cliente abriu busca Befly' });
              }
          }
      });

      document.querySelector('#quem-somos').addEventListener('click', function() {
        // Envio direto do evento de GA4
        if (typeof gtag === 'function') {
            gtag('event', 'page_view', { page_title: 'Quem Somos', page_path: '/quem-somos' });
        }
      });

      document.querySelector('#ofertas').addEventListener('click', function() {
        // Envio direto do evento de GA4
        if (typeof gtag === 'function') {
            gtag('event', 'page_view', { page_title: 'Ofertas', page_path: '/ofertas' });
        }
      });

      document.querySelector('#politica-privacidade').addEventListener('click', function() {
        // Envio direto do evento de GA4
        if (typeof gtag === 'function') {
            gtag('event', 'page_view', { page_title: 'Política de Privacidade', page_path: '/politica' });
        }
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