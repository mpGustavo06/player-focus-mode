/* ============================================================
   DNSK Player Only — bloqueia scripts de ads/popunder no
   contexto MAIN (antes do script da página rodar).

   Só age se a página tiver o player de vídeo, para não
   interferir na navegação normal do site.
   ============================================================ */

(() => {
  "use strict";

  const isAdUrl = (url) =>
    /(^|\/\/|\.)(predictivadnetwork\.com|mgid\.com|jsc\.mgid\.com|adsterra\.com|propellerads\.com|exoclick\.com|onclick\.net|popcash\.net|adcash\.com|trafficjunky\.net|hilltopads\.net|clickadu\.com)\b/i.test(
      url || ""
    );

  const nativeOpen = window.open;

  window.open = function (url, ...rest) {
    try {
      const target = typeof url === "string" ? url : url && url.href;
      if (isAdUrl(target)) {
        console.warn("[DNSK] popup de anúncio bloqueado:", target);
        return null;
      }
    } catch (e) {
      /* ignore */
    }
    return nativeOpen.apply(window, [url, ...rest]);
  };

  try {
    Object.defineProperty(window, "open", {
      configurable: true,
      writable: true,
      value: window.open
    });
  } catch (e) {
    /* ignore */
  }

  /* A função dnskPlayerAd() abre o smartlink quando o player é
     carregado. Ela é redefinida aqui; o content script só permite
     a limpeza visual quando há player na página. */
  window.dnskPlayerAd = function () {
    console.warn("[DNSK] dnskPlayerAd() neutralizado.");
  };
})();