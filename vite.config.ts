import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { manifest } from './src/manifest.ts';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

// One codebase, one manifest per browser: `vite build` is Chrome, `vite build --mode firefox` is Firefox.
export default defineConfig(({ mode }) => {
  const target = (mode === 'firefox' ? 'firefox' : 'chrome') as 'chrome' | 'firefox';
  return {
  publicDir: 'public',
  build: {
    outDir: target === 'firefox' ? 'dist-firefox' : 'dist',
    emptyOutDir: true,
    target: 'es2022',
    modulePreload: false,
    sourcemap: false,
    rollupOptions: {
      input: {
        sidepanel: 'src/sidepanel/index.html',
        options: 'src/options/index.html',
        background: 'src/background/index.ts',
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  plugins: [
    {
      name: 'handrail-manifest',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'manifest.json',
          source: JSON.stringify(manifest(target, pkg.version), null, 2) + '\n',
        });
      },
    },
  ],
  };
});
