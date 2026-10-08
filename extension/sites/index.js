/* ============================================================
   sites/index.js — utilitários do registro de perfis

   Cada perfil (sites/<id>.js) se registra sozinho quando carrega,
   chamando PFM.registerSite(). Este arquivo só centraliza as
   consultas e a validação.

   PARA ADICIONAR UM SITE:
     1. crie sites/<id>.js com o perfil (modelo em donghuanosekai.js)
     2. acrescente "sites/<id>.js" na lista "js" do content script,
        em manifest.json, ANTES de content.js
     3. acrescente o domínio em "matches" e "host_permissions"
   ============================================================ */

(() => {
  "use strict";

  const PFM = (window.PFM = window.PFM || {});

  /* Resolve o host para um perfil. O primeiro que casa vence, então
     nenhum host pode estar declarado em dois perfis. */
  PFM.resolveSite = (host) =>
    PFM.allSites().find((p) =>
      p.hosts.some((h) => PFM.hostMatches(host, h))
    ) || null;

  PFM.describeSites = () =>
    PFM.allSites().map((s) => ({
      id: s.id,
      label: s.label || s.id,
      hosts: s.hosts
    }));

  /* Erros de configuração aparecem logo no console, e não como
     falha silenciosa na hora de limpar a página. */
  PFM.validateSites = () =>
    PFM.allSites().map((s) => {
      const problems = [];
      if (!s.hosts || !s.hosts.length) problems.push("sem hosts");
      if (typeof s.isPlayerPage !== "function")
        problems.push("sem isPlayerPage()");
      if (!s.player || !s.player.stage) problems.push("sem player.stage");
      if (problems.length) {
        console.warn("[PFM] perfil " + s.id + " inválido: " + problems.join(", "));
      }
      return { id: s.id, ok: problems.length === 0, problems };
    });
})();