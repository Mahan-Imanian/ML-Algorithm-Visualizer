const APP = "index.html";

chrome.runtime.onInstalled.addListener((details) => {
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => undefined);
  }
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL(APP) });
  }
});

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL(APP) });
});
