# DNSK Player Only

Extensão para o **Brave** que limpa a página de vídeos do site
`donghuanosekai.com` e deixa **somente o player de vídeo** na tela.

Funciona em **qualquer vídeo** do site — não é específica de um episódio —
porque tudo é feito por seletor de elemento, e não por URL ou ID fixo.

E funciona **apenas nas páginas que têm o player**. Na home, nas listas de
donghuas, na busca e em qualquer outra página, a extensão não aplica
nenhuma alteração (ver seção 2.1).

---

## 2.1 Por que só nas páginas de vídeo

Uma versão anterior da extensão aplicava o CSS em **todas** as páginas de
`donghuanosekai.com`. Como a home não tem `#playVideo`, mas as regras de
layout (`html, body`, `.m_center`, `.rwl` → `display:block`) são globais,
o grid da página inicial ficava quebrado.

A correção é um **gate**: todas as 29 regras do `content.css` começam com
uma classe (`html.dnsk-active`, `html.dnsk-opt-wide`, …) que **só é
adicionada quando o player é encontrado na página**.

A detecção é feita pelo DOM, não pela URL:

```js
const isVideoPage = () => {
  if (document.querySelector("#playVideo")) return true;
  if (document.querySelector("#player"))     return true;
  return !!document.querySelector(".slideItem[data-video-url]");
};
```

Optar por DOM em vez de URL porque o padrão das URLs do site muda com o
tempo (`/quanzhi-fashi-5-episodio-09`, `/outro-slug-episodio-12`…). A
estrutura do player é estável; a URL não.

Cada opção do popup virou uma classe própria, e o `content.js` só as
adiciona quando a página é de vídeo:

| Classe | Significado |
|---|---|
| `dnsk-active` | página tem player (gatilho de tudo) |
| `dnsk-opt-nohdr` | remover cabeçalho |
| `dnsk-opt-notitle` | remover título/data |
| `dnsk-opt-nocomments` | remover comentários |
| `dnsk-opt-noads` | remover anúncios |
| `dnsk-opt-wide` | player em tela cheia |
| `dnsk-opt-onlyplayer` | esconder os controles |

Se desligar "Só nas páginas com player" no popup, a extensão volta a
aplicar em todas as páginas do site — útil para depurar.

---

## 1. O que a extensão remove

Comparando o HTML original (`.old/donghuanosekai-com.html`) com a sua
limpeza manual (`.old/html-limpo.html`), estes foram os blocos que
sobraram / foram apagados:

| Bloco | Seletor | Situação |
|---|---|---|
| Barra superior (logo, busca, login, hamburger) | `header .m_nav` | **removido** |
| Linha separadora do header | `header .separador` | **removido** |
| Título do episódio / data / views / social | `.article_title` | **removido** |
| Banner Patreon (`<video>` do anúncio) | `#fullno video`, `a[href*="patreon"]` | **removido** |
| Banners WhatsApp / Telegram | `a[href*="whatsapp"]`, `a[href*="telegram"]` | **removido** |
| Lista de episódios (sidebar) | `#list_eps`, `.rwl .crw` | **removido** |
| Carrossel "Donghuas Recomendados" | `.sliderRecomendado`, `.titleC` | **removido** |
| Comentários (wpDiscuz) | `#wpdcom`, `#comments`, `#respond` | **removido** |
| Rodapé e créditos | `footer.footer`, `.creditos` | **removido** |
| Nav legal inferior | `nav.legal-nav` | **removido** |
| Bolha flutuante de comentários | `.wpd-bubble-wrapper` (bolha de comentários) | **removido** |

### O que **permanece** (o player e seus controles)

```
header > ul.m_menu           (links de navegação do topo)
#fullno > #player            (o player em si)
#player  > #playVideo > iframe
.mobile_b                    (barra: modo claro, reportar, download)
.controles                   (selecionar player, anterior, próximo, download, fullscreen)
```

### Também é bloqueado

