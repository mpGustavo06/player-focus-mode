/* ============================================================
   DNSK Player Only — content script

   Regra central: a extensão SÓ age em páginas que realmente
   contêm o player de vídeo. Nada acontece na home, listas,
   busca, página de donghua, etc.

   A detecção é feita pelo DOM (#playVideo / #player /
   .slideItem[data-video-url]) e não pela URL, porque o padrão
   das URLs muda com o tempo. A classes `dnsk-active` no <html>
   é o gatilho de todo o CSS.
   ============================================================ */

(() => {
  "use strict";

  const DEFAULTS = {
    enabled: true,
    onlyOnPlayerPages: true,
    hideHeader: true,
    hideTitleBlock: true,
    hidePlayerControls: false,
    hideComments: true,
    hideAds: true,
    blockPopups: true,
    widePlayer: true,
    theaterMode: false
  };

  let options = { ...DEFAULTS };

  /* ---------- detecção do player ---------- */

  const isVideoPage = () => {
    // o player precisa existir E estar dentro do conteúdo do vídeo
    const play = document.querySelector("#playVideo");
    if (play) return true;
    const player = document.querySelector("#player");
    if (player) return true;
    // fallback: lista de players só existe em página de episódio
    return !!document.querySelector(".slideItem[data-video-url]");
  };

  let active = false;

  const applyState = () => {
    const root = document.documentElement;
    if (!root) return;

    const shouldBeActive = options.enabled && (!options.onlyOnPlayerPages || isVideoPage());

    const becameActive = shouldBeActive && !active;
    active = shouldBeActive;

    /* ATENÇÃO: não podemos sair cedo aqui só porque `active` não mudou.
       As classes abaixo dependem das OPÇÕES, não só de `active`. Um
       return antecipado fazia os toggles do popup pararem de funcionar
       depois da primeira aplicação. */
    root.classList.toggle("dnsk-active", active);
    root.classList.toggle("dnsk-opt-nohdr", active && options.hideHeader);
    root.classList.toggle("dnsk-opt-notitle", active && options.hideTitleBlock);
    root.classList.toggle(
      "dnsk-opt-nocomments",
      active && options.hideComments
    );
    root.classList.toggle("dnsk-opt-noads", active && options.hideAds);
    root.classList.toggle(
      "dnsk-opt-wide",
      active && options.widePlayer
    );
    root.classList.toggle(
      "dnsk-opt-onlyplayer",
      active && options.hidePlayerControls
    );

    /* modo teatro: só o vídeo, sem nenhum controle do site */
    root.classList.toggle(
      "dnsk-theater",
      active && !!options.theaterMode
    );

    if (active) sweep();

    return becameActive;
  };

  /* ---------- remoção física de nós ---------- */

  const AD_NODES = [
    'ins[class*="adsbygoogle"]',
    'div[id^="mgw"]',
    'div[id^="MarketGid"]',
    'div[id^="div-gpt-ad"]',
    'div[id^="cbox"]',
    'div#colorbox',
    'div#cboxOverlay',
    'div#multisync-iframe',
    'iframe[src*="doubleclick.net"]',
    'iframe[src*="googlesyndication.com"]',
    'iframe[src*="rubiconproject"]',
    'iframe[src*="recaptcha"]',
    'iframe#google_esf',
    'style[id^="ssp_doubleclick"]',
    'style[id^="new-mcvideo-styles"]',
    'script[src*="googlesyndication.com"]',
    'script[src*="mgid.com"]',
    'script[src*="recaptcha"]'
  ].join(",");

  /* Nós que o plugin de comentários (wpDiscuz) INJETA via JS depois do
     inline, então escondê-la por CSS é frágil: qualquer regra do
     plugin que reapareça traz o elemento de volta. Aqui removemos o nó
     de verdade, e o MutationObserver varre de novo se ele voltar. */
  const COMMENT_NODES = [
    "#wpd-bubble-wrapper",
    "#wpd-bubble",
    "#wpd-bubble-notification",
    "#wpd-bubble-add-message",
    "#wpd-bubble-count",
    "#wpd-bubble-all-comments-count",
    "#wpd-bubble-author",
    "#wpd-bubble-comment",
    "#wpdUserContentInfo",
    "#wpd-editor-source-code-wrapper",
    "#wpd-editor-source-code-wrapper-bg",
    ".wpd-bubble-wrapper"
  ].join(",");

  /* ---------- UI sobra do tema: o que sai do DOM de vez ----------

     Duas coisas diferentes, por isso uma lista só:

     1) .wide_video — o botão de expandir/tela cheia que fica no fim da
        ul.list da barra .controles. Como a barra é flex, escondê-lo por
        CSS já resolveria, mas remover o nó evita deixar o item no DOM.

     2) .report-wrapper — o modal de "Reportar". Ele NÃO existe no HTML
        servido: o script.js só chama `.report-wrapper.show()`, então é
        criado em tempo de execução por script de anúncio. Como o tema
        usa `display: table` dentro dele, um nó de texto órfão vira uma
        célula e aparece um ">" sozinho ocupando uma coluna. */
  const UI_NODES = [
    ".wide_video",
    ".report-wrapper",
    ".report-wrapper .content-wrapper",
    ".report-wrapper .content-container",
    ".report-wrapper .report-container"
  ].join(",");

  /* ---------- nós de texto órfãos "<" / ">" ----------

     O servidor entrega, no fim da página, um bloco de anúncio com
     aspas a mais:

         <<!--script>
         window['CboxReady'] = ...
         </script -->
         <script src="static.cbox.ws/embed/2.js"></script>
         </script -->

     O `<!--` deveria abrir um comentário HTML, mas o `<` extra faz o
     parser descartar a tag malformada — e sobra um nó de texto
     contendo só "<", que aparece no fim da página ocupando uma
     coluna (a região usa `display: table` no tema).

     Nó de texto não tem seletor, então CSS não resolve: é preciso
     remover o nó. O filtro abaixo é cirúrgico — só some nós cujo
     conteúdo é exclusivamente "<" ou ">", nunca texto de verdade. */
  const STRAY_TEXT = /^[<>]+$/;

  const removeStrayText = () => {
    if (!document.body) return 0;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    const kill = [];
    let node;
    while ((node = walker.nextNode())) {
      const t = (node.nodeValue || "").trim();
      if (t && STRAY_TEXT.test(t)) kill.push(node);
    }
    kill.forEach((n) => n.parentNode && n.parentNode.removeChild(n));
    return kill.length;
  };

  const removeMatches = (root, selector) => {
    if (!root || !root.querySelectorAll) return 0;
    let n = 0;
    root.querySelectorAll(selector).forEach((el) => {
      // nunca remove nada dentro do player
      if (el.closest("#player") || el.closest("#playVideo")) return;
      el.remove();
      n++;
    });
    return n;
  };

  const sweep = () => {
    if (!active) return;
    if (options.hideAds) removeMatches(document, AD_NODES);
    if (options.hideComments) removeMatches(document, COMMENT_NODES);
    removeMatches(document, UI_NODES);
    removeStrayText();
  };

    /* ---------- modo teatro ---------- */

  const toggleTheater = (force) => {
    options.theaterMode =
      typeof force === "boolean" ? force : !options.theaterMode;
    applyState();
    chrome.storage.sync.set({ theaterMode: options.theaterMode });
  };

  /* atalhos: T alterna, ESC sai do modo teatro */
  document.addEventListener(
    "keydown",
    (ev) => {
      if (!active) return;
      const tag = (ev.target && ev.target.tagName) || "";
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;

      if (ev.key === "t" || ev.key === "T") {
        ev.preventDefault();
        toggleTheater();
      } else if (ev.key === "Escape" && options.theaterMode) {
        ev.preventDefault();
        toggleTheater(false);
      }
    },
    true
  );

  /* ---------- arbitragem entre frames via postMessage ----------

     O storage funcionava como canal, MAS se chamasse (ou se
     chrome.storage.session não estivesse disponível em content script)
     o catch devolvia "pode montar", e CADA frame montava um botão.
     `buttonExistsNearby()` do player-bar.js não salva, porque ele não
     atravessa origem cruzada: o player é player.donghuanosekai.com e o
     wrapper é donghuanosekai.com.

     postMessage atravessa origem, então o frame PRINCIPAL vira o
     árbitro: cada frame pede permissão e só monta se receber "grant".
   */
  const FRAME = {
    grantedTo: null,
    grantedAt: 0,
    mountedAt: 0,
    pending: null,
    timer: null
  };
  const isTopFrame = () => window.top === window.self;

  /* Elege o melhor candidato: quem achou a barra de controles primeiro;
     em empate, o frame mais interno (é onde mora o player de verdade). */
  function electWinner() {
    const list = FRAME.pending || [];
    FRAME.pending = null;
    FRAME.timer = null;
    if (!list.length) return;

    const rank = (c) => (c.hasBar ? 1000000 : 0) + c.depth * 1000;
    const winner = list.reduce((b, c) => (rank(c) > rank(b) ? c : b), list[0]);

    FRAME.grantedTo = winner.id;
    FRAME.grantedAt = Date.now();
    FRAME.mountedAt = 0;

    for (const c of list) {
      if (!c.source) continue;
      c.source.postMessage(
        { __dnsk: "theater", kind: c.id === winner.id ? "grant" : "deny", id: c.id },
        "*"
      );
    }
  }

  if (isTopFrame()) {
    window.addEventListener("message", (ev) => {
      const d = ev.data;
      if (!d || d.__dnsk !== "theater") return;

      if (d.kind === "probe") {
        const now = Date.now();
        const granted = FRAME.grantedTo;
        // concede se ninguem tem, ou se quem tinha nao chegou a montar
        const expired = granted && now - FRAME.grantedAt > 1500 && !FRAME.mountedAt;

        if (granted && !expired) {
          if (ev.source) ev.source.postMessage({ __dnsk: "theater", kind: "deny", id: d.id }, "*");
          return;
        }

        /* Varios frames podem pedir. Nao damos a vaga ao primeiro que
           chega: juntamos as tentativas por ~300ms e elegemos o melhor. */
        if (!FRAME.pending) {
          FRAME.pending = [];
          FRAME.timer = setTimeout(electWinner, 300);
        }
        FRAME.pending.push({
          id: d.id,
          source: ev.source,
          depth: d.depth || 0,
          hasBar: !!d.hasBar
        });
      } else if (d.kind === "mounted") {
        if (d.id === FRAME.grantedTo) FRAME.mountedAt = Date.now();
      } else if (d.kind === "gone") {
        // o frame que tinha o botao perdeu o no: libera a concessao
        if (d.id === FRAME.grantedTo) {
          FRAME.grantedTo = null;
          FRAME.mountedAt = 0;
          FRAME.grantedAt = 0;
        }
      }
    });
  }

  /* ---------- observação do DOM ---------- */

  let pending = false;

  const onMutate = () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      // se o player ainda não apareceu, reavalia a detecção
      if (!active) applyState();
      else sweep();
    });
  };

  const start = () => {
    applyState();
    if (document.documentElement) {
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    }
  };

  const observer = new MutationObserver(onMutate);

  /* ---------- inicialização ---------- */



  chrome.storage.sync.get(Object.keys(DEFAULTS)).then(
    (stored) => {
      options = { ...DEFAULTS, ...stored };
      applyState();
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start, { once: true });
      } else {
        start();
      }
      window.addEventListener("load", applyState, { once: true });
      // rede de segurança: reavalia por alguns segundos após o load
      let ticks = 0;
      const timer = setInterval(() => {
        applyState();
        if (++ticks > 40) clearInterval(timer);
      }, 250);
    },
    (err) => {
      console.warn("[DNSK] falha ao ler opções", err);
      start();
    }
  );

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    for (const [k, v] of Object.entries(changes)) options[k] = v.newValue;
    applyState();
  });

})();