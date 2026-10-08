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

  /* distância do botão em relação à borda de baixo do vídeo, quando ele
     está no fallback (fora da barra de controles). Ajuste aqui se
     quiser subir/descer. */
  const BTN_BOTTOM = 158;

  let current = false;
  let next = false;
  let ui = null;

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
  const anchorToVideo = (host) => {
    const video = document.querySelector("video");
    if (!video || !video.parentElement) {
      document.body.appendChild(host);
      return;
    }

    const box = video.parentElement;
    // o absolute precisa de um containing block posicionado
    try {
      if (window.getComputedStyle(box).position === "static") {
        box.style.position = "relative";
      }
    } catch (e) {
      /* getComputedStyle indisponível */
    }

    box.appendChild(host);
    host.style.cssText =
      "position:absolute;left:8px;z-index:2147483000;opacity:1;" +
      "transition:opacity .35s ease;bottom:" +
      BTN_BOTTOM +
      "px;";
  };

  /* ---------- o botão ---------- */

  const buildUI = (inBar) => {
    const host = document.createElement("div");
    host.id = BTN_ID;

    /* Dentro da barra o botão entra no fluxo (ao lado do pause/volume).
       Fora da barra, o posicionamento é definido depois por
       anchorToVideo(), que o prende ao <video> e não à janela. */
    host.style.cssText = inBar
      ? "display:inline-block;vertical-align:middle;margin:0 4px;opacity:1;transition:opacity .35s ease;"
      : "position:absolute;left:8px;bottom:" +
        BTN_BOTTOM +
        "px;z-index:2147483000;opacity:1;transition:opacity .35s ease;";

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
      chrome.storage.sync.set({ theaterMode: next });
    });

    host.__btn = btn;
    host.__lbl = root.querySelector(".lbl");

    /* ---------- auto-hide ---------- */

    const hide = () => {
      host.style.opacity = "0";
    };

    const scheduleHide = () => {
      clearTimeout(host.__hideTimer);
      host.__hideTimer = setTimeout(hide, HIDE_AFTER_MS);
    };

    const show = () => {
      host.style.opacity = "1";
      scheduleHide();
    };

    host.addEventListener("mouseenter", show);
    host.addEventListener("mousemove", show);
    host.addEventListener("mouseleave", scheduleHide);

    /* qualquer movimento do mouse no frame reacende o botão */
    document.addEventListener("mousemove", show, { passive: true });
    document.addEventListener("touchstart", show, { passive: true });

    /* primeira aparição: fica mais tempo à vista */
    clearTimeout(host.__hideTimer);
    host.__hideTimer = setTimeout(hide, FIRST_SHOW_MS);
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

    /* se já existe um host neste frame, reaproveita */
    const already = document.getElementById(BTN_ID);
    if (already) {
      ui = already;
      paint();
      return;
    }

    const bar = findControlBar();
    const host = buildUI(!!bar);

    if (bar) bar.appendChild(host);
    else anchorToVideo(host);

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
  document.addEventListener(
    "keydown",
    (ev) => {
      const tag = (ev.target && ev.target.tagName) || "";
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;

      if (ev.key === "t" || ev.key === "T") {
        ev.preventDefault();
        ev.stopPropagation();
        next = !current;
        chrome.storage.sync.set({ theaterMode: next });
      } else if (ev.key === "Escape" && current) {
        ev.preventDefault();
        ev.stopPropagation();
        next = false;
        chrome.storage.sync.set({ theaterMode: false });
      }
    },
    true
  );

  /* ---------- estado ---------- */

  chrome.storage.sync
    .get({ theaterMode: false })
    .then((o) => {
      current = !!o.theaterMode;
      next = current;
      mountIfWinner();
      paint();
    })
    .catch(() => mountIfWinner());

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    if (!("theaterMode" in changes)) return;
    current = !!changes.theaterMode.newValue;
    next = current;
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
    if (ui && !ui.isConnected) {
      ui = null;
      /* avisa que a concessão anterior ficou sem botão, para o
         árbitro liberar a vaga em vez de ficar segurando */
      PFM.arbiter.notify(FRAME_ID, "gone");
      mountIfWinner();
    }
  }, 2000);
})();