- Scripts e requisições de anúncio (AdSense, MarketGid, Rubicon, reCAPTCHA).
- O **smartlink/popunder**: a página define `dnskPlayerAd()`, que abre
  `predictivadnetwork.com` numa aba nova quando o player é carregado.
  Essa função é neutralizada.

---

## 2. Como a extensão foi construída

A extensão usa **Manifest V3** e é dividida em camadas. Cada camada
ataca um momento diferente do carregamento da página.

### `manifest.json` — o "contrato" da extensão

```json
"content_scripts": [
  { "js": ["content.js"], "css": ["content.css"], "run_at": "document_start" },
  { "js": ["blocker.js"], "run_at": "document_start", "world": "MAIN" }
]
```

Pontos importantes:

- **`run_at: "document_start"`** — o navegador injeta o CSS e o JS no
  começo do documento, **antes** da página pintar. É isso que evita o
  "flash" de conteúdo feio: você nunca chega a ver a página suja.
- **`world: "MAIN"`** (MV3) — roda o `blocker.js` no contexto JavaScript
  da própria página, e não no sandbox da extensão. Só assim é possível
  sobrescrever `window.open`, que é uma variável global do site.
- **`host_permissions`** e **`matches`** — restritos a
  `donghuanosekai.com`. A extensão não toca em mais nada.
- **`declarativeNetRequest`** — regras de bloqueio de rede declaradas em
  JSON, sem precisar pedir permissão de `<all_urls>`.

### `content.css` — a camada de "esconder"

CSS puro com `display: none !important` nos seletores da tabela acima,
mais o bloco de **layout**, que é o que faz o player crescer.

#### A parte sensível: o aspect ratio do player

O tema do site já resolve a proporção do vídeo com a técnica antiga:

```css
/* style.css do tema */
#player        { position: relative; width: 100%; padding-top: 56.6% }
#player iframe { position: absolute; top:0; left:0; width:100%; height:100% }
```

Ou seja, **o `padding-top: 56.6%` do `#player` já reserva a altura** do
player. Uma versão anterior desta extensão somava `aspect-ratio: 16/9`
por cima disso, e o resultado era o player ficando com duas caixas de
proporção empilhadas (16:9 **e** 56.6%) — o vídeo aparecia esticado, com
zoom, impossível de corrigir.

A correção é não competir com o tema: zeramos o `padding-top` do
`#player` e passamos a controlar a caixa do `#playVideo` — que o tema
**não** estiliza (é só um div wrapper):

```css
html.dnsk-opt-wide #player {
  padding-top: 0 !important;      /* o #player não reserva mais altura */
}

html.dnsk-opt-wide #playVideo {
  position: relative !important;
  width: min(100%, calc((100vh - 120px) * 16 / 9)) !important;
  max-height: calc(100vh - 120px) !important;
  aspect-ratio: 16 / 9 !important;
  margin: 0 auto !important;
  overflow: hidden !important;
}
```

Com o `padding-top` do `#player` zerado, o `aspect-ratio` no
`#playVideo` fica seguro (não há mais duas caixas de proporção
empilhadas).

No modo normal o player ocupa a largura toda e a altura pode passar da
janela — rolar até os controles do site é o comportamento desejado. No
**modo teatro** o CSS troca para `position: fixed; width:100vw;
height:100vh`, e aí não há rolagem nenhuma.

html.dnsk-opt-wide #playVideo iframe {
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  width: 100% !important;
  height: 100% !important;        /* preenche a caixa criada pelo padding */
  transform: none !important;
  zoom: 1 !important;
}
```

Repare que **não** usamos `inset: 0` nem escrevemos `width`/`height`
inline no iframe via JavaScript. O script do site ajusta o iframe, e
forçar atributos por fora brigava com o CSS. Deixamos o CSS resolver.

Os filhos diretos do `#player` que não são o player (`<meta>` de
schema.org, o `<span>` de descrição e o `<img id="thumbHis">`) são
posicionados fora do
fluxo para não somarem altura:

```css
html.dnsk-opt-wide #player > *:not(#playVideo) {
  position: absolute !important;
  width: 0 !important;
  height: 0 !important;
  overflow: hidden !important;
  visibility: hidden !important;
}
```

