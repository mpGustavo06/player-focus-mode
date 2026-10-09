/* ============================================================
   core/arbiter.js — coordena o botão de teatro entre frames

   A barra de controles do player vive dentro de iframes, e o site
   embute o player em vários níveis. Sem coordenação, cada frame
   montaria o seu botão e apareceriam duplicados.

   O frame principal (que roda o content.js) é o árbitro: cada frame
   candidato pede a vaga e só monta se receber "grant".

   Por que postMessage e não chrome.storage: o player costuma estar
   em outro subdomínio (ex.: player.donghuanosekai.com enquanto a
   página é donghuanosekai.com), então a extensão não enxerga o DOM
   de um a partir do outro. postMessage atravessa origem; storage
   compartilhado já era usado como arbitragem e falhava.
   ============================================================ */

(() => {
  "use strict";

  const PFM = (window.PFM = window.PFM || {});

  /* Este arquivo entra em DUAS entradas do manifest:
       content_scripts[0] — document_start, so no frame principal
       content_scripts[2] — document_idle, all_frames (inclui o topo)

     No frame principal ele acaba executando duas vezes. A segunda
     vez criaria um `state` novo e sobrescreveria o PFM.arbiter que o
     content.js ja instalou — a disputa recomeçaria do zero e o
     dono anterior perderia a vaga. */
  if (PFM.arbiter) return;

  const CHANNEL = "pfm-theater";

  const state = {
    grantedTo: null,
    grantedAt: 0,
    mountedAt: 0,
    lastSeen: 0,
    pending: null,
    timer: null,
    stage: null
  };

  /* Sem checagem de vivacidade, a vaga fica presa com um frame morto:
     o site recria o iframe do player, o novo frame pede a vaga e
     recebe "deny" porque o dono antigo já foi destruído — e ninguém
     manda "gone", porque o watchdog só roda enquanto o frame vive.
     Resultado: a extensão para de mostrar o botão.

     O dono da vaga envia "ping" periodicamente; se ficar mais que
     PING_TIMEOUT sem falar nada, consideramos a concessão morta e
     abrimos a disputa de novo. */
  const PING_TIMEOUT = 7000;

  const isTopFrame = () => window.top === window.self;

  /* Elege o melhor candidato: quem achou a barra de controles
     primeiro; em empate, o frame mais interno (é onde mora o
     player de verdade). */
  const electWinner = () => {
    const list = state.pending || [];
    state.pending = null;
    state.timer = null;
    if (!list.length) return;

    const rank = (c) => (c.hasBar ? 1000000 : 0) + c.depth * 1000;
    const winner = list.reduce((b, c) => (rank(c) > rank(b) ? c : b), list[0]);

    state.grantedTo = winner.id;
    state.grantedAt = Date.now();
    state.mountedAt = 0;
    state.lastSeen = Date.now();

    for (const c of list) {
      if (!c.source) continue;
      c.source.postMessage(
        {
          __pfm: CHANNEL,
          kind: c.id === winner.id ? "grant" : "deny",
          id: c.id
        },
        "*"
      );
    }
  };

  /* Instala o árbitro. Só faz sentido no frame principal. */
  /* o content.js publica aqui qual é a stage do site atual */
  const setStage = (sel) => {
    state.stage = sel || null;
  };

  const install = () => {
    if (!isTopFrame()) return false;

    window.addEventListener("message", (ev) => {
      const d = ev.data;
      if (!d || d.__pfm !== CHANNEL) return;

      if (d.kind === "probe") {
        /* O frame principal nao pode arbitrar a si mesmo.

           probe() usa window.top.postMessage; no topo window.top ===
           window, entao o probe volta para o proprio arbitro. Sem
           este filtro, o topo concede a vaga para si mesmo ANTES de
           o frame que realmente contem o <video> perguntar — e o
           player, chegando depois, recebe "deny". Era o que fazia o
           botao nunca aparecer sobre o video. */
        if (ev.source === window) return;

        const now = Date.now();
        const granted = state.grantedTo;
        /* concede se ninguém tem, se quem tinha não chegou a montar,
           ou se quem tem a vaga sumiu (frame destruído) */
        const expired =
          granted &&
          ((now - state.grantedAt > 1500 && !state.mountedAt) ||
            now - state.lastSeen > PING_TIMEOUT);

        if (granted && !expired) {
          if (ev.source) {
            ev.source.postMessage(
              { __pfm: CHANNEL, kind: "deny", id: d.id },
              "*"
            );
          }
          return;
        }

        /* Vários frames podem pedir. Não damos a vaga ao primeiro que
           chega: juntamos por ~300ms e elegemos o melhor. */
        if (!state.pending) {
          state.pending = [];
          state.timer = setTimeout(electWinner, 300);
        }
        state.pending.push({
          id: d.id,
          source: ev.source,
          depth: d.depth || 0,
          hasBar: !!d.hasBar
        });
      } else if (d.kind === "mounted" || d.kind === "ping") {
        if (d.id === state.grantedTo) {
          state.mountedAt = Date.now();
          state.lastSeen = Date.now();
        }
      } else if (d.kind === "where") {
        /* O frame do player perguntou onde está a stage. Só o frame
           principal sabe (é ele que carregou o perfil), e ele
           responde — postMessage atravessa origem, ao contrário de
           document.documentElement.dataset. */
        if (d.source && state.stage) {
          d.source.postMessage(
            { __pfm: CHANNEL, kind: "stage", sel: state.stage },
            "*"
          );
        }
      } else if (d.kind === "gone") {
        /* o frame que tinha o botão perdeu o nó (o player se
           re-renderizou): libera a vaga */
        if (d.id === state.grantedTo) {
          state.grantedTo = null;
          state.mountedAt = 0;
          state.grantedAt = 0;
          state.lastSeen = 0;
        }
      }
    });

    return true;
  };

  /* ---------- lado do frame do player (usado por player-bar.js) ---------- */

  const probe = (id, depth, hasBar) =>
    new Promise((resolve) => {
      let settled = false;
      let timer = null;

      const finish = (value) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        window.removeEventListener("message", onMsg);
        resolve(value);
      };

      const onMsg = (ev) => {
        const d = ev.data;
        if (!d || d.__pfm !== CHANNEL || d.id !== id) return;
        if (d.kind === "grant") finish(true);
        else if (d.kind === "deny") finish(false);
      };

      /* o árbitro responde em milissegundos (é postMessage dentro da
         mesma aba), então o primeiro timeout é curto */
      timer = setTimeout(() => finish(null), 500);
      window.addEventListener("message", onMsg);

      try {
        window.top.postMessage(
          { __pfm: CHANNEL, kind: "probe", id, depth, hasBar },
          "*"
        );
      } catch (e) {
        finish(null);
      }
    });

  /* o frame do player pede a stage ao frame principal */
  const askStage = () =>
    new Promise((resolve) => {
      let done = false;
      const finish = (v) => {
        if (done) return;
        done = true;
        clearTimeout(t);
        window.removeEventListener("message", onMsg);
        resolve(v || null);
      };
      const onMsg = (ev) => {
        const d = ev.data;
        if (!d || d.__pfm !== CHANNEL || d.kind !== "stage") return;
        finish(d.sel);
      };
      const t = setTimeout(() => finish(null), 400);
      window.addEventListener("message", onMsg);
      try {
        window.top.postMessage({ __pfm: CHANNEL, kind: "where" }, "*");
      } catch (e) {
        finish(null);
      }
    });

  const notify = (id, kind) => {
    try {
      window.top.postMessage({ __pfm: CHANNEL, kind, id }, "*");
    } catch (e) {
      /* frame principal inacessível */
    }
  };

  PFM.arbiter = { install, probe, notify, askStage, setStage, CHANNEL, state, PING_TIMEOUT };
})();