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

  /* ---------- o <style> gerado ---------- */

  const styleEl = document.createElement("style");
  styleEl.id = "pfm-style";
  (document.head || document.documentElement).appendChild(styleEl);

  const renderCss = () => {
    if (!profile) {
      styleEl.textContent = "";
      return;
    }
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
    root.classList.toggle("pfm-theater", active && !!options.theaterMode);
    root.dataset.pfmSite = profile.id;

    renderCss();
    if (active) sweep();
  };

  /* ---------- modo teatro ---------- */

  const toggleTheater = (force) => {
    const next =
      typeof force === "boolean" ? force : !options.theaterMode;
    PFM.options.set({ theaterMode: next });
    applyState();
  };

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

    options = await PFM.options.load();
    applyState();

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