### O `<` órfão que ocupava uma coluna

Um `<` sozinho aparecia no fim da página, ocupando uma coluna inteira.

A causa é um bloco de anúncio do Cbox com uma aspa a mais. No fim do
`<body>`, o servidor entrega:

```html
<<!--script>
window['CboxReady'] = function (Cbox) { Cbox('button', '3-3532480-jbtrnn'); }
</script>
<script src="https://static.cbox.ws/embed/2.js" async></script>
</script -->
```

O `<!--` deveria abrir um comentário HTML, mas o `<` extra faz o parser
descartar a tag malformada. O que sobra é um **nó de texto contendo
só `<`**, que aparece no fim da página — e como a região usa
`display: table` no tema, ele vira uma **célula**, ou seja, uma coluna
inteira sozinha.

Nó de texto **não tem seletor**, então CSS não alcança. A correção é
remover o nó:

```js
const STRAY_TEXT = /^[<>]+$/;

const removeStrayText = () => {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
  const kill = [];
  let node;
  while ((node = walker.nextNode())) {
    const t = (node.nodeValue || "").trim();
    if (t && STRAY_TEXT.test(t)) kill.push(node);
  }
  kill.forEach((n) => n.parentNode && n.parentNode.removeChild(n));
};
```

O filtro é cirúrgico: só remove nós cujo conteúdo é **exclusivamente**
`<` ou `>`, nunca texto de verdade. E a origem do script também foi
bloqueada na camada de rede (`||static.cbox.ws`), já que é anúncio.

Também é removido o `.report-wrapper` (o modal de "Reportar"), que é
criado em tempo de execução e usa `display: table` — mesma estrutura
que produzia a coluna fantasma.

### `content.js` — a camada de "remover" e de configuração

Faz quatro coisas:

1. **Detecta se a página tem player** (`isVideoPage()`). É o gate que
   protege a home e as demais páginas do site.
2. **Lê as opções** de `chrome.storage.sync` e as traduz em classes
   (`dnsk-opt-*`) no elemento `<html>` — é isso que liga/desliga cada
   módulo pelo popup, sem regenerar CSS.
3. **Remove fisicamente** os nós de anúncio e de comentários (não só
   esconde). Isso é essencial para elementos que o JavaScript do site
   injeta com `style` inline — como a bolha flutuante do wpDiscuz, que
   vem com `style="display: block"`. Esconder por CSS seria frágil:
   qualquer re-render do plugin traz o elemento de volta. O
   `MutationObserver` remove de novo se ele reaparecer.
4. **Usa `MutationObserver`** para varrer o DOM continuamente.

O passo 3 é essencial: os anúncios do Google AdSense, MarketGid e
reCAPTCHA **não existem no HTML que o servidor envia**. Eles só aparecem
depois que o JavaScript da página roda. Um `content.css` sozinho não
resolveria — é o observer que limpa o que for injetado depois.

```js
const observer = new MutationObserver(() => {
  requestAnimationFrame(sweep);   // agrupa as mutações, roda 1x por frame
});
observer.observe(document.documentElement, { childList: true, subtree: true });
```

Há também uma proteção para nunca remover o player:

```js
if (el.closest("#player")) return;   // nunca toca no player
```

Detalhe importante do `applyState`: as classes `dnsk-opt-*` dependem das
**opções**, não só de `active`. Por isso a função **não** pode sair
cedo quando `active` não mudou — um `return` antecipado nesse ponto
faz os toggles do popup pararem de responder depois da primeira
aplicação.

Sobre o player: **não** escrevemos `width`/`height`
inline no iframe. O script do site já ajusta o iframe, e forçar
atributos por fora brigava com o CSS e produzia um zoom no vídeo. O
CSS resolve o dimensionamento.

### `blocker.js` — a camada de "popup"

Roda em `world: "MAIN"` e substitui `window.open` por uma versão que
inspeciona a URL antes de abrir:

