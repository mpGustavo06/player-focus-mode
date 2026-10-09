/* ============================================================
   player-bar.js — botão de modo teatro DENTRO do player

   Este script roda em TODOS os frames (all_frames: true), mas só age
   no frame que realmente contém o player de vídeo.

   Estrutura real do site (verificada baixando o HTML):

     donghuanosekai.com/<episodio>          <- frame principal
       └─ #playVideo > iframe
            donghuanosekai.com/player?...  <- wrapper do player
              └─ iframe
                   player.donghuanosekai.com/player-nativov2.php?v=<m3u8>
                        └─ <video>  <- AQUI fica a barra de controles

   A barra com pause / voltar / avançar está a dois níveis de iframe,
   por isso este script é separado do content.js (que roda só no frame
   principal).

   Ele éagnóstico de site: não conhece nenhum seletor do donghuanosekai.
   Detecta o player por assinatura de biblioteca de player (Video.js,
   JWPlayer, Plyr, ArtPlayer, Shaka, xgplayer) ou pela URL do endpoint.
   A única coordenação com a página é o árbitro (core/arbiter.js), que
   roda no frame principal e garante que só UM botão seja montado em
   toda a cadeia de iframes.

   Depende de core/arbiter.js estar carregado antes (o manifest
   garante a ordem).
   ============================================================ */

