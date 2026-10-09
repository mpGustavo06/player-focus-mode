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

      /* some sempre que a limpeza está ativa.

         O .animeq-push-optin é o convite de notificações ("Não perca
         novos episódios!"). Ele é injetado por JS depois do
         carregamento, mas como o hide aqui é CSS puro, ele some
         assim que aparecer — não precisa de MutationObserver. */
      always: [
        ".fcmpbox",
        "#animeq-push-optin",
        ".animeq-push-optin",
        ".animeq-push-status"
      ]
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
      /* (a) container mais externo.

         Sem respiro lateral: o vídeo ocupa a largura toda da janela.
         Havia 12px de padding aqui para "colar o player da borda",
         mas o resultado era uma faixa vazia dos dois lados do
         vídeo — que é justamente o que incomodava. */
      #contenedor {
        max-width: none !important;
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
      }

      /* (a2) <br> soltos sobrando do breadcrumb removido.

         Esconder o breadcrumb tira a caixa dele, mas os <br> que
         o tema deixava ao redor continuam occupying linha: dois
         deles = 28px de espaço morto acima do vídeo. */
      #contenedor > br {
        display: none !important;
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
        width: auto !important;
        min-width: 0 !important;
        max-height: none !important;
        height: auto !important;
        margin: 0 !important;
        padding: 0 !important;
        border: 0 !important;
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

      /* (3) acabamento da barra e dos controles

         Estas regras vivem no PERFIL, e não no core: o core cuida
         so de esconder a barra no modo "so o player". O tema ja
         desenha separadores e botoes proprios, e uma regra generica
         acabava brigando com o estilo de cada site.

         O que estava feio, e por que:

           .animeo-player__meta e a BARRA: um bloco so, arredondado.
           .animeo-player__servers e .animeo-player__quick-controls
           sao LINHAS dentro dela: flex + gap, com um separador
           entre elas. A primeira linha nao ganha separador, senao
           ele aparece duplicado logo abaixo do topo arredondado.

         Os botoes ficavam com o estilo padrao do navegador (fundo
         cinza, borda 2px outset, sem raio) porque o tema estiliza
         classes especificas que nem sempre existem em todas as
         versoes do player. Aqui estilizamos o elemento, nao a
         classe. */
      .animeo-player__meta {
        display: block !important;
        background: #0d0f12 !important;
        border: 0 !important;
        border-radius: 12px !important;
        margin: 0 0 12px !important;
        padding: 0 !important;
        overflow: hidden !important;
        float: none !important;
      }

      .animeo-player__servers,
      .animeo-player__quick-controls,
      .animeo-player__status {
        display: flex !important;
        flex-wrap: wrap !important;
        align-items: center !important;
        gap: 8px !important;
        background: transparent !important;
        border: 0 !important;
        border-top: 1px solid #1e2128 !important;
        border-radius: 0 !important;
        margin: 0 !important;
        padding: 10px 12px !important;
        float: none !important;
      }

      /* a primeira linha encosta na barra: sem separador duplo */
      .animeo-player__meta > .animeo-player__servers:first-child,
      .animeo-player__meta > .animeo-player__quick-controls:first-child,
      .animeo-player__meta > .animeo-player__status:first-child {
        border-top: 0 !important;
      }

      /* navegacao anterior / todos / proximo */
      .animeo-watch-nav-v2474,
      .pag_episodes {
        display: block !important;
        background: transparent !important;
        border: 0 !important;
        margin: 12px 0 0 !important;
        padding: 0 !important;
        float: none !important;
      }
      .animeo-watch-nav-v2474 .pag_episodes,
      .pag_episodes.aq-nav-v241 {
        display: grid !important;
        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
        gap: 12px !important;
        margin: 0 !important;
      }

      /* os botoes */
      .animeo-player__meta button,
      .animeo-player__meta a,
      .animeo-player__meta [role="button"] {
        appearance: none !important;
        -webkit-appearance: none !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 6px !important;
        min-height: 34px !important;
        padding: 0 12px !important;
        border: 1px solid #262b34 !important;
        border-radius: 8px !important;
        background: #161a20 !important;
        color: #e8eaed !important;
        font: 600 12px/1 "Segoe UI", system-ui, sans-serif !important;
        cursor: pointer !important;
        white-space: nowrap !important;
        box-shadow: none !important;
        float: none !important;
        text-decoration: none !important;
        min-width: 0 !important;
      }
      .animeo-player__meta button:hover,
      .animeo-player__meta a:hover {
        background: #1e232b !important;
        border-color: #3a4250 !important;
        color: #fff !important;
      }
      .animeo-player__meta button:focus-visible,
      .animeo-player__meta a:focus-visible {
        outline: 2px solid #6ea8fe !important;
        outline-offset: 2px !important;
      }
      .animeo-player__meta .item a.nonex,
      .animeo-player__meta button[disabled] {
        opacity: 0.4 !important;
        pointer-events: none !important;
      }

      /* servidor ativo: destaca com a cor do proprio tema */
      .animeo-player__servers button.is-active,
      .animeo-player__servers .aq-server.is-active,
      .animeo-player__servers button[aria-pressed="true"] {
        background: #f5b400 !important;
        border-color: #f5b400 !important;
        color: #17130a !important;
      }
    `
  });
})();