```js
window.open = function (url, ...rest) {
  if (isAdUrl(url)) {
    console.warn("[DNSK] popup de anúncio bloqueado:", url);
    return null;                       // não abre nada
  }
  return nativeOpen.apply(window, [url, ...rest]);
};
```

E neutraliza a função do site:

```js
window.dnskPlayerAd = function () {
  console.warn("[DNSK] dnskPlayerAd() neutralizado.");
};
```

### `rules/ad-block.json` — bloqueio de rede

Regras `declarativeNetRequest` que impedem o download dos scripts de
anúncio. Duas delas são `allow` com **prioridade 2** para garantir que
o player (`donghuanosekai.com/player`) e o CDN do site
(`cdn.dnskcdn.link`) **nunca** sejam bloqueados — as regras de bloqueio
usam prioridade 1. A prioridade mais alta vence, então o player sempre
passa.

### `background.js` — service worker

Sincroniza as opções e liga/desliga o ruleset de anúncios conforme o
checkbox "Remover anúncios" do popup:

```js
await chrome.declarativeNetRequest.updateEnabledRulesetIds({
  enableRulesetIds:  ["ad_block"],   // quando hideAds = true
  disableRulesetIds: []
});
```

### `popup.html` / `popup.js` — o painel de controle

Interface com os 8 switches. Cada `change` salva em `chrome.storage.sync`,
e o `content.js` já está ouvindo:

```js
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  for (const [k, v] of Object.entries(changes)) options[k] = v.newValue;
  renderCss();   // regenera o CSS com os novos módulos
  sweep();
});
```

### Fluxo completo

```
navegador baixa a página
        │
        ├─► DNR bloqueia ads na camada de rede
        │
        ├─► blocker.js  (world MAIN) corta window.open / dnskPlayerAd
        │
        ├─► content.js  roda e chama isVideoPage()
        │
        ├─► ┌─ SEM player (home, listas, busca)?
        │     └─► nenhuma classe adicionada → página intacta
        │
        └─► ┌─ COM player?
              └─► adiciona dnsk-active + dnsk-opt-*
                    │
                    ├─► content.css aplica (regras já gated)
                    └─► MutationObserver limpa os ads que o JS
                        do site injeta depois do carregamento
                              │
                              ▼
                      só o player na tela
```

---

## 3. Como instalar no Brave

> O Brave é baseado no Chromium, então usa o mesmo sistema de extensões
> do Chrome. Extensões locais são **"Load unpacked"** — não precisam ir
> para a loja.

### Passo a passo

**1. Abra a página de extensões**

Digite `brave://extensions` na barra de endereço e pressione Enter.

**2. Ligue o "Modo do desenvolvedor"**

No canto **superior direito** da página, ative o toggle
**Modo do desenvolvedor** (ou *Developer mode*).

**3. Clique em "Carregar sem compactação"**

Botão **"Carregar sem compactação"** (*Load unpacked*), também no canto
superior direito.

**4. Selecione a pasta da extensão**

Navegue até a pasta:

```
C:\Users\zetyko\Documents\GitHub\html-clean\extension
```

Selecione a pasta `extension` inteira (não o `manifest.json`) e clique
em **Selecionar pasta**.

Pronto. A extensão aparece na lista e o ícone 🔴 aparece na barra.

**5. Teste**

Abra um vídeo no `donghuanosekai.com` e **recarregue a página**
(`F5`) — os content scripts só rodam no carregamento.

### Se estiver usando WSL

Como o projeto está num diretório do Windows montado no WSL, você pode
carregar a pasta direto pelo caminho Linux, mas o Brave (que roda no
Windows) precisa enxergar o caminho Windows. Use o caminho do Windows:

```
\\wsl.localhost\<distro>\home\<user>\...\extension
```

ou, mais simples, copie a pasta para o Windows. O jeito mais garantido é
usar o caminho `C:\Users\zetyko\Documents\GitHub\html-clean\extension`
direto.

### Ajustes

Clique no ícone 🔴 na barra do navegador para abrir o painel e ligar ou
desligar cada módulo. Depois de mudar uma opção, **recarregue a aba**.

---

## 3.1 Modo Teatro

