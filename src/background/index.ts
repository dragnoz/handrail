// The background: the toolbar button opens the drawer; every few minutes it reads the assistants'
// lists and puts a count on the button. It never opens the drawer, never sends anything.
import browser from 'webextension-polyfill';
import { refreshAll, refreshAssistant, updateBadge } from '../lib/assistant/refresh';

const ALARM = 'handrail-refresh';
const EVERY_MINUTES = 5;

// Chrome: the side panel opens on the button. Firefox: the button toggles the sidebar.
const sidePanel = (globalThis as { chrome?: { sidePanel?: typeof chrome.sidePanel } }).chrome?.sidePanel;
const firefox = (globalThis as { browser?: { sidebarAction?: { toggle(): Promise<void> } } }).browser;
if (sidePanel) {
  const openOnClick = () => {
    sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  };
  openOnClick();
  browser.runtime.onInstalled.addListener(openOnClick);
} else if (firefox?.sidebarAction) {
  const sidebar = firefox.sidebarAction;
  browser.action.onClicked.addListener(() => {
    void sidebar.toggle();
  });
}

void browser.action.setBadgeBackgroundColor({ color: '#2b5fb3' }).catch(() => {});

function schedule(): void {
  void browser.alarms.create(ALARM, { periodInMinutes: EVERY_MINUTES });
}
schedule();
browser.runtime.onInstalled.addListener(schedule);
browser.runtime.onStartup.addListener(schedule);

browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) void refreshAll().then(updateBadge);
});

// The drawer asks for a read when it opens and when the person presses "Check now".
browser.runtime.onMessage.addListener((msg: unknown) => {
  const m = msg as { type?: string; id?: string } | null;
  if (m?.type !== 'refresh') return undefined;
  return (m.id ? refreshAssistant(m.id) : refreshAll()).then(updateBadge).then(() => ({ ok: true }));
});

// Marking things as seen, or turning the count off, changes the number at once.
browser.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && (changes.assistants || changes.settings)) void updateBadge();
});

void updateBadge();
