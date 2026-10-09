/* ============================================================
   sites/animesdrive.js — perfil do site

   Tudo que é específico do animesdrive.cloud vive aqui. Nenhum
   outro arquivo do core conhece esta estrutura.

   PARA ADICIONAR OUTRO SITE: copie este arquivo, troque os
   seletores (inspecione com F12) e registre em sites/index.js.
   ============================================================ */

(() => {
  "use strict";

  const PFM = (window.PFM = window.PFM || {});

  PFM.registerSite({
    id: "animesdrive",
    label: "AnimeS Drive",

    /* O site responde em mais de um domínio (animesdrive.cloud e o
       www). O casamento por sufixo em core/sites.js cobre os dois. */
    hosts: ["animesdrive.cloud"],

    /* ------------------------------------------------------------
       Como saber que é página de vídeo.

       O id do player é dinâmico (#animeq-player-<postId>-<n>),
       então não serve como seletor — usamos as classes.

      IMPORTANTE: este site tem `.animeq-player` só na página de
       episódio. A home, as listagens e a página do anime não têm,
       e é isso que protege a extensão de mexer nelas.
       ------------------------------------------------------------ */
    isPlayerPage() {
      return !!document.querySelector(".animeq-player__stage");
    },

    /* A caixa é `.animeq-player` e a stage é `.animeq-player__stage`,
       que é onde ficam os <video> e <iframe> de cada fonte. A stage
       só aparece em página de episódio, então duplica a proteção. */
    player: {
      container: ".animeq-player",
      stage: ".animeq-player__stage",
      /* Ao contrário do DNSK, aqui a caixa tem filhos legítimos ao
         lado da stage (o bloco __meta com os servidores). Esconder
         `container > *:not(stage)` derrubaria o seletor de fontes,
         então o nucleo só faz isso quando `collapseOtherChildren`
         está ligado — ver core/style.js. */
      collapseOtherChildren: false
    },

    /* O site usa grid com duas colunas (player + painel lateral com
       anterior/próximo), e a limpeza manual MANTÉM o painel lateral.
       Por isso não forçamos largura nem display aqui: mexer no
       container quebraria o grid. */
    layout: {
      column: null,
      row: null,
      cell: null
    },

    /* Controles que o usuário quer manter: seletor de servidores,
       controles rápidos, status e a navegação de episódios. */
    controls: [
      ".animeq-player__meta",
      ".animeq-player__servers",
      ".animeq-player__quick-controls",
      ".animeq-player__status",
      ".animeq-watch-nav-v2474",
      ".pag_episodes"
    ],

    hide: {
      /* cabeçalho de desktop (logo, menu, busca, notificações,
         conta). O header mobile (.fixheadresp) fica. */
      header: ["header.main", "header#header", ".hbox", ".fix-hidden"],

      /* breadcrumb + título SEO do episódio */
      title: ["#doo-breadcrumbs"],

      /* painel de episódios lateral, cartão de pontos, galeria e
         caixa de informações com a descrição */
      sidebar: [
        ".animeq-episode-rail-v22",
        ".aqp-card",
        ".dt_galery",
        ".animeq-watch-side-v247",
        ".animeq-points-slot-v247",
        "#info"
      ],

      /* comentários (relações + lista + formulário) */
      comments: [
        "#comments",
        ".comments-area",
        ".animeq-comment-reactions",
        ".animeq-post-reactions",
        "#respond",
        ".comment-respond",
        ".comment-form"
      ],

      /* rodapé inteiro (o site o espalha por várias tags) */
      banners: [
        "footer.animeq-footer",
        "footer.main",
        ".animeq-footer-grid",
        ".animeq-footer-about",
        ".animeq-footer-links",
        ".animeq-footer-partners",
        ".animeq-footer-brand",
        ".animeq-footer-bottom",
        ".animeq-footer-copy"
      ],

      /* some sempre que a limpeza está ativa */
      always: [".fcmpbox"]
    },

    /* nada precisa sair do DOM neste site */
    remove: [],

/* ------------------------------------------------------------
       Layout: os gargalos e por que cada um existe.

       Fontes (verificadas nas 16 folhas do site):
         front.style.min.css ....... #contenedor, #single, .dtsingle
         animeq-episode-player-v231  o grid do player

       ------------------------------------------------ (a) #contenedor
       #contenedor { max-width: 1200px; margin: 70px auto 0 }
       Prende TODO o conteúdo em 1200px.

       ------------------------------------------------ (b) #single
       body.single-episodes #single.dtsingle { padding-left: 10px;
         padding-right: 10px }
       Faixa lateral. (Há também `body.single-episo`, com 18px.)

       ------------------------------------------------ (c) .content
       .dtsingle .content { width: calc(100% - 360px); float: left }
       .dtsingle .content.left { margin-left: 360px }
       Margem reservada para a sidebar flutuante de 360px.

       ------------------------------------------------ (d) O GRID
       O gargalo que produzia o vão à direita. O site declara:

         body.single-episodes .animeq-watch-grid-v22 {
           grid-template-columns:
             minmax(0,3.35fr) minmax(300px,.95fr) !important;
           grid-template-areas:
             "aqmain aqside" "aqnav aqside" !important;
           column-gap: 16px !important;
         }

       São 3 filhos: .animeq-watch-main-v22 (aqmain),
       .animeq-watch-side-v247 (aqside) e .animeq-watch-nav-v2474
       (aqnav). A limpeza esconde o aqside — mas o GRID continua
       reservando a segunda coluna, que fica vazia: 300px+ de vão
       à direita do player.

       Dois motivos pelos quais a correção anterior não pegava:

         1) `grid-template-areas` não era sobrescrito. Ele sozinho já
            define DUAS colunas; trocar só grid-template-columns
            não remove a área.
         2) Especificidade. O site usa `body.single-episodes .x`
            = (0,2,1) com !important. Minha regra era
            `.x` = (0,2,1) com !important: empate.
            No empate vale a ordem da fonte, e o <link> do site vem
            DEPOIS do meu <style> — o site vencia. Aqui o seletor
            inclui `body.single-episodes`, elevando para (0,3,2).
    ------------------------------------------------------------ */
    css: `
      /* (a) container mais externo: único lugar com respiro lateral */
      #contenedor {
        max-width: none !important;
        width: 100% !important;
        margin: 0 auto !important;
        padding-left: 12px !important;
        padding-right: 12px !important;
      }

      /* (b) + (c) zera max-width, o padding lateral e a margem de 360px */
      body.single-episodes #single.dtsingle,
      #single.dtsingle,
      #dt_contenedor,
      #single.dtsingle > .content.animeq-episode-content-v22,
      .dtsingle .content,
      .dtsingle .content.left,
      .dt_contenedor {
        max-width: none !important;
        min-width: 0 !important;
        max-height: none !important;
        height: auto !important;
        margin: 0 !important;
        padding: 0 !important;
        float: none !important;
      }
      body.single-episodes #single.dtsingle,
      #single.dtsingle,
      #dt_contenedor {
        width: 100% !important;
      }

      /* (d) sem painel aqside, a segunda coluna não tem propósito.

         Aqui o grid é DESLIGADO de vez (display:block), em vez de
         reescrever colunas e áreas. Motivo: manter display:grid com
         grid-template-areas:none deixa o navegador criar trilhas
         implícitas, e o player colapsa para ~20px. Em block o
         comportamento é trivial e previsível. */
      body.single-episodes .animeq-watch-grid-v22,
      .animeq-watch-grid-v22 {
        display: block !important;
        grid-template-columns: none !important;
        grid-template-areas: none !important;
        grid-auto-flow: row !important;
        grid-auto-columns: auto !important;
        column-gap: 0 !important;
        row-gap: 0 !important;
        gap: 0 !important;
        max-width: none !important;
        width: 100% !important;
        min-width: 0 !important;
      }

      /* liberados do grid: em block, basta largura total */
      .animeq-watch-main-v22,
      .animeq-watch-nav-v2474 {
        grid-area: auto !important;
        grid-column: auto !important;
        grid-row: auto !important;
        float: none !important;
        max-width: none !important;
        width: 100% !important;
        min-width: 0 !important;
      }

      .animeq-player {
        max-width: none !important;
        width: 100% !important;
        min-width: 0 !important;
        margin: 0 0 16px !important;
      }

      /* (2) proporção e preenchimento da stage */
      .animeq-player__stage {
        position: relative !important;
        width: 100% !important;
        aspect-ratio: 16 / 9 !important;
        height: auto !important;
        min-height: 0 !important;
        max-height: none !important;
        overflow: hidden !important;
      }
      .animeq-player__source {
        position: absolute !important;
        inset: 0 !important;
      }
      .animeq-player__source:not(.is-active) {
        display: none !important;
      }
      .animeq-player__media {
        position: absolute !important;
        inset: 0 !important;
      }
      .animeq-player__stage video.animeq-player__video,
      .animeq-player__stage iframe.animeq-player__iframe {
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
        border: 0 !important;
        object-fit: contain !important;
        margin: 0 !important;
        max-width: none !important;
        transform: none !important;
      }
    `
  });
})();