Ao ativar, **literalmente só o vídeo** fica na tela: header, menu,
rodapé, sidebar, recomendados, comentários, anúncios e os próprios
controles do site (`.controles`, `.mobile_b`) somem, e o vídeo assume
`100vw x 100vh`.

**Como usar**

| Ação | Resultado |
|---|---|
| Botão `Teatro` na barra de controles do player | ativa |
| Botão `Sair` / tecla **T** / tecla **Esc** | desativa, controles voltam |

> O atalho **T** responde nos dois lugares. Isso importa porque, ao
> clicar no vídeo, o foco vai para **dentro do iframe** — e a tecla é
> disparada no documento do frame interno, onde o listener do
> `content.js` (frame principal) não a enxerga. Por isso o
> `player-bar.js` também trata `T` e `Esc`.

O estado é salvo em `chrome.storage.sync`, então o modo teatro
**persiste ao trocar de episódio** (ao clicar em "Próximo").

### Onde o botão é injetado

A barra de controles com pause / voltar / avançar **não está na página
principal**. A estrutura real é de dois níveis de iframe:

```
donghuanosekai.com/<episodio>            <- frame principal
  └─ #playVideo > iframe
       donghuanosekai.com/player?file=  <- só um wrapper
            └─ iframe
                 player.donghuanosekai.com/player-nativov2.php?v=<m3u8>
                      └─ <video>       <- AQUI fica a barra de controles
```

Por isso existe o `player-bar.js`, registrado com `all_frames: true`
para rodar em todos os níveis. Ele só age no frame que **realmente
contém** o player:

```js
const isPlayerFrame = () => {
  if (document.querySelector("video")) return true;
  return !!document.querySelector(".video-js, .jwplayer, .plyr, .art-video, .xgplayer");
};
```

Repare que a URL **não** é usada como sinal: o frame intermediário
`/player?file=...` também tem "player" no nome, mas é só um wrapper —
injetar ali criaria um botão duplicado.

Dentro do frame, o script procura a barra de controles por seletor
(conhecidos de Video.js, JWPlayer, Plyr, ArtPlayer, Shaka, xgplayer,
VideoPlayer) e injeta o botão **no fluxo da barra**, junto com o pause e
o volume:

```js
const CONTROL_BARS = [".vjs-control-bar", ".jw-controls", ".plyr__controls",
  ".art-controls", ".vp-controls", ".shaka-controls-container",
  ".xgplayer-controls", ".video-controls", ".player-controls",
  "#player-controls", ".controls"];
```

Se nenhuma barra for reconhecida — o caso de um `<video controls>`
**nativo**, cuja barra é UI do navegador e não é DOM, então não dá para
injetar dentro — o botão é **ancorado no próprio vídeo** e não na janela:

```js
const anchorToVideo = (host) => {
  const video = document.querySelector("video");
  const box = video.parentElement;
  if (getComputedStyle(box).position === "static") box.style.position = "relative";
  box.appendChild(host);
  host.style.cssText = "position:absolute;left:8px;bottom:56px;z-index:2147483000;";
};
```

A distância é a constante `BTN_BOTTOM` no `player-bar.js` — mude esse
número para subir ou descer o botão.

Isso importa: com `position: fixed` o botão ficava **grudado na tela**,
rolando por cima de outros controles quando a página rolava. Com
`absolute` dentro do container do vídeo, ele acompanha o player.

### Arbitragem: apenas um botão (via postMessage)

O botão é montado pelo `player-bar.js`, que roda em `all_frames`. Se
vários frames tiverem `<video>`, cada um montaria o seu e apareceriam
botões duplicados dentro do player.

A arbitragem usa **`postMessage`**, com o frame principal (que roda o
`content.js`) como árbitro:

```js
// content.js — só no frame principal
if (isTopFrame()) {
  window.addEventListener("message", (ev) => {
    const d = ev.data;
    if (!d || d.__dnsk !== "theater") return;
    if (d.kind === "probe") {
      const expired = FRAME.grantedTo && now - FRAME.grantedAt > 1500 && !FRAME.mountedAt;
      if (!FRAME.grantedTo || expired) { /* grant */ }
      else { /* deny */ }
    } else if (d.kind === "mounted") { FRAME.mountedAt = Date.now(); }
  });
}
```

