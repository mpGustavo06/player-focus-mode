/* ============================================================
   sites/donghuanosekai.js — perfil do site

   Tudo que é específico do donghuanosekai.com vive aqui. Nenhum
   outro arquivo do core conhece esta estrutura.

   Para adicionar outro site, copie este arquivo, troque os
   seletores (inspecione com F12) e registre em sites/index.js.
   ============================================================ */

(() => {
  "use strict";

  const PFM = (window.PFM = window.PFM || {});

  PFM.registerSite({
    id: "donghuanosekai",
    label: "Donghua No Sekai",

    hosts: ["donghuanosekai.com"],

    /* ------------------------------------------------------------
       Como saber que é página de vídeo.

       Feito pelo DOM, e não pela URL: o padrão dos slugs muda com o
       tempo (/donghua-5-episodio-09, /outro-slug-episodio-12...), mas
       a estrutura do player é estável.

       Importante: o site tem várias páginas que NÃO têm player
       (home, listas, busca, página do donghua). É este método que
       protege a extensão de mexer nelas.
       ------------------------------------------------------------ */
    isPlayerPage() {
      return !!document.querySelector(
        "#playVideo, #player, .slideItem[data-video-url]"
      );
    },

    /* O player é um iframe dentro de #playVideo, que fica dentro de
       #player. O tema resolve a proporção com `padding-top: 56.6%`
       no #player — por isso o core zera esse padding e passa a
       controlar a proporção no #playVideo. */
    player: {
      container: "#player",
      stage: "#playVideo"
    },

    /* O tema usa .rwl como <table> e .clw/.crw como <table-cell>
       (a sidebar). Com a sidebar escondida, viramos tudo para block
       para a coluna ocupar 100%. */
    layout: {
      column: ".m_center",
      row: ".rwl",
      cell: ".clw"
    },

    /* barra de controles do site (fora do player) */
    controls: [".mobile_b", ".controles"],

    hide: {
      /* cabeçalho: logo, busca, login, hamburger.
         O <ul class="m_menu"> é mantido (links de navegação úteis). */
      header: ["header .m_nav", "header .separador", "header .menu_open"],

      /* título do episódio, data, categoria, visualizações, social */
      title: [".article_title"],

      /* sidebar com a lista de episódios e widgets */
      sidebar: [
        ".rwl .crw",
        "#list_eps",
        ".sidebar",
        ".titleSidebar",
        ".sidebarContent",
        ".postsNew",
        ".widget_recent_entries",
        ".recent-posts-2"
      ],

      /* comentários (plugin wpDiscuz) */
      comments: [
        ".comments-area",
        "#comments",
        "#wpdcom",
        ".wpd-thread-wrapper",
        "#respond",
        ".wpdiscuz_top_clearing",
        ".related_posts",
        ".wpd-bubble-wrapper",
        "#wpdUserContentInfo",
        "#wpd-editor-source-code-wrapper",
        "#wpd-editor-source-code-wrapper-bg",
        "footer.footer",
        ".creditos",
        "nav.legal-nav",
        ".legal-nav small"
      ],

      /* banners de divulgação */
      banners: [
        '#fullno > div[style*="text-align: center"]',
        '#fullno > div[style*="justify-content"]',
        '#fullno a[href*="patreon"]',
        '#fullno a[href*="whatsapp"]',
        '#fullno a[href*="telegram"]',
        "#fullno video",
        ".btn_patreon",
        ".sliderRecomendado",
        ".titleC"
      ],

      /* some sempre que a limpeza está ativa, independente das
         opções: botão de expandir, modal de reportar, espaços
         reservados a anúncio, miniatura sobre o player, lightbox */
      always: [
        ".wide_video",
        ".report-wrapper",
        ".report-wrapper *",
        ".videoFull",
        ".js_video_main",
        "#thumbHis",
        "#light"
      ]
    },

    /* Nós que saem do DOM de vez. CSS esconderia, mas o layout da
       barra é flex e ficaria espaço sobrando; e o .report-wrapper é
       criado em tempo de execução por script de anúncio, com
       display:table dentro — um nó de texto órfão vira uma célula
       e aparece um ">" sozinho numa coluna. */
    remove: [
      ".wide_video",
      ".report-wrapper",
      ".report-wrapper .content-wrapper",
      ".report-wrapper .content-container",
      ".report-wrapper .report-container"
    ],

    /* A bolha do wpDiscuz vem com style="display:block" inline, então
       escondê-la por CSS é frágil: o plugin re-renderiza e traz de
       volta. Aqui removemos o nó, e o MutationObserver limpa de novo
       se ele reaparecer. */
    removeComments: [
      "#wpd-bubble-wrapper",
      "#wpd-bubble",
      "#wpd-bubble-notification",
      "#wpd-bubble-add-message",
      "#wpd-bubble-count",
      "#wpd-bubble-all-comments-count",
      "#wpd-bubble-author",
      "#wpd-bubble-comment"
    ],

    css: ""
  });
})();