(() => {
  "use strict";

  /* id do host injetado neste frame */
  const BTN_ID = "pfm-theater-inplayer";

  /* ms de inatividade até o botão sumir de novo */
  const HIDE_AFTER_MS = 1500;

  /* ms que o botão fica visível na PRIMEIRA aparição. Um pouco maior
     que o normal, senão ele nasce e some antes de ser percebido. */
  const FIRST_SHOW_MS = 3000;

  /* posição do botão no canto superior direito do vídeo.
     Ajuste estes dois números se quiser aproximar/afastar da borda. */
  const BTN_TOP = 24;
  const BTN_RIGHT = 24;

  let current = false;
  let next = false;
  let ui = null;

  /* última posição conhecida do ponteiro, em coordenadas de tela.
     Usada para decidir se o botão deve continuar à vista: com o
     cursor sobre o player (que é um iframe), nenhum evento chega
     aqui, então perguntamos à posição, não ao evento. */
  const mouse = { x: -1, y: -1, at: -1e9 };

  /* ---------- onde a barra de controles costuma ficar ---------- */

  const CONTROL_BARS = [
    ".vjs-control-bar", // Video.js
    ".vjs-controls",
    ".jw-controls", // JWPlayer
    ".plyr__controls", // Plyr
    ".art-controls", // ArtPlayer
    ".vp-controls", // VideoPlayer
    ".shaka-controls-container", // Shaka
    ".xgplayer-controls", // xgplayer
    ".video-controls",
    ".player-controls",
    "#player-controls",
    ".controls"
  ];

  /* ---------- quem sou eu nesta cadeia de iframes ---------- */

  const frameDepth = () => {
    let d = 0;
    let w = window;
    while (w.parent && w.parent !== w && d < 8) {
      let p = null;
      try {
        p = w.parent;
      } catch (e) {
        break; // origem cruzada
      }
      if (!p) break;
      w = p;
      d++;
    }
    return d;
  };

  /* identidade única deste frame, usada no protocolo de arbitragem.
     Fica aqui porque depende de frameDepth(), declarado acima. */
  const FRAME_ID =
    (location.origin || "?") + "|" + frameDepth() + "|" + Math.random().toString(36).slice(2, 8);

  /* Este frame é o player?
     Sinals fortes: existir <video>, ou a raiz de alguma lib de player.
     Sinal fraco, mas útil: a URL do endpoint de player do site.

     Antes o frame intermediário `donghuanosekai.com/player?file=...`
     também casava pela URL, e injetar ali criava botão duplicado.
     Agora isso não é mais problema: quem garante exclusividade é a
     arbitragem (um único arbitrator no frame principal), e ela prefere
     o frame mais interno. */
  /* Frame principal de sites que EMBUTEM o player num iframe.

     No animesdrive não existe <video> neste frame, e o iframe é de
     outra origem — ou seja, o content script não roda lá dentro. Se
     este frame não se致病ar player, o botão nunca nasce.

     O sinal é o próprio iframe: a URL dele costuma apontar para o
     player, ou o container que a envolve tem "player"/"stage"/"video"
     no class ou id. */
  const hasEmbeddedPlayer = () => {
    try {
      const frames = document.querySelectorAll("iframe");
      for (let i = 0; i < frames.length; i++) {
        const f = frames[i];
        const src =
          (f.getAttribute("src") || "") +
          (f.getAttribute("data-src") || "") +
          (f.getAttribute("data-file") || "");
        if (/player|videoplay|embed|stream|m3u8|mp4/i.test(src)) return true;

        const box = f.parentElement;
        if (!box) continue;
        const sig = ((box.className || "") + " " + (box.id || "")).toLowerCase();
        if (/player|stage|video|embed/.test(sig)) return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  const isPlayerFrame = () => {
    try {
      if (document.querySelector("video")) return true;
      if (
        document.querySelector(
          ".video-js, .jwplayer, .plyr, .art-video, .xgplayer, .vjs-tech, video"
        )
      )
        return true;
      /* canvas/WebGL players podem não ter <video> visível ao
         document.querySelector; a URL ainda identifica o frame */
      const u = (location.pathname || "") + (location.search || "");
      if (/player-nativov2|\/player\?|\/player\/|player\.donghuanosekai/i.test(u))
        return true;
      if (hasEmbeddedPlayer()) return true;

      /* Página de VÍDEO cujo player ainda não carregou.

         player-bar.js roda em document_idle, e no animesdrive o
         player é montado por JS depois disso. Sem esta cláusula o
         isPlayerFrame() falhava, o botão nunca nascia, e o
         MutationObserver (que só age com `ui` vazio) não tinha o que
         reavaliar. Passa a valer a URL da página: se o endereço é de
         uma página de player, esperamos o player aparecer. */
      const u2 = location.pathname || "";
      if (/\/(episodio|episodio-?[\w-]*|watch|ver|assistir|player)\b/i.test(u2))
        return true;

      return false;
    } catch (e) {
      return false;
    }
  };

  const findControlBar = () => {
    for (const sel of CONTROL_BARS) {
      const el = document.querySelector(sel);
      // ignora containers altos demais para serem a barra de controles
      if (el && el.offsetHeight <= 200) return el;
    }
    return null;
  };

  /* Procura um botão JÁ injetado em algum frame de MESMA origem.
     Só é um atalho: não atravessa origem cruzada, sozinho não
     garante exclusividade (por isso existe a arbitragem). */
  const buttonExistsNearby = () => {
    const found = (doc) => {
      try {
        return !!doc && !!doc.getElementById(BTN_ID);
      } catch (e) {
        return false;
      }
    };

    if (found(document)) return true;

    let w = window;
    let guard = 0;
    while (w.parent && w.parent !== w && guard < 8) {
      let p = null;
      try {
        p = w.parent;
        if (found(p.document)) return true;
        const frames = p.document.querySelectorAll("iframe");
        for (let i = 0; i < frames.length; i++) {
          let d = null;
          try {
            d = frames[i].contentDocument;
          } catch (e) {
            continue; // iframe de outra origem
          }
          if (found(d)) return true;
        }
      } catch (e) {
        /* origem cruzada */
      }
      if (!p) break;
      w = p;
      guard++;
    }
    return false;
  };

  /* Onde ancorar o botão quando não achamos a barra de controles.

     O botão precisa acompanhar o VÍDEO, não a janela: se for
     `position: fixed`, ele fica grudado na tela e rola por cima de
     outros controles. A âncora é o container do <video>, com
     position absolute — assim ele desce junto com o player. */
  /* Prende o botão ao container do <video>, no canto superior direito.

     Importante ancorar no VÍDEO e não na janela: com `position: fixed`
     o botão fica grudado na tela e rola por cima de outros controles.
     Com `absolute` dentro do container do vídeo, ele acompanha o
     player quando a página rola. */
  /* Procura o container do player neste frame.

     1) o <video> e seu pai, quando estamos no frame que o contém;
     2) o pai do iframe do player, para sites que embutem o player
        (animesdrive).

     Devolve null quando ainda não há player — o botão fica no <body>
     e é movido depois por reanchor(). */
  /* O perfil do site declara onde está a stage do player. Ele é
     autoritativo: adivinhar pela marcação do iframe erra, porque no
     animesdrive a .animeo-player__source e a .animeo-player__media
     são 0x0 e a walk-up pode parar na caixa errada (ou ficar sem
     destino). PFM.sites não existe neste frame, então usamos o que o
     content.js publicou no <html> — ou, se não houver, caímos na
     heurística. */
  let cachedStage = null;

  const anchorFromProfile = () => {
    /* 1) já avons perguntado ao frame principal (vale para os dois
          sites: so o frame principal carrega o perfil) */
    const sel = (cachedStage || "").trim();
    if (!sel) return null;
    try {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      /* só serve se for uma caixa de verdade */
      return r.width > 40 && r.height > 40 ? el : null;
    } catch (e) {
      return null;
    }
  };

  /* Onde o vídeo aparece na tela.

     Devolve a CAIXA do player (a stage), nunca o <video> nem o iframe.
     O botão não é filho dessa caixa: ele vive no <body> e é
     posicionado por conta própria a partir deste retângulo (ver
     positionOverStage). Assim o site pode recriar o player, trocar a
     fonte ou recarregar o iframe à vontade — nada disso leva o botão
     junto, porque ele não está dentro. */
  const findAnchorBox = () => {
    /* 1) a stage que o perfil declarou */
    const byProfile = anchorFromProfile();
    if (byProfile) return byProfile;

    /* 2) <video>: subimos até a primeira caixa com área */
    const video = document.querySelector("video");
    if (video && video.parentElement) {
      let up = video.parentElement;
      let g = 0;
      while (up && up !== document.body && g < 8) {
        const r = up.getBoundingClientRect();
        if (r.width > 40 && r.height > 40) return up;
        up = up.parentElement;
        g++;
      }
    }

    /* 3) marcação de player conhecida */
    const marks =
      ".animeo-player__stage," +
      ".animeo-watch-main-v22," +
      ".vjs-tech," +
      "#playVideo," +
      "#player," +
      "[class*='player__stage']," +
      "[class*='player-stage']";
    for (const m of marks.split(",")) {
      const el = document.querySelector(m.trim());
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 40 && r.height > 40) return el;
    }

    return null;
  };

  /* Largura/altura reservadas, para o cálculo do canto funcionar já no
     primeiro quadro, antes de o shadow root ter sido laid out. */
  const BTN_EST_W = 95;
  const BTN_EST_H = 24;

  /* ---------- posicionamento ----------

     O botão fica NO <body>, com position:fixed, e a cada 250ms
     recalculamos top/right a partir do retângulo da caixa do vídeo.

     Por que não dentro do player: ancorado dentro, o botão era
     destruído junto com o player. O animesdrive recria a stage ao
     trocar de fonte, recarrega o iframe do vídeo e chega a montar a
     .animeo-player__media com 0x0 — em qualquer desses momentos o
     botão ficava invisível ou ia parar no canto da página. Como
     agora ele não é filho de nada que o site controle, sobrevive a
     tudo isso. */
  const positionOverStage = (host) => {
    const box = findAnchorBox();
    if (!box) {
      /* sem player na tela: esconde, mas continua montado */
      host.style.visibility = "hidden";
      return false;
    }

    const r = box.getBoundingClientRect();

    const w = host.offsetWidth || BTN_EST_W;

    /* O canto superior direito do vídeo é o ponto de ancoragem.
       Se ele sair da janela, o botão esconde — em vez de grudar no
       topo. Antes usávamos Math.max(0, ...) para não gerar top
       negativo, e era exatamente isso que prendia o botão na borda
       superior enquanto a página rolava. */
    const ax = r.right - w - BTN_RIGHT;
    const ay = r.top + BTN_TOP;

    const dentroDaTela =
      ay >= 0 && ay <= window.innerHeight - 20 &&
      ax >= 0 && ax <= window.innerWidth;

    if (!dentroDaTela) {
      host.style.visibility = "hidden";
      return false;
    }
    host.style.visibility = "visible";

    host.style.top = Math.round(ay) + "px";
    host.style.left = Math.round(ax) + "px";
    return true;
  };

  const anchorToVideo = (host) => {
    /* sempre no <body>: é o único lugar que o site não reconstrói */
    document.body.appendChild(host);
    positionOverStage(host);
  };

  /* Sem argumento: usa o botão atual. O observer e o watchdog chamam
     reanchor() sem passar nada, e antes positionOverStage era chamada
     com host explícito — daí o "undefined is not an object" quando
     o botão ainda não existia. */
  const reanchor = () => {
    if (!ui || !ui.isConnected) return;
    positionOverStage(ui);
  };

  /* ---------- o botão ---------- */

  /* O cursor está sobre o player?

     Vive fora do buildUI de propósito: o botão pode ser construído
     mais de uma vez, e um timer do buildUI anterior sobrevivia ao
     escopo dele, referenciava uma variável já destruída e derrubava o
     botão com ReferenceError. Aqui só usamos `ui` e a caixa real. */
  const RECENT_MS = 2000;

  const pointerInsidePlayer = () => {
    const box = findAnchorBox();
    if (!box) return false;
    const r = box.getBoundingClientRect();
    if (!r.width || !r.height) return false;

    if (mouse.x >= r.left && mouse.x <= r.right &&
        mouse.y >= r.top && mouse.y <= r.bottom) return true;

    return Date.now() - mouse.at < RECENT_MS;
  };

  const buildUI = () => {
    const host = document.createElement("div");
    host.id = BTN_ID;

    /* position:fixed no <body>, com top/left recalculados a partir da
       caixa do vídeo. Fica FORA do player de propósito: o site
       recria a stage e recarrega o iframe, e o botão acompanha sem
       ser filho de nada que o site controle. */
    host.style.cssText =
      "position:fixed;top:0;left:0;" +
      "z-index:2147483000;opacity:1;transition:opacity .35s ease;" +
      "will-change:top,left;";

    const root = host.attachShadow({ mode: "open" });

    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <style>
        .t {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 7px;
          border-radius: 4px;
          border: 0;
          background: transparent;
          color: #fff;
          font: 600 12px/1.2 "Segoe UI", system-ui, sans-serif;
          cursor: pointer;
          text-shadow: 0 1px 2px rgba(0,0,0,.9);
          -webkit-tap-highlight-color: transparent;
        }
        .t:hover { background: rgba(255,255,255,.16); }
        .t.on { color: #ff5470; }
        .t svg { width: 16px; height: 16px; display: block; fill: currentColor; }
        .t .k {
          font: 600 10px/1 ui-monospace, monospace;
          background: rgba(255,255,255,.16);
          border-radius: 3px;
          padding: 2px 4px;
        }
        .lbl { white-space: nowrap; }
      </style>
      <button class="t" type="button" title="Modo teatro (T)" aria-pressed="false">
        <svg viewBox="0 0 24 24">
          <path d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm0 2v9h16V6H4z"/>
          <path d="M7 8h2v5H7zM11 8h2v5h-2z"/>
        </svg>
        <span class="lbl">Teatro</span>
        <span class="k">T</span>
      </button>
    `;
    root.appendChild(wrap);

    const btn = root.querySelector(".t");
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation(); // não repassa o clique para o player
      next = !current;
      PFM.theater.set(next);
    });

    host.__btn = btn;
    host.__lbl = root.querySelector(".lbl");

    /* ---------- auto-hide ----------

       O botão some sozinho depois de HIDE_AFTER_MS sem atividade.

       O detalhe que quebrou o botão por semanas: ele fica DENTRO de
       um iframe (no animesdrive, .animeo-player__media É o iframe do
       player). Com o cursor sobre o vídeo, NENHUM evento chega ao
       documento pai — verificamos no navegador: entrar na caixa do
       iframe não dispara mouseenter, mouseover nem mousemove no pai.
       Então o botão aparecia no primeiro hover e nunca voltava.

       Por isso a decisão de esconder é feita por POSIÇÃO, não por
       evento: guardamos a última posição conhecida do ponteiro e a
       comparamos com a caixa do player num rAF. Se o cursor está
       dentro, o botão fica à vista; se saiu, o timer de
       HIDE_AFTER_MS corre.

       A posição do mouse é capturada em document, e supplementada por
       mouseover no pai — que é o que cobre a travessia de um iframe
       para outro. */
    host.__last = Date.now();

    /* A primeira aparição dura FIRST_SHOW_MS; depois, HIDE_AFTER_MS.
       Uma variável só, para o timer não aplicar o prazo curto antes da
       hora — foi o que deixava o botão com 1,5s de vida em vez de 3s. */
    host.__limite = FIRST_SHOW_MS;

    const show = () => {
      host.__last = Date.now();
      host.style.opacity = "1";
      clearTimeout(host.__hideTimer);
    };

    /* enquanto o cursor estiver dentro da área do player, fica à vista
       e não conta o tempo */
    const tick = () => {
      if (!host.__mounted) return;          // host descartado: para
      /* reposiciona: o player pode mover, redimensionar ou ser
         recriado, e o botão tem de acompanhar */
      positionOverStage(host);
      if (pointerInsidePlayer()) {
        host.__last = Date.now();
        host.style.opacity = "1";
      } else if (Date.now() - host.__last >= host.__limite) {
        host.style.opacity = "0";
        host.__limite = HIDE_AFTER_MS;
      }
      host.__tick = setTimeout(tick, 250);
    };

    /* a posição do ponteiro, capturada no documento */
    const track = (ev) => {
      mouse.x = ev.clientX;
      mouse.y = ev.clientY;
      mouse.at = Date.now();
      show();
    };
    ["mousemove", "pointermove", "mouseover", "pointerover"].forEach((ev) =>
      document.addEventListener(ev, track, { passive: true })
    );
    ["touchstart", "keydown", "wheel"].forEach((ev) =>
      document.addEventListener(ev, show, { passive: true })
    );

    host.addEventListener("mouseenter", show);
    host.addEventListener("mousemove", show);

    host.__last = Date.now();
    host.__mounted = true;
    /* setTimeout e não requestAnimationFrame: o rAF e pausado quando a
       aba vai para segundo plano, e o botao ficaria travado visivel
       (ou invisivel, se ja estivesse oculto). */
    host.__tick = setTimeout(tick, 250);
    host.__stopTick = () => {
      host.__mounted = false;
      clearTimeout(host.__tick);
    };

    return host;
  };

  const paint = () => {
    if (!ui) return;
    ui.__btn.classList.toggle("on", current);
    ui.__btn.setAttribute("aria-pressed", String(current));
    ui.__lbl.textContent = current ? "Sair" : "Teatro";
    ui.__btn.title = current ? "Sair do modo teatro (Esc)" : "Modo teatro (T)";
  };

  /* ---------- montagem ---------- */

  const mount = () => {
    if (ui) return;
    if (!document.body) return;
    if (!isPlayerFrame()) return;

    /* mountIfWinner pode ser chamado duas vezes seguidas (o storage
       e o observer disparam juntos). Sem esta trava, dois buildUI()
       rodavam, o segundo substituía `ui`, e o timer do primeiro
       continuava vivo referencing um escopo que ja saiu —
       daí o "lastActivity is not defined" que derrubava o botão.

       O botão é encontrado pelo id, então o segundo mount encontra o
       host do primeiro e reaproveita, sem criar outro. */
    const built = document.getElementById(BTN_ID);
    if (built) return;

    /* Reaproveita um host já existente — MAS só se for realmente
       nosso. Um div órfão com esse id (sobrou de uma renderização
       antiga, ou veio no HTML salvo) não tem shadow root nem botão:
       reaproveitar esse elemento deixaria um host invisível e o
       mount() nunca mais tentaria de novo. */
    const already = document.getElementById(BTN_ID);
    if (already && already.shadowRoot && already.shadowRoot.querySelector(".t")) {
      ui = already;
      /* o tick pode ter parado quando o host foi desconectado */
      if (!already.__mounted) already.__mounted = true;
      paint();
      return;
    }
    if (already && already.parentNode) already.parentNode.removeChild(already);

    /* o botão não entra na barra de controles: vai sempre ancorado no
       canto superior direito do vídeo. findControlBar() continua sendo
       usado apenas como sinal na arbitragem (para eleger o frame certo). */
    const host = buildUI();
    anchorToVideo(host);

    /* pergunta ao frame principal onde está a stage e, se souber,
       reanora nela. Sem isso a heurística pode parar numa caixa 0x0
       e o botão fica invisível. */
    if (PFM.arbiter && PFM.arbiter.askStage) {
      PFM.arbiter.askStage().then((sel) => {
        if (!sel) return;
        cachedStage = sel;
        try {
          const el = document.querySelector(sel);
          const r = el && el.getBoundingClientRect();
          if (el && r && r.width > 40 && r.height > 40 && ui) {
            placeIn(ui, el);
          }
        } catch (e) {
          /* seletor inválido: segue na heurística */
        }
      });
    }

    ui = host;
    paint();
    PFM.arbiter.notify(FRAME_ID, "mounted");

    /* heartbeat: enquanto este frame detém a vaga, avisa que continua vivo.
       Se o site destruir este iframe, o pulso para e o árbitro libera
       a vaga para o novo frame do player. */
    setInterval(() => {
      if (ui && !ui.isConnected) return;
      PFM.arbiter.notify(FRAME_ID, "ping");
    }, 3000);
  };

const mountIfWinner = async () => {
    /* Se o botão já foi montado mas o player re-renderizou e arrancou o
       nó do DOM, `ui` aponta para um elemento órfão. Sem esta checagem,
       `mount()` sairia pelo `if (ui) return` e o botão nunca voltaria. */
    if (ui && !ui.isConnected) {
      ui = null;
    }
    if (ui) return;
    if (!document.body) return;
    if (!isPlayerFrame()) return;

    /* atalho: já existe botão em algum frame acessível? */
    if (buttonExistsNearby()) return;

    /* O árbitro responde em milissegundos (é postMessage dentro da
       mesma aba), então a primeira tentativa é curta: se ninguém
       respondeu em 500ms, é porque não há árbitro. A segunda é mais
       generosa, para o caso de o frame principal estar carregando. */
    for (const timeoutMs of [500, 900]) {
      const granted = await PFM.arbiter.probe(
        FRAME_ID,
        frameDepth(),
        !!findControlBar()
      );
      if (granted === true) {
        mount();
        return;
      }
      if (granted === false) return; // outro frame ganhou, não insisto
      /* granted === null: árbitro não respondeu, tenta de novo */
    }

    /* Sem árbitro (frame principal sem a nossa versão, ou postMessage
       bloqueado), não montamos às cegas: era isso que gerava dois
       botões. Só montamos se, depois de tudo, não existir botão algum
       em nenhum frame — melhor um botão a mais tarde do que nenhum. */
    if (!buttonExistsNearby()) mount();
  };

  /* atalho: T liga/desliga, Esc sai do modo teatro.

     Precisa existir AQUI também, e não só no content.js: quando você
     clica no vídeo, o foco vai para dentro do iframe, e a tecla é
     disparada no documento do frame interno. O listener do frame
     principal nunca a vê. */
  /* window em capture, e nao document: o caminho de propagacao comeca
     no window, entao um handler do player (ArtPlayer/Video.js registra
     hotkeys em window com capture e chama stopPropagation) rodaria
     ANTES do nosso e engoliria o T assim que o video comecasse. */
  window.addEventListener(
    "keydown",
    (ev) => {
      const tag = (ev.target && ev.target.tagName) || "";
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;

      if (ev.key === "t" || ev.key === "T") {
        ev.preventDefault();
        ev.stopPropagation();
        next = !current;
        PFM.theater.set(next);
      } else if (ev.key === "Escape" && current) {
        ev.preventDefault();
        ev.stopPropagation();
        next = false;
        PFM.theater.set(false);
      }
    },
    true
  );

  /* ---------- estado ---------- */

  /* o estado e POR SITE: um site nao pode virar o outro */
  PFM.theater
    .get()
    .then((on) => {
      current = on;
      next = on;
      mountIfWinner();
      paint();
    })
    .catch(() => mountIfWinner());

  PFM.theater.onChange((on) => {
    current = on;
    next = on;
    mountIfWinner();
    paint();
  });

  /* o player pode ser montado depois (carregamento do m3u8) */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountIfWinner, { once: true });
  }
  window.addEventListener("load", mountIfWinner, { once: true });

  let pending = false;
  const raf =
    typeof window.requestAnimationFrame === "function"
      ? window.requestAnimationFrame.bind(window)
      : (fn) => setTimeout(fn, 16);
  const obs = new MutationObserver(() => {
    if (pending || ui) return;
    pending = true;
    raf(() => {
      pending = false;
      mountIfWinner();
      reanchor();
    });
  });

  const startObs = () => {
    if (document.documentElement) {
      obs.observe(document.documentElement, { childList: true, subtree: true });
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startObs, { once: true });
  } else {
    startObs();
  }

  /* Vigia o botão: players que reconstroem o próprio DOM (trocar
     qualidade, redimensionar) podem arrancar o host. Se isso acontecer,
     a gente remontaria — mas só se o árbitro liberar. Por isso avisamos
     o árbitro de que o botão anterior não existe mais. */
  setInterval(() => {
    if (ui && !ui.isConnected && ui.__tick) {
      clearTimeout(ui.__tick);
      ui.__tick = null;
    }
    reanchor();
    if (ui && !ui.isConnected) {
      ui = null;
      /* avisa que a concessão anterior ficou sem botão, para o
         árbitro liberar a vaga em vez de ficar segurando */
      PFM.arbiter.notify(FRAME_ID, "gone");
      mountIfWinner();
    }
  }, 2000);
})();