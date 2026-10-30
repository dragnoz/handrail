// The background script. It only makes the toolbar button open the drawer.
// Chrome: the side panel opens on the button by itself. Firefox: the button toggles the sidebar.
// No imports on purpose: Firefox loads this as a classic script. 0.2 adds feed refresh.
// Nothing here watches pages or sends anything anywhere.

interface FirefoxGlobals {
  sidebarAction?: { toggle(): Promise<void> };
  action?: { onClicked: { addListener(cb: () => void): void } };
}

const sidePanel = (globalThis as { chrome?: { sidePanel?: typeof chrome.sidePanel } }).chrome?.sidePanel;
const firefox = (globalThis as { browser?: FirefoxGlobals }).browser;

if (sidePanel) {
  const openOnClick = () => {
    sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  };
  openOnClick();
  chrome.runtime.onInstalled.addListener(openOnClick);
} else if (firefox?.sidebarAction && firefox.action) {
  const sidebar = firefox.sidebarAction;
  firefox.action.onClicked.addListener(() => {
    void sidebar.toggle();
  });
}
