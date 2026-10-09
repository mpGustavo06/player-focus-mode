/* ============================================================
   content.js — orquestrador (frame principal)

   O que este arquivo faz, em ordem:
     1. carrega os perfis de sites/
     2. resolve qual perfil pertence ao host atual
     3. monta o CSS a partir desse perfil + das opções
     4. decide se a página está "ativa" (é página de vídeo?)
     5. aplica as classes no <html> e limpa o DOM
     6. fica ouvindo mudanças de opção e de DOM

   Nenhuma estrutura de site aparece aqui — tudo vem do perfil.
   ============================================================ */

(() => {
  "use strict";

  const PFM = window.PFM;

  let profile = null;
  let options = { ...PFM.options.DEFAULTS };
  let active = false;

  /* estado do teatro DESTE site (ver core/theater.js) */
  let theater = false;

  /* ---------- o <style> gerado ----------

     Não vale anexar na criação do script: rodando em document_start,
     num documento em que o <html> ainda não foi criado, tanto
     document.head quanto document.documentElement podem ser null e
     a linha explodiria, derrubando TODO o resto do content.js — sem
     classes, sem limpeza, sem nada. Criamos o elemento já e só o
     anexamos quando houver um destino. */

  const styleEl = document.createElement("style");
  styleEl.id = "pfm-style";
  let styleMounted = false;

  const mountStyle = () => {
    if (styleMounted) return true;
    const host = document.head || document.documentElement;
    if (!host) return false;
    host.appendChild(styleEl);
    styleMounted = true;
    return true;
  };

  const renderCss = () => {
    if (!profile) {
      styleEl.textContent = "";
      return;
    }
    mountStyle();
    styleEl.textContent = PFM.style.buildCss(profile, options);
  };

  /* ---------- limpeza do DOM ---------- */

  const protectSelectors = () =>
    profile
      ? [profile.player.container, profile.player.stage].filter(Boolean)
      : [];

  const sweep = () => {
    if (!active || !profile) return;
    const protect = protectSelectors();

    if (options.hideAds) {
      PFM.nodes.removeMatches(document, PFM.style.AD_SELECTORS.join(","), protect);
    }
    if (options.hideComments && profile.removeComments) {
      PFM.nodes.removeMatches(
        document,
        profile.removeComments.join(","),
        protect
      );
    }
    if (profile.remove && profile.remove.length) {
      PFM.nodes.removeMatches(document, profile.remove.join(","), protect);
    }
    PFM.nodes.removeStrayText();
  };

  /* ---------- estado ---------- */

  /* ---------- alinhamento da stage no teatro ----------

     A stage vira position:fixed com inset:0, mas no animesdrive ela
     continua deslocada — 12px para a direita e 28px para baixo.

     A causa: um ancestral da cadeia (#single) é o offsetParent da
     stage, apesar de position:fixed. Isso acontece quando um
     ancestral cria containing block para os fixeds, e o tema do site
     usa `zoom` em toda a linha — que tem exatamente esse efeito.
     Nenhum getComputedStyle acusou transform/filter/contain, e por
     isso é invisível numa inspeção comum.

     Consequência: top:0 e left:0 passam a significar "borda do
     ancestral", e não "borda da janela". A caixa de 100vw x 100vh
     começava em (12, 28) e transbordava dos dois lados — o vídeo
     ficava cortado, que é o sintoma reportado.

     Por que transform e não margin/top: testei as alternativas no
     navegador e nenhuma movia a caixa (top:0, inset:0, bottom:auto,
     zoom:normal em toda a cadeia, width/height 100%). Só o
     transform, por ser aplicado DEPOIS de todo o cálculo de layout,
     sobrevive ao deslocamento do containing block.

     Os dois eixos são medidos, não chutados: comparamos onde a stage
     deveria estar (0,0) com onde ela está, e aplicamos a diferença.
     Um rAF remede a cada quadro, então resize e mudança de layout são
     acompanhados. */
  let theaterRaf = null;

  const alignTheaterStage = () => {
    if (!profile || !profile.player || !profile.player.stage) return;
    const sel = profile.player.stage;

    /* a regra precisa existir antes da primeira medição */
    let fix = document.getElementById("pfm-theater-fix");
    if (!fix) {
      fix = document.createElement("style");
      fix.id = "pfm-theater-fix";
      (document.head || document.documentElement).appendChild(fix);
    }
    const apply = (dx, dy) => {
      fix.textContent =
        "html.pfm-theater.pfm-theater-on " +
        sel +
        "{transform:translate(" +
        dx +
        "px," +
        dy +
        "px) !important;}";
    };

    const measure = () => {
      const node = document.querySelector(sel);
      if (!node || !node.isConnected) {
        apply(0, 0);
        return;
      }
      const r = node.getBoundingClientRect();
      /* onde ela está menos onde deveria estar */
      apply(-Math.round(r.left), -Math.round(r.top));
    };

    /* primeira passada: zera, mede, corrige */
    apply(0, 0);
    measure();

    if (theaterRaf) cancelAnimationFrame(theaterRaf);
    const loop = () => {
      measure();
      theaterRaf = requestAnimationFrame(loop);
    };
    theaterRaf = requestAnimationFrame(loop);
  };

  const unalignTheaterStage = () => {
    if (theaterRaf) {
      cancelAnimationFrame(theaterRaf);
      theaterRaf = null;
    }
    const fix = document.getElementById("pfm-theater-fix");
    if (fix) fix.textContent = "";
  };

  const applyState = () => {
    const root = document.documentElement;
    if (!root || !profile) return;

    const isPlayer =
      typeof profile.isPlayerPage === "function" ? profile.isPlayerPage() : false;
    const shouldBeActive = options.enabled && (!options.onlyOnPlayerPages || isPlayer);
    active = shouldBeActive;

    /* Não dá para sair cedo quando `active` não mudou: as classes
       dependem das OPÇÕES, não só de `active`. Um return antecipado
       aqui já fez os toggles do popup pararem de responder. */
    root.classList.toggle("pfm-active", active);
    root.classList.toggle("pfm-opt-nohdr", active && options.hideHeader);
    root.classList.toggle("pfm-opt-notitle", active && options.hideTitleBlock);
    root.classList.toggle("pfm-opt-nocomments", active && options.hideComments);
    root.classList.toggle("pfm-opt-noads", active && options.hideAds);
    root.classList.toggle("pfm-opt-wide", active && options.widePlayer);
    root.classList.toggle(
      "pfm-opt-onlyplayer",
      active && options.hidePlayerControls
    );
    /* A classe do teatro vai DUPLICADA de propósito. O CSS de layout do
       perfil é `html.pfm-active X` e o de teatro é
       `html.pfm-theater.pfm-theater X`: com uma classe só os dois
       empatariam em especificidade (0,2,1) e o perfil, emitido por
       último, sobrescreveria o teatro — o player voltaria a 16:9 e
       ancorado no fluxo, cortado na tela. Duplicando, o teatro passa
       a (0,3,1) e ganha em qualquer ordem. */
    root.classList.toggle("pfm-theater", active && theater);
    root.classList.toggle("pfm-theater-on", active && theater);
    if (active && theater) alignTheaterStage();
    else unalignTheaterStage();
    root.dataset.pfmSite = profile.id;
    /* o botão vive em outro frame; publica a stage para que ele possa
       se ancorar na caixa certa em vez de adivinhar pela marcação */
    if (profile.player && profile.player.stage) {
      root.dataset.pfmStage = profile.player.stage;
      /* o arbitro responde "onde está a stage?" aos frames do player */
      if (PFM.arbiter && PFM.arbiter.setStage) {
        PFM.arbiter.setStage(profile.player.stage);
      }
    }

    renderCss();
    if (active) sweep();
  };

  /* ---------- modo teatro ---------- */

  const toggleTheater = (force) => {
    const next = typeof force === "boolean" ? force : !theater;
    theater = next;
    PFM.theater.set(next);
    applyState();
  };

  /* window em capture, e nao document: o caminho de propagacao comeca
     no window, entao um handler do player (ArtPlayer/Video.js registra
     hotkeys em window com capture e chama stopPropagation) rodaria
     ANTES do nosso e engoliria o T assim que o video comecasse. */
  window.addEventListener(
    "keydown",
    (ev) => {
      if (!active) return;
      const tag = (ev.target && ev.target.tagName) || "";
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;

      if (ev.key === "t" || ev.key === "T") {
        ev.preventDefault();
        toggleTheater();
      } else if (ev.key === "Escape" && theater) {
        ev.preventDefault();
        toggleTheater(false);
      }
    },
    true
  );

  /* ---------- observação do DOM ---------- */

  let pending = false;
  let observer = null;

  /* fallback: sem requestAnimationFrame, uma exceção dentro do
     MutationObserver mataria o observer e a limpeza pararia de
     reagir a mudanças do DOM */
  const raf =
    typeof window.requestAnimationFrame === "function"
      ? window.requestAnimationFrame.bind(window)
      : (fn) => setTimeout(fn, 16);

  const onMutate = () => {
    if (pending) return;
    pending = true;
    raf(() => {
      pending = false;
      /* se o player ainda não apareceu, reavalia a detecção */
      applyState();
    });
  };

  const startObserving = () => {
    if (observer || !document.documentElement) return;
    observer = new MutationObserver(onMutate);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  };

  /* ---------- inicialização ---------- */

  const boot = async () => {
    /* o árbitro precisa estar pronto antes dos frames do player */
    PFM.arbiter.install();

    PFM.validateSites();
    profile = PFM.resolveSite(location.hostname);
    if (!profile) {
      console.info(
        "[PFM] nenhum perfil para " +
          location.hostname +
          " — a extensão não age nesta página."
      );
      return;
    }

    mountStyle();
    options = await PFM.options.load();
    theater = await PFM.theater.get();
    applyState();

    /* se o botão ligar/desligar o teatro, o frame principal precisa
       reagir: o botão vive em outro frame */
    PFM.theater.onChange((on) => {
      theater = on;
      applyState();
    });

    if (document.readyState === "loading") {
      document.addEventListener(
        "DOMContentLoaded",
        () => {
          applyState();
          startObserving();
        },
        { once: true }
      );
    } else {
      startObserving();
    }

    window.addEventListener("load", applyState, { once: true });

    /* rede de segurança: reavalia por alguns segundos após o load,
       porque o site pode montar o player por JS */
    let ticks = 0;
    const timer = setInterval(() => {
      applyState();
      if (++ticks > 40) clearInterval(timer);
    }, 250);

    PFM.options.onChange((o) => {
      options = o;
      applyState();
    });
  };

  boot();
})();