```js
// player-bar.js — em cada frame candidato
window.top.postMessage({ __dnsk: "theater", kind: "probe", id: FRAME_ID }, "*");
// ... só monta se a resposta for "grant"
```

Sem resposta do árbitro, o frame tenta duas vezes (500ms e 900ms — o
árbitro responde em milissegundos, então timeout longo só atrasaria o
botão) e só então monta, **se ainda não existir botão em nenhum frame**.
Montar às cegas era o que gerava duplicata; esperar demais, não mostrava
o botão. Esse equilíbrio é o que garante um único botão nos dois cenários.

#### Botão destruído pelo player

Players que reconstroem o próprio DOM (trocar qualidade, redimensionar)
podem arrancar o host do botão. Como `ui` guardaria a referência de um nó
órfão, `mount()` sairia pelo `if (ui) return` e o botão nunca voltaria.
Por isso há uma checagem e um watchdog:

```js
if (ui && !ui.isConnected) ui = null;   // nó foi arrancado
...
setInterval(() => {
  if (ui && !ui.isConnected) { ui = null; notifyGone(); mountIfWinner(); }
}, 2000);
```

O `notifyGone()` avisa o árbitro, que libera a concessão para outro
frame assumir.

Por que `postMessage` e não storage: o storage **não atravessa
origem**, e aqui ele falhava — se `chrome.storage.session` não
estiver disponível em content script, o `catch` devolvia "pode montar"
e **todos** os frames montavam. Já `buttonExistsNearby()` (que inspeciona
os frames irmãos) também não salva, porque o player é
`player.donghuanosekai.com` e o wrapper é `donghuanosekai.com` —
origens diferentes, DOM inacessível. `postMessage` atravessa origem.

Verificação do árbitro (4 frames disputando):

```
A: GRANT   B: deny   C: deny   D: deny
grants: 1  OK - so um botao
5o frame depois: deny OK
concessao morreu sem montar -> re-concede: GRANT (correto)
mensagens irrelevantes: ignoradas sem erro
```

#### O botão de fallback precisa ser `fixed`

Quando não achamos a barra de controles (controles nativos do navegador
não são DOM), o botão vai para o canto inferior do vídeo. Ele **tem de
ser `position: fixed`**: dentro de um iframe, `fixed` é relativo ao
viewport do frame e sempre aparece na tela. Com `absolute`, o `bottom`
era medido a partir do `<body>` inteiro — se o frame for mais alto que a
janela, o botão caía fora da área visível e só aparecia ao rolar a
página.

### Arbitragem por storage (histórico, substituída)

Mais de um frame pode conter `<video>` — o site embute o player em dois
níveis e oferece vários players. Sem coordenação, cada frame montaria o
seu e apareceriam botões duplicados **dentro do player**.

Como frames de origem diferente não converse via DOM, o storage da
extensão vira o canal de coordenação. Cada frame candidato faz uma
**requisição**, espera, relê o **lauro** e só monta se ganhar:

```js
const beats =
  stale ||                                   // lauro expirou
  mine.depth > cur.depth ||                  // frame mais interno vence
  (mine.depth === cur.depth && mine.hasBar && !cur.hasBar) ||
  (mine.depth === cur.depth && mine.hasBar === cur.hasBar &&
   mine.ts < cur.ts);                        // desempate: mais antigo
```

E, para eliminar **corrida** (frames que carregam no mesmo tick leem
"sem lauro" juntos), quem escreve relê depois de `CONFIRM_DELAY` e só
monta se o lauro ainda for o dele:

```js
await area.set({ [CLAIM_KEY]: mine });
await new Promise((r) => setTimeout(r, CONFIRM_DELAY));
const after = (await area.get(CLAIM_KEY))[CLAIM_KEY];
return !!after && after.id === mine.id;
```

