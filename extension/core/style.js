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

  /* O css cru do perfil vem escrito pelo autor, sem gate. Aplicamos o
     gate automaticamente para cada seletor, senão essa parte
     escaparia da proteção e valeria em páginas onde a extensão não
     deveria agir (home, listagens). */
  const gateRawCss = (raw, gate) => {
    /* Os comentários precisam sair ANTES de fatiar as regras. Se um
       comentário ficar colado no seletor, ele vira parte dele e a
       regra deixa de casar na pagina. */
    const clean = String(raw).replace(/\/\*[\s\S]*?\*\//g, "");
    const rules = clean.match(/[^{}]+\{[^{}]*\}/g) || [];
    return rules
      .map((rule) => {
        const brace = rule.indexOf("{");
        const selector = rule.slice(0, brace).trim();
        const body = rule.slice(brace);
        const gated = selector
          .split(",")
          .map((part) => {
            const t = part.trim();
            return t ? `${gate} ${t}` : "";
          })
          .filter(Boolean)
          .join(",");
        return gated + body;
      })
      .join("\n");
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
        /* `html.pfm-theater.pfm-theater-on` e `html.pfm-active ...`
           sao formas validas de gate. */
        /* O gate precisa começar por html.pfm-<algo>. Formas
           válidas: html.pfm-active X, html.pfm-opt-wide X,
           html.pfm-theater.pfm-theater-on X. */
        if (!/^html\.pfm-[\w-]+[.\[:\s]/.test(s) && !/^html\.pfm-[\w-]+$/.test(s)) bad.push(s);
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
    /* O teatro precisa vencer o layout do perfil sem depender da
       ordem das regras. `html.pfm-theater X` e `html.pfm-active X`
       empatam em especificidade (0,2,1), e aí quem decide é a ordem
       no stylesheet — e o CSS do perfil é emitido por último.

       Por isso o teatro carrega uma classe extra: com
       `html.pfm-theater` são (0,2,1), empatando com o perfil; com
       `html.pfm-theater.pfm-theater-on` são (0,3,1) e o teatro ganha
       de qualquer regra do perfil, em qualquer ordem. As duas classes
       vão no <html> (content.js usa document.documentElement). */
    const th = "html.pfm-theater.pfm-theater-on";

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
    /* Alguns sites deixam hijos legítimos na caixa ao lado da stage
       (no animesdrive, o bloco de servidores). Escondê-los quebraria
       a interface, então isso é opt-in por perfil. */
    if (p.player.collapseOtherChildren !== false) {
      out.push(
        `${wide} ${box} > *:not(${stage}){position:absolute!important;width:0!important;height:0!important;overflow:hidden!important;visibility:hidden!important;margin:0!important;padding:0!important}`
      );
    }
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
    /* `overflow:hidden` sozinho NÃO basta. O documento continua com a
       altura do conteúdo (no animesdrive, 945px numa tela de 900px):
       overflow:hidden corta a ROLAGEM, mas não impede o elemento de
       crescer. Com a rolagem cortada e a página maior que a tela, o
       player fixo em 100vh fica deslocado e o vídeo parece maior que
       a janela.

       Por isso travamos a altura também. */
    out.push(
      `${th},${th} body{` +
        `background:#000!important;margin:0!important;padding:0!important;` +
        `overflow:hidden!important;` +
        `height:100vh!important;max-height:100vh!important;min-height:0!important;` +
        `width:100vw!important;max-width:100vw!important}`
    );
    for (const sel of [p.layout.column, p.layout.row, p.layout.cell]) {
      if (!sel) continue;
      out.push(
        `${th} ${sel}{display:block!important;width:100%!important;max-width:none!important;height:100vh!important;padding:0!important;margin:0!important;overflow:hidden!important}`
      );
    }


    /* `position:static` no container do player.

       Ele era `position:relative`, e isso importa: um ancestral
       posicionado vira containing block para os `position:fixed` da
       stage. A partir daí, `left:0` deixa de significar "borda da
       janela" e passa a significar "borda do container" — que já
       está deslocada pelo respiro lateral do layout. A stage saía em
       x=12 e transbordava 12px à direita.

       No teatro o player ocupa a janela inteira, então o container
       não precisa se posicionar: ele só precisa existir. */
    out.push(
      `${th} ${box}{` +
        `display:block!important;position:static!important;` +
        `width:100%!important;max-width:none!important;` +
        `height:100vh!important;min-height:0!important;` +
        `padding:0!important;padding-top:0!important;margin:0!important;` +
        `background:#000!important;overflow:hidden!important}`
    );
    /* left/right:0 EXPLICITOS e inset:0.

       A stage vira position:fixed, mas sem `left`, ela é posicionada
       na posição estática que teria no fluxo — que herda o
       padding-left de 12px do respiro do #contenedor. Com
       width:100vw (a largura da janela inteira) mais esse offset, a
       stage terminava 12px além da borda direita e o vídeo ficava
       maior que a tela.

       `right:0` resolve: com left e right fixos e width:100vw, o
       navegador não consegue satisfazer os três, e o left (0) vence,
       ancorando a caixa exatamente na janela. */
/* Translação em vez de posicionamento.

       Verificado no animesdrive: mesmo com position:fixed, inset:0,
       width:100vw e toda a cadeia de ancestrais com padding:0 e
       position:static, a stage continuava em x=12. Nenhum
       getComputedStyle dos ancestrais acusava transform, filter,
       will-change ou contain — mas o Chrome trata a cadeia como
       containing block e desloca a caixa junto.

       Zenar padding dos ancestrais não resolve, e margin-left
       negativo também não (o offset é do containing block, não de
       margem). O que funciona é corrigir a posição final com
       translateX, que age depois de todo o cálculo de layout e por
       isso não é anulado pelo deslocamento do ancestral.

       O valor não é chutado: é medido em tempo de aplicação, a
       partir da posição real da stage, e reaplicado se mudar. */
    out.push(
      `${th} ${stage}{` +
        `display:block!important;position:fixed!important;` +
        `inset:0!important;top:0!important;left:0!important;right:0!important;` +
        `width:100vw!important;max-width:100vw!important;` +
        `height:100vh!important;max-height:100vh!important;` +
        `padding:0!important;margin:0!important;` +
        `aspect-ratio:auto!important;background:#000!important;` +
        `overflow:hidden!important;z-index:2147483000!important;cursor:none}`
    );
    out.push(
      `${th} ${stage}:hover{cursor:default!important}`
    );
    /* O conteúdo do player precisa preencher a tela INTEIRA no
       teatro — sem letterbox e sem object-fit herdado do layout
       normal (que é 16:9 e deixaria o vídeo cortado ou com barras
       numa tela de proporção diferente).

       Vale para <video> e para <iframe>: o animesdrive entrega o
       player por iframe, e antes o teatro dimensionava só o
       <video>, deixando o iframe com o tamanho do layout comum. */
    out.push(
      `${th} ${stage} iframe,${th} ${stage} video{` +
        `position:absolute!important;top:0!important;left:0!important;` +
        `width:100%!important;height:100%!important;` +
        `max-width:none!important;max-height:none!important;` +
        `min-width:0!important;min-height:0!important;` +
        `object-fit:contain!important;object-position:center!important;` +
        `border:0!important;margin:0!important;padding:0!important;` +
        `transform:none!important;zoom:1!important}`
    );

    /* ---------- CSS cru do perfil ----------

       Entra por ÚLTIMO de propósito. O CSS do perfil carrega o
       layout normal (stage em 16/9, position:relative), e ele é
      posto DEPOIS das regras de modo teatro. Com a mesma
       especificidade — `html.pfm-active X` contra `html.pfm-theater X` —
       quem vence é a ÚLTIMA regra do stylesheet. Se o perfil viesse
       antes, ele sobrescreveria o teatro e o player voltaria a ficar
       16:9 e ancorado no fluxo, cortado na tela.

       Regra geral: regras de ESTADO (teatro, só-player) têm de ser
       emitidas depois das de LAYOUT. */
    if (p.css) out.push(gateRawCss(p.css, gate));

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

  PFM.style = { buildCss, findUngated, gateRawCss, AD_SELECTORS };
})();