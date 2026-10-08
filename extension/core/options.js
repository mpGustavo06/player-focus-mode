/* ============================================================
   core/options.js — preferências do usuário

   Compartilhado por todos os sites. Os valores ficam em
   chrome.storage.sync, então acompanham o usuário entre sites.
   ============================================================ */

(() => {
  "use strict";

  const PFM = (window.PFM = window.PFM || {});

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

  let current = { ...DEFAULTS };

  const load = () =>
    chrome.storage.sync.get(Object.keys(DEFAULTS)).then(
      (stored) => {
        current = { ...DEFAULTS, ...stored };
        return current;
      },
      (err) => {
        console.warn("[PFM] falha ao ler opções", err);
        current = { ...DEFAULTS };
        return current;
      }
    );

  const set = (patch) => {
    current = { ...current, ...patch };
    return chrome.storage.sync.set(patch);
  };

  /* avisa quando o popup muda algo */
  const onChange = (fn) => {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync") return;
      for (const [k, v] of Object.entries(changes)) current[k] = v.newValue;
      fn(current);
    });
  };

  PFM.options = { DEFAULTS, load, set, onChange, get: () => current };
})();