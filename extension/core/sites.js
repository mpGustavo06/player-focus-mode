/* ============================================================
   core/sites.js — registro e resolução de perfis

   Cada site-supportado é um módulo em sites/*.js que se registra
   aqui. O content.js pergunta qual perfil pertence ao host atual e
   só aplica aquele.

   PARA ADICIONAR UM SITE:
     1. crie sites/<id>.js com o perfil (modelo em donghuanosekai.js)
     2. acrescente o arquivo na lista "js" do manifest, antes de content.js
     3. acrescente o domínio em "matches" e "host_permissions"
   ============================================================ */

(() => {
  "use strict";

  const PFM = (window.PFM = window.PFM || {});
  const registry = [];

  /* O host bate exatamente, ou é um subdomínio do host declarado?
     ex.: host "player.donghuanosekai.com" casa com o perfil que
     declara "donghuanosekai.com". */
  const hostMatches = (host, declared) => {
    const h = (host || "").toLowerCase();
    const d = (declared || "").toLowerCase();
    if (!h || !d) return false;
    if (d.startsWith("*.")) {
      const base = d.slice(2);
      return h === base || h.endsWith("." + base);
    }
    return h === d || h.endsWith("." + d);
  };

  /* Perfil obrigatório: todos os sites têm que definir isPlayerPage
     e player, senão a extensão age em página errada. O resto tem
     padrão vazio. */
  const registerSite = (profile) => {
    if (!profile || !profile.id) {
      throw new Error("[PFM] perfil sem id");
    }
    if (typeof profile.isPlayerPage !== "function") {
      throw new Error("[PFM] perfil " + profile.id + " sem isPlayerPage()");
    }
    if (!profile.player || !profile.player.stage) {
      throw new Error("[PFM] perfil " + profile.id + " sem player.stage");
    }

    registry.push({
      /* padrões que a extensão preenche */
      hosts: [],
      layout: { column: null, row: null, cell: null },
      controls: [],
      hide: { header: [], title: [], sidebar: [], comments: [], banners: [], always: [] },
      remove: [],
      css: "",
      /* o que o site precisa declarar */
      ...profile
    });
  };

  const allSites = () => registry.slice();

  PFM.registerSite = registerSite;
  PFM.allSites = allSites;
  PFM.hostMatches = hostMatches;
})();