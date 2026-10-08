const DEFAULTS = {
  enabled: true,
  hideHeader: true,
  hideTitleBlock: true,
  hidePlayerControls: false,
  hideComments: true,
  hideAds: true,
  blockPopups: true,
  widePlayer: true,
  theaterMode: false
};

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.sync.get(Object.keys(DEFAULTS));
  const merged = { ...DEFAULTS, ...current };
  await chrome.storage.sync.set(merged);
  await refreshRules(merged);
});

chrome.runtime.onStartup.addListener(async () => {
  const current = await chrome.storage.sync.get(Object.keys(DEFAULTS));
  const merged = { ...DEFAULTS, ...current };
  await chrome.storage.sync.set(merged);
  await refreshRules(merged);
});

async function refreshRules(options) {
  if (!chrome.declarativeNetRequest) return;
  const enabled = options.enabled && options.hideAds;
  try {
    await chrome.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds: enabled ? ["ad_block"] : [],
      disableRulesetIds: enabled ? [] : ["ad_block"]
    });
  } catch (e) {
    console.warn("[PFM] falha ao alternar ruleset", e);
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  const options = { ...DEFAULTS };
  for (const [k, v] of Object.entries(changes)) options[k] = v.newValue;
  refreshRules(options);
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "getOptions") {
    chrome.storage.sync.get(Object.keys(DEFAULTS)).then((o) => {
      sendResponse({ ...DEFAULTS, ...o });
    });
    return true;
  }
  if (msg && msg.type === "openOptions") {
    chrome.runtime.openOptionsPage ? chrome.runtime.openOptionsPage() : null;
    return;
  }
  return false;
});