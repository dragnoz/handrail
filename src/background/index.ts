// The service worker. In 0.1 it only makes the toolbar button open the drawer.
// 0.2 adds feed refresh. Nothing here watches pages or sends anything anywhere.

function openOnClick(): void {
  // Firefox (0.2) has no sidePanel API; its sidebar opens from its own button.
  chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
}

openOnClick();
chrome.runtime.onInstalled.addListener(openOnClick);
