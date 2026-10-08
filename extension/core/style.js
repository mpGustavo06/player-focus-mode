/* ============================================================
   core/style.js — gera o CSS a partir do perfil do site

   Não existe mais um content.css estático: as regras são montadas em
   runtime a partir do perfil do site + as opções do usuário. Assim
   adicionar um site não exige duplicar CSS.

   Todas as regras saem prefixadas com uma classe do gate
   (pfm-active / pfm-opt-* / pfm-theater), que o content.js só
   adiciona quando a página realmente tem player. É isso que impede
   a extensão de afetar a home e as listas.
   ============================================================ */

(() => {
  "use strict";

  const PFM = (window.PFM = window.PFM || {});

  /* selectors de anúncio: genéricos, funcionam em qualquer site.
     São redes de anúncio, não tied a um tema. */
  const AD_SELECTORS = [
    'ins[class*="adsbygoogle"]',
    ".adsbygoogle",
    'div[id^="mgw"]',
    'div[id^="MarketGid"]',
    'div[id^="div-gpt-ad"]',
    'div[id^="cbox"]',
    "#colorbox",
    "#cboxOverlay",
    ".CboxButton",
    "template",
    "#multisync-iframe",
    "#google_esf",
    'iframe[src*="doubleclick.net"]',
    'iframe[src*="googlesyndication"]',
    'iframe[src*="rubiconproject"]',
    'iframe[src*="recaptcha"]',
    'iframe[id="google_esf"]',
    'style[id^="ssp_doubleclick"]',
    'style[id^="new-mcvideo-styles"]',
    ".adsterra",
    ".ad-container"
  ];

  /* Cada seletor precisa receber o gate individualmente.
     Juntar a lista com "," e prefixar só uma vez produziria
     `html.pfm-gate .a,.b{...}` — e o `.b ficaria SEM gate, valendo
     em todas as páginas do site. */
  const hideRule = (gate, selectors) => {
    const list = (selectors || [])
      .filter(Boolean)
      .map((sel) => `${gate} ${sel}`)
      .join(",");
    return list ? `${list}{display:none!important}` : "";
  };

  /* rede de segurança: nenhum seletor pode escapar do gate */
  const findUngated = (css) => {
    const bad = [];
    const rules = css.match(/[^{}]+\{[^{}]*\}/g) || [];
    for (const rule of rules) {
      const selector = rule.split("{")[0].trim();
      if (!selector) continue;
      for (const part of selector.split(",")) {
        const s = part.trim();
        if (!s) continue;
        if (!/^html\.pfm-(active|opt-|theater)/.test(s)) bad.push(s);
      }
    }
    return bad;
  };

  const buildCss = (profile, options) => {
    const p = profile;
    const out = [];
    const stage = p.player.stage;
    const box = p.player.container || stage;
    const gate = "html.pfm-active";
    const wide = "html.pfm-opt-wide";
    const only = "html.pfm-opt-onlyplayer";
    const th = "html.pfm-theater";

    /* ---------- o que sempre some ---------- */
    out.push(hideRule(gate, p.hide.always));

    /* ---------- anúncios ---------- */
    out.push(hideRule("html.pfm-opt-noads", AD_SELECTORS));

    /* ---------- opções ---------- */
    out.push(hideRule("html.pfm-opt-nohdr", p.hide.header));
    out.push(hideRule("html.pfm-opt-notitle", [...p.hide.title, ...p.hide.sidebar]));
    out.push(hideRule("html.pfm-opt-notitle", p.hide.banners));
    out.push(hideRule("html.pfm-opt-nocomments", p.hide.comments));

    /* ---------- barra de controles ---------- */
    const barSel = (p.controls || []).filter(Boolean);
    const bar = barSel.map((c) => `${wide} ${c}`).join(",");
    if (bar) {
      out.push(
        `${bar}{background:#111!important;border-top:1px solid #262626!important;margin:0!important;padding:8px 10px!important}`
      );
      out.push(
        `${barSel.map((c) => `${only} ${c}`).join(",")}{display:none!important}`
      );
    }

    /* ---------- base ---------- */
    out.push(`${wide} body{background:#000!important;padding:0!important;margin:0!important}`);

    /* ---------- player em tela cheia ----------
       O tema costuma resolver a proporção do player com
       `padding-top` em porcentagem. Somar `aspect-ratio` por cima
       disso empilha duas caixas e o vídeo aparece esticado. Por
       isso zeramos o padding do container e passamos a controlar a
       proporção na stage, que o tema normalmente não estiliza. */
    out.push(
      `${wide} ${box}{width:100%!important;max-width:none!important;margin:0!important;background:#000!important;padding-top:0!important}`
    );
    out.push(
      `${wide} ${box} > *:not(${stage}){position:absolute!important;width:0!important;height:0!important;overflow:hidden!important;visibility:hidden!important;margin:0!important;padding:0!important}`
    );
    out.push(
      `${wide} ${stage}{position:relative!important;width:100%!important;max-height:none!important;aspect-ratio:16/9!important;margin:0!important;overflow:hidden!important}`
    );
    out.push(
      `${wide} ${stage} iframe{position:absolute!important;top:0!important;left:0!important;width:100%!important;height:100%!important;border:0!important;margin:0!important;max-width:none!important;transform:none!important;zoom:1!important}`
    );

    /* ---------- layout: a coluna ocupa a tela toda ---------- */
    for (const sel of [p.layout.column, p.layout.row, p.layout.cell]) {
      if (!sel) continue;
      out.push(
        `${wide} ${sel}{display:block!important;width:100%!important;max-width:none!important;padding:0!important;margin:0 auto!important}`
      );
    }

    /* ---------- modo "só o player" ---------- */
    out.push(`${only} ${stage}{aspect-ratio:auto!important;height:100vh!important}`);
    out.push(`${only} ${stage} iframe{height:100vh!important}`);

    /* ---------- modo teatro ----------
       Some com tudo o que o perfil marcou como removível e deixa a
       stage fixa em 100vw x 100vh. */
    const theaterHide = [
      ...p.hide.always,
      ...p.hide.header,
      ...p.hide.title,
      ...p.hide.sidebar,
      ...p.hide.comments,
      ...p.hide.banners,
      ...(p.controls || [])
    ];
    out.push(hideRule(th, theaterHide));
    out.push(
      `${th},${th} body{background:#000!important;margin:0!important;padding:0!important;overflow:hidden!important}`
    );
    for (const sel of [p.layout.column, p.layout.row, p.layout.cell]) {
      if (!sel) continue;
      out.push(
        `${th} ${sel}{display:block!important;width:100%!important;max-width:none!important;height:100vh!important;padding:0!important;margin:0!important;overflow:hidden!important}`
      );
    }
    out.push(
      `${th} ${box}{display:block!important;position:relative!important;width:100%!important;height:100vh!important;padding-top:0!important;background:#000!important}`
    );
    out.push(
      `${th} ${stage}{display:block!important;position:fixed!important;top:0!important;left:0!important;width:100vw!important;height:100vh!important;padding:0!important;aspect-ratio:auto!important;background:#000!important;overflow:hidden!important;z-index:2147483000!important;cursor:none}`
    );
    out.push(
      `${th} ${stage}:hover{cursor:default!important}`
    );
    out.push(
      `${th} ${stage} iframe{position:absolute!important;top:0!important;left:0!important;width:100%!important;height:100%!important;border:0!important;margin:0!important;transform:none!important;zoom:1!important}`
    );

    /* ---------- CSS cru do site ---------- */
    if (p.css) out.push(p.css.trim());

    const css = out.filter(Boolean).join("\n");

    /* O gate por seletor já é難 de acertar à mão — e quando falha,
       a extensão age em páginas que não deveria. Então conferimos. */
    const ungated = findUngated(css);
    if (ungated.length) {
      console.warn(
        "[PFM] CSS sem gate (age em qualquer página): " + ungated.join(" | ")
      );
    }

    return css;
  };

  PFM.style = { buildCss, findUngated, AD_SELECTORS };
})();