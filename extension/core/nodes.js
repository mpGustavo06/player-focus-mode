/* ============================================================
   core/nodes.js — limpeza do DOM

   Duas coisas que CSS não resolve:

   1) nós de texto órfãos ("<" / ">") — texto não tem seletor;
   2) elementos que injetam script ou ocupam espaço — esconder não
      basta, o nó precisa sair.
   ============================================================ */

(() => {
  "use strict";

  const PFM = (window.PFM = window.PFM || {});

  /* ---------- nós de texto órfãos "<" / ">" ----------

     Alguns sites entregam bloco de anúncio com aspas a mais:

         <<!--script>
         window['CboxReady'] = ...
         </script -->

     O `<!--` deveria abrir um comentário, mas o `<` extra faz o
     parser descartar a tag malformada — e sobra um nó de texto
     contendo só "<", que aparece no fim da página ocupando uma
     coluna (a região costuma usar display:table no tema).

     O filtro é cirúrgico: só remove nós cujo conteúdo é
     EXCLUSIVAMENTE "<" ou ">", nunca texto de verdade. */
  const STRAY_TEXT = /^[<>]+$/;

  const removeStrayText = () => {
    if (!document.body) return 0;
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null
    );
    const kill = [];
    let node;
    while ((node = walker.nextNode())) {
      const t = (node.nodeValue || "").trim();
      if (t && STRAY_TEXT.test(t)) kill.push(node);
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

  PFM.nodes = { removeStrayText, removeMatches, STRAY_TEXT };
})();