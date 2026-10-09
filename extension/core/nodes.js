/* ============================================================
   core/nodes.js — limpeza do DOM

   Três coisas que CSS não resolve:

   1) nós de texto órfãos ("<" ou ">") — texto não tem seletor;
   2) folhas de CSS injetadas como texto — idem, e podem ter dezenas
      de milhares de caracteres;
   3) elementos que injetam script ou ocupam espaço — esconder não
      basta, o nó precisa sair.
   ============================================================ */

(() => {
  "use strict";

  const PFM = (window.PFM = window.PFM || {});

  /* ---------- nós de texto órfãos ----------

     CASO 1 — bloco de anúncio com aspas a mais:

         <<!--script>
         window['CboxReady'] = ...
         </script -->

     O `<!--` deveria abrir um comentário, mas o `<` extra faz o
     parser descartar a tag malformada — e sobra um nó de texto
     contendo só "<", que aparece no fim da página ocupando uma
     coluna (a região costuma usar display:table no tema).

     CASO 2 — folha de bloqueio de anúncios injetada como texto.
     Alguns sites emitem o CSS de um ad-blocker (Ezoic, Outbrain,
     Adsterra,MGID…) direto no corpo do documento, sem <style>, e o
     navegador o renderiza como texto. No animesdrive esse bloco tem
     ~40.000 caracteres e começa com "#adopted-sytle-sheet", antes
     mesmo do <html>.

     Os dois filtros são cirúrgicos: só removem nós cujo conteúdo
     casa com padrões que NUNCA aparecem em texto legítimo. */
  const STRAY_TEXT = /^[<>]+$/;

  /* Reconhece texto que é na verdade uma folha de estilo.
     Exige, juntos: uma regra CSS com seletor + {declaração} E
     `display: none` ou `display:none`, que é a assinatura de um
     bloqueador de anúncios. Texto de página não tem isso. */
  const CSS_RULE = /[^{}\n]{1,200}\{[^{}]*(?:display\s*:\s*none|!important)[^{}]*\}/;
  const CSS_DENSE = /\{[^{}]*\}/g;

  const looksLikeStylesheet = (text) => {
    if (text.length < 40) return false;
    if (!CSS_RULE.test(text)) return false;
    /* quantas regras CSS tem? texto normal tem ~0 */
    const rules = text.match(CSS_DENSE);
    return rules && rules.length >= 3;
  };

  const isStray = (text) => {
    const t = (text || "").trim();
    if (!t) return false;
    if (STRAY_TEXT.test(t)) return true;
    return looksLikeStylesheet(t);
  };

  const removeStrayText = (root) => {
    const scope = root || document.body;
    if (!scope) return 0;
    const walker = document.createTreeWalker(
      scope,
      NodeFilter.SHOW_TEXT,
      null
    );
    const kill = [];
    let node;
    while ((node = walker.nextNode())) {
      if (isStray(node.nodeValue)) kill.push(node);
    }
    kill.forEach((n) => n.parentNode && n.parentNode.removeChild(n));
    return kill.length;
  };

  /* ---------- remoção por seletor ---------- */

  const removeMatches = (root, selector, protect) => {
    if (!root || !root.querySelectorAll || !selector) return 0;
    let n = 0;
    root.querySelectorAll(selector).forEach((el) => {
      /* nunca mexe dentro do player */
      if (protect) {
        for (const p of protect) {
          if (el.closest(p)) return;
        }
      }
      el.remove();
      n++;
    });
    return n;
  };

  PFM.nodes = {
    removeStrayText,
    removeMatches,
    isStray,
    STRAY_TEXT,
    looksLikeStylesheet
  };
})();