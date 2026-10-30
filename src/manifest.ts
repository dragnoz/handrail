// The manifest, generated at build time. One codebase, one manifest per browser.
// Permissions are the minimum for what 0.1 does; see README "Permissions".
export function manifest(target: 'chrome' | 'firefox', version: string): Record<string, unknown> {
  const base: Record<string, unknown> = {
    manifest_version: 3,
    name: 'Handrail',
    version,
    description: 'A step-by-step guide at the side of the page you are working on.',
    icons: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png',
    },
    // storage: guides, progress and settings stay in the browser.
    // sidePanel: the drawer itself.
    // tabs: the address of the active tab, for "where am I" and "open here".
    permissions: ['storage', 'sidePanel', 'tabs'],
    // Fetching a guide from an address asks for that one origin, when you add it.
    optional_host_permissions: ['http://*/*', 'https://*/*'],
    action: { default_title: 'Open Handrail' },
    options_ui: { page: 'src/options/index.html', open_in_tab: true },
    background: { service_worker: 'assets/background.js', type: 'module' },
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'",
    },
  };

  if (target === 'chrome') {
    base.side_panel = { default_path: 'src/sidepanel/index.html' };
    base.minimum_chrome_version = '114';
  } else {
    // 0.2: Firefox sidebar from the same page.
    base.sidebar_action = { default_panel: 'src/sidepanel/index.html', default_title: 'Handrail' };
    base.background = { scripts: ['assets/background.js'], type: 'module' };
  }
  return base;
}
