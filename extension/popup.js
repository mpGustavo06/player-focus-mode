const DEFAULTS = {
  enabled: true,
  onlyOnPlayerPages: true,
  hideHeader: true,
  hideTitleBlock: true,
  hidePlayerControls: false,
  hideComments: true,
  hideAds: true,
  blockPopups: true,
  widePlayer: true,
  theaterMode: false
};

const boxes = Array.from(document.querySelectorAll("input[type=checkbox][data-key]"));

/* mostra a versao do manifest para dar para conferir se a extensao
   foi mesmo recarregada depois de uma edicao */
fetch(chrome.runtime.getURL("manifest.json"))
  .then((r) => r.json())
  .then((m) => {
    const el = document.getElementById("ver");
    if (el) el.textContent = "v" + m.version;
  })
  .catch(() => {});

chrome.storage.sync.get(Object.keys(DEFAULTS)).then((stored) => {
  const options = { ...DEFAULTS, ...stored };
  boxes.forEach((b) => {
    b.checked = !!options[b.dataset.key];
  });
});

boxes.forEach((box) => {
  box.addEventListener("change", () => {
    chrome.storage.sync.set({ [box.dataset.key]: box.checked });
  });
});