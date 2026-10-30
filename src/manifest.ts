// The manifest, generated at build time. One codebase, one manifest per browser.
// Permissions are the minimum for what the drawer does; see README "Permissions".
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
    action: { default_title: 'Open Handrail' },
    options_ui: { page: 'src/options/index.html', open_in_tab: true },
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'",
    },
  };

  if (target === 'chrome') {
    // storage: guides, progress and settings stay in the browser.
    // sidePanel: the drawer itself.
    // tabs: the address of the active tab, for "where am I" and "open here".
    base.permissions = ['storage', 'sidePanel', 'tabs'];
    // Fetching a guide from an address asks for that one origin, when you add it.
    base.optional_host_permissions = ['http://*/*', 'https://*/*'];
    base.side_panel = { default_path: 'src/sidepanel/index.html' };
    base.background = { service_worker: 'assets/background.js', type: 'module' };
    base.minimum_chrome_version = '114';
  } else {
    base.permissions = ['storage', 'tabs'];
    // Firefox takes host patterns here; they are asked for per origin, the same way.
    base.optional_permissions = ['http://*/*', 'https://*/*'];
    base.sidebar_action = {
      default_panel: 'src/sidepanel/index.html',
      default_title: 'Handrail',
      default_icon: 'icons/icon-32.png',
      // Opens once, right after install: the first run needs no hunting for a button.
      open_at_install: true,
    };
    base.background = { scripts: ['assets/background.js'] };
    base.browser_specific_settings = {
      gecko: {
        id: 'handrail@dragnoz.github.io',
        // 142 is the first Firefox (desktop and Android) that understands the declaration below.
        strict_min_version: '142.0',
        // No data is collected or sent; this is the declaration Firefox asks for.
        data_collection_permissions: { required: ['none'] },
      },
    };
  }
  return base;
}