Critério final: **frame mais profundo** (é onde mora o player de
verdade) > quem achou a **barra de controles** > mais antigo.

#### O botão some sozinho

Além da arbitragem, há uma verificação **antes** de arbitrar: o frame
procura um botão já injetado em qualquer frame acessível
(`buttonExistsNearby()`), subindo a cadeia de iframes e olhando os
irmãos. Se encontrar, não monta.

Isso é o que torna o vencedor **permanente**, sem depender do TTL do
storage. Foi necessário porque o TTL de 4s expirava enquanto o player
ainda inicializava — o `MutationObserver` chamava `mountIfWinner()`
várias vezes nesse período, e passado o TTL um segundo frame ganhava a
disputa e montava um **segundo botão**. É exatamente o sintoma de "dois
botões dentro do player".

O TTL foi estendido para 10 minutos como segunda camada de proteção.

### Auto-hide do botão

O botão desaparece sozinho após **3 segundos** de inatividade e volta
quando o mouse se mexe no frame ou entra no botão:

```js
const show = () => {
  host.style.opacity = "1";
  scheduleHide();
};
const hide = () => { host.style.opacity = "0"; };
const scheduleHide = () => {
  clearTimeout(host.__hideTimer);
  host.__hideTimer = setTimeout(hide, HIDE_AFTER_MS);  // 3000
};

host.addEventListener("mouseenter", show);
host.addEventListener("mousemove", show);
document.addEventListener("mousemove", show, { passive: true });
document.addEventListener("touchstart", show, { passive: true });
```

O botão fica **invisível, não removido** — continua no DOM com
`opacity: 0`, então reaparece instantaneamente ao passar o mouse, sem
latência de recriação. O `paint()` (que muda o ícone e o rótulo) é
independente da opacidade, então o estado continua correto enquanto
está escondido.

### Comunicação entre frames

Não usamos `postMessage`. O botão dentro do iframe grava em
`chrome.storage.sync`, e o `content.js` do frame principal já escuta
`storage.onChanged` e aplica o `dnsk-theater`:

```js
// player-bar.js (dentro do iframe)
btn.addEventListener("click", () => {
  chrome.storage.sync.set({ theaterMode: !current });
});

// content.js (frame principal)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  for (const [k, v] of Object.entries(changes)) options[k] = v.newValue;
  applyState();
});
```

Como `*://*.donghuanosekai.com/*` já estava nas permissões (o subdomínio
`player.donghuanosekai.com` é coberto), **nenhuma permissão nova** foi
adicionada.

### Por que Shadow DOM

O tema do site tem um reset muito agressivo em `style.css`:

```css
button { background: 0 0; border-radius: 0; padding: 0; outline: 0 }
```

Isso apagaria um botão injetado no DOM do player. Por isso o botão é
criado dentro de um **Shadow DOM**
(`host.attachShadow({ mode: "open" })`), que o isola desses resets.
O botão fica acessível por
`document.getElementById("dnsk-theater-inplayer").shadowRoot`, mas é
invisível para o CSS da página e do player.

---

## 4. Estrutura dos arquivos

```
extension/
├── manifest.json          # Manifest V3 — permissões e scripts
├── content.css            # esconde o layout + deixa o player 16:9
├── content.js             # opções, remoção de nós, MutationObserver,
│                          # atalhos de teclado do modo teatro
├── player-bar.js          # botão de modo teatro dentro da barra de
│                          # controles do player (roda em all_frames)
├── blocker.js             # world MAIN — corta window.open e popups
├── background.js          # service worker — liga/desliga regras de ads
├── popup.html             # painel de opções
├── popup.js               # salva as opções em chrome.storage.sync
├── rules/
│   └── ad-block.json      # regras declarativas de bloqueio de rede
├── .gitignore             # ignora _metadata/ gerado pelo Brave
└── icons/
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```

---

## 5. Adicionando outro site

Se você quiser estender a limpeza para mais algum site, edite
`manifest.json` e adicione o domínio em **duas** listas:

```json
"host_permissions": ["*://donghuanosekai.com/*", "*://outrosite.com/*"],
"content_scripts": [
  { "matches": ["*://donghuanosekai.com/*", "*://outrosite.com/*"], ... }
]
```

Depois adicione os seletores daquele site em `content.css` (para esconder)
e na lista `REMOVE_NODES` em `content.js` (para remover). Inspecione a
página com `F12` para descobrir os seletores.

---

## 6. Solução de problemas

**A página não ficou limpa.**
Recarregue com `Ctrl+Shift+R` (hard reload). Se continuar, abra o
`brave://extensions` e clique no botão de recarregar da extensão.

**A limpeza não aplica nesta página.**
A extensão só age onde existe o player (`#playVideo` / `#player` /
`.slideItem[data-video-url]`). Se a página de vídeo não for limpa,
abra o `F12` e veja se o `#playVideo` existe. Se o site mudou o ID,
é preciso atualizar o seletor em `content.js` e em `content.css`.

**Não achei o botão no popup.**
O rodapé mostra a versão (`v1.4.0`). Se aparecer `v?`, o arquivo
`manifest.json` não foi lido — clique em ⟳ na página de extensões.

**A bolha de comentários não some.**
Ela é injetada pelo wpDiscuz com `style` inline depois do carregamento.
A extensão a remove do DOM (não só esconde) e o `MutationObserver`
limpa de novo caso o plugin a recrie. Se voltar a aparecer, verifique
que "Remover comentários" está ligado no popup.

**O botão de modo teatro não aparece na barra do player.**
Ele só é injetado no frame que tem `<video>`. Se o player usa
controles **nativos** do navegador, o botão aparece no canto inferior
esquerdo sobre o vídeo (fallback), porque a barra nativa não é DOM e
não pode ser estendida.

Para conferir em qual posição ele caiu, abra o DevTools do **player**
(click direito no vídeo → "Inspecionar") e procure por
`dnsk-theater-inplayer`. Se ele estiver no fallback, me mande o HTML do
player (ou o nome da lib de player, visível no código) para eu ajustar
o seletor da barra.

**Apareceram dois botões de Teatro.**
Confirme a versão no rodapé do popup: deve ler **v1.4.0** ou superior.
Até a v1.3.x existia um segundo botão flutuante no frame principal
(`position: fixed` — por isso ele "acompanhava" a divisão com o
DevTools). Ele foi **removido**: hoje só existe o botão dentro do
player. Se ainda vê dois, é uma versão antiga carregada — clique em
⟳ na página de extensões e confira a versão no popup.

**A tecla T não funciona.**
O atalho é ignorado se o foco estiver num campo de texto
(`INPUT`/`TEXTAREA`/`SELECT`) ou se houver `Ctrl`/`Alt`/`Meta`
pressionado, para não interferir na navegação.

**Apareceu a pasta `_metadata` na minha extensão.**
O Brave cria essa pasta ao instalar (cache das regras de rede). É
normal e não afeta nada — está no `.gitignore` e não deve entrar no zip.

**O vídeo não carrega / fica em branco.**
O `iframe` do player não apareceu. Abra o `F12` e veja se o
`#playVideo > iframe` tem `src`. Se não tiver, o próprio script do site
não rodou — provavelmente o popunder foi bloqueado cedo demais. Desligue
"Bloquear popups" no popup e recarregue.

**Someu a lista de episódios e quero voltar.**
Ela está no popup: **"Remover comentários"** controla apenas comentários.
A lista de episódios não tem toggle próprio porque o objetivo da
extensão é deixar só o player. Para vê-la de volta, desative a extensão
pelo ícone do `brave://extensions`.

**Apareceu `chrome.declarativeNetRequest` nas permissões.**
É o pedido de permissão necessário para bloquear os scripts de anúncio.

---

## 7. Nota técnica

Esta extensão apenas esconde e remove elementos da página que você já
está visualizando — ela não baixa, descriptografa nem contorna
nenhuma proteção do site nem do provedor de vídeo. Ela funciona
exatamente como o DevTools faria, só que automático e para todas as
páginas do site. O uso é de responsabilidade de quem instala.