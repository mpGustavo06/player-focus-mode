/* ============================================================
   core/theater.js — estado do modo teatro, POR SITE

   Antes o modo teatro era UMA chave global ("theaterMode") em
   chrome.storage.sync. Consequência: os sites se misturavam —
   ligar o teatro no donghuanosekai ligava no animesdrive, e o botao
   de um site ficava marcado como "Sair" por causa do outro.

   Agora cada host tem a sua chave:

       theater:<hostname>

   Um mesmo player pode ser servido em varios subdominios, e cada um
   conta como um site independente.

   Este arquivo roda em TODOS os frames (main e player), porque o
   botao vive no frame do <video> e precisa ler o mesmo estado que
   o content.js escreve no frame principal.
   ============================================================ */

(() => {
  "use strict";

  const PFM = (window.PFM = window.PFM || {});

  /* Chave por SITE, nao por host exato.

     O player do donghuanosekai roda em player.donghuanosekai.com
     dentro da pagina donghuanosekai.com. Se a chave fosse o hostname
     de cada frame, o botao (que vive no frame do player) gravaria
     "theater:player.donghuanosekai.com" e o content.js (frame
     principal, host donghuanosekai.com) jamais veria a mudanca — o
     modo teatro nunca ativava pelo botao nem pelo atalho.

     Por isso a chave e o dominio registravel: subdominios do mesmo
     site compartilham o estado, e sites diferentes nao se misturam. */
  const SECOND_LEVEL = new Set([
    "com.br", "net.br", "org.br", "gov.br", "edu.br",
    "com.cn", "net.cn", "org.cn", "gov.cn",
    "com.ar", "com.mx", "com.co", "com.pe", "com.tr", "com.tw",
    "com.au", "net.au", "org.au", "co.uk", "org.uk", "ac.uk",
    "co.jp", "ne.jp", "or.jp", "co.kr", "co.in", "co.nz", "co.za"
  ]);

  const rootDomain = (host) => {
    const h = String(host || location.hostname || "").toLowerCase();
    const parts = h.split(".").filter(Boolean);
    if (parts.length <= 2) return h;
    const last2 = parts.slice(-2).join(".");
    if (SECOND_LEVEL.has(last2) && parts.length >= 3) {
      return parts.slice(-3).join(".");
    }
    return last2;
  };

  const key = (host) => "theater:" + rootDomain(host);

  const get = () =>
    chrome.storage.sync
      .get(key())
      .then((o) => !!o[key()])
      .catch(() => false);

  const set = (on) => {
    const patch = {};
    patch[key()] = !!on;
    return chrome.storage.sync.set(patch);
  };

  /* avisa quando o estado deste site muda (inclusive vindo de outra
     aba do mesmo site) */
  const onChange = (fn) => {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync") return;
      if (!(key() in changes)) return;
      fn(!!changes[key()].newValue);
    });
  };

  PFM.theater = { key, get, set, onChange, rootDomain };
})();