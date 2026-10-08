# Player Focus Mode

Extensão para navegadores Chromium que limpa a página de vídeo do
**donghuanosekai.com** e deixa **somente o player** na tela.

Sem cabeçalho, sem sidebar, sem comentários, sem anúncios e sem
recomendações — só o vídeo e os controles que você quiser.

**Compatível com:** Brave, Chrome, Edge, Opera e Vivaldi.
**Não funciona no Firefox** (o manifest usa APIs exclusive do Chromium —
veja [Por que não no Firefox](#por-que-não-no-firefox)).

---

## Instalação

A extensão é carregada localmente, a partir da pasta `extension/`.
Não há build, dependências nem `npm install` — os arquivos são usados
como estão.

### Brave

1. Abra `brave://extensions` na barra de endereços
2. Ative **Modo do desenvolvedor** (canto superior direito)
3. Clique em **Carregar sem compactação**
4. Selecione a pasta `extension` (inteira, não o `manifest.json`)

### Chrome

1. Abra `chrome://extensions`
2. Ative **Modo do desenvolvedor** (canto superior direito)
3. Clique em **Carregar sem compactação**
4. Selecione a pasta `extension`

### Edge

No Edge o modo desenvolvedor fica na **barra lateral esquerda**, não no
canto superior:

1. Abra `edge://extensions`
2. Ative **Modo do desenvolvedor**, na barra lateral esquerda
3. Clique em **Carregar descomprimido**
4. Selecione a pasta `extension`

### Opera e Vivaldi

1. Abra `opera://extensions` (ou `vivaldi://extensions`)
2. Ative **Modo do desenvolvedor**
3. Clique em **Carregar sem compactação**
4. Selecione a pasta `extension`

### Depois de instalar

Abra um vídeo no site e **recarregue a página** (`Ctrl+Shift+R`). As
extensões de conteúdo só rodam no carregamento — páginas já abertas
continuam sem efeito até você recarregar.

---

## Como usar

### Modo teatro

O botão **Teatro** fica no canto superior direito do vídeo. Ao ativá-lo,
tudo some e sobra só o vídeo ocupando a tela inteira.

| Ação | Resultado |
|---|---|
| Clicar em **Teatro** | entra no modo teatro |
| Clicar em **Sair** | volta, com os controles |
| Tecla **T** | alterna liga/desliga |
| Tecla **Esc** | sai do modo teatro |

O botão **some sozinho depois de 1,5 segundo** sem mexer o mouse e volta
assim que o cursor se mexe. Na primeira aparição ele fica 3 segundos
visível, para ser percebido antes de sumir. Ele acompanha o vídeo: se você rolar a
página, ele desce junto.

O estado é salvo, então o modo teatro **continua ligado ao trocar de
episódio**. Para desliga-lo de vez, use o botão, a tecla `Esc` ou o
checkbox no painel.

### Opções

Clique no ícone 🔴 da extensão na barra do navegador:

| Opção | O que faz |
|---|---|
| Ativar limpeza | Liga/desliga a extensão inteira |
| Só nas páginas com player | Garante que a home e as listas não sejam alteradas |
| Remover cabeçalho e busca | Tira a barra de topo |
| Remover título / data / views | Tira o bloco com o nome do episódio |
| Remover comentários | Tira a seção de comentários e a bolha flutuante |
| Só o player (esconder controles) | Esconde também a barra de controles do site |
| Modo teatro | Liga o modo teatro |
| Remover anúncios | Esconde e bloqueia scripts de anúncio |
| Bloquear popups / smartlink | Impede a aba de anúncio que abre ao carregar o player |
| Player em tela cheia (16:9) | Player ocupa a largura toda, mantendo a proporção |

Depois de mudar qualquer opção, **recarregue a aba do vídeo**.

---

## O que é removido

Cabeçalho e busca · título do episódio, data e visualizações · lista de
episódios · "Donghuas Recomendados" · comentários · rodapé e créditos ·
anúncios · popups e smartlink · botão de expandir do site · modal de
"Reportar" · o caractere `<` órfão que o site deixa no fim da página

## O que permanece

O player · o menu de troca de player · anterior / próximo episódio · link
para a lista completa · botão de download · alternador de modo claro

---

## Como está organizado

```
extension/
├── core/               # compartilhado por todos os sites
│   ├── options.js      # preferências (chrome.storage.sync)
│   ├── sites.js        # registro de perfis
│   ├── style.js        # gera o CSS a partir do perfil
│   ├── nodes.js        # limpeza do DOM
│   └── arbiter.js      # coordena o botão entre iframes
├── sites/              # um perfil por site
│   ├── index.js
│   └── donghuanosekai.js
├── content.js          # orquestrador
├── player-bar.js       # botão de teatro dentro do player
├── background.js
├── popup.html / popup.js
└── rules/ad-block.json
```

Nenhum arquivo do `core/` conhece a estrutura de um site. Isso está
tudo no perfil correspondente.

### Adicionar um site novo

1. Copie `sites/donghuanosekai.js` para `sites/meusite.js` e ajuste:

```js
PFM.registerSite({
  id: "meusite",
  hosts: ["meusite.com"],

  // obrigatório: como reconhecer uma página de vídeo
  isPlayerPage() {
    return !!document.querySelector("#player-wrapper");
  },

  // obrigatório: onde fica o player
  player: { container: "#player", stage: "#player-wrapper" },

  layout: { column: ".container", row: ".row", cell: ".content" },
  controls: [".controls"],

  hide: {
    header: [".site-header"],
    title: [".video-title"],
    sidebar: [".sidebar"],
    comments: [".comments"],
    banners: [".banner"],
    always: [".ad-placeholder"]
  },

  remove: [],
  css: ""
});
```

2. Acrescente `"sites/meusite.js"` na lista `js` do content script em
   `manifest.json`, **antes** de `content.js`
3. Acrescente o domínio em `matches` e em `host_permissions`

---

## Problemas comuns

**A página não mudou nada.**
Recarregue com `Ctrl+Shift+R`. Se persistir, abra a página de extensões
e clique no botão de recarregar (⟳) da extensão.

**O vídeo não carrega ou fica em branco.**
Desligue **Bloquear popups** no painel, recarregue e teste de novo.

**O botão de Teatro não apareceu.**
Ele só é injetado em páginas que têm player de verdade. Confirme que a
extensão está marcada como ativa no painel.

**A extensão sumiu do navegador depois de reiniciar.**
Extensões carregadas manualmente são desativadas ao fechar o navegador
em alguns casos. basta carregar de novo seguindo os passos acima.

---

## Por que não no Firefox

O manifest usa três recursos exclusivos do Chromium:

- `background.service_worker` (service worker de MV3)
- `world: "MAIN"` em content script
- `declarativeNetRequest`

O Firefox ainda não implementa os três. Suportar exigiria uma segunda
variante do manifest, com scripts de background em vez de service
worker — por isso a extensão é Chromium-only.

---

## Privacidade

A extensão não coleta, envia nem armazena nenhum dado. Tudo roda local
na sua máquina. As preferências do painel ficam em `chrome.storage.sync`,
ou seja, na sua própria conta de navegador — e só se você usar esse
armazenamento.

A extensão não baixa nem descriptografa vídeo: ela apenas esconde e
remove elementos da página que você já está visualizando, exatamente
como o DevTools faria.

## Aviso

Projeto sem vínculo com donghuanosekai.com. O uso é de responsabilidade
de quem instala.