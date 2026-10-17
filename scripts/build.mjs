// Two bundles: the extension host (Node, CommonJS) and the webview (browser).
import { build } from 'esbuild';
import { writeFileSync } from 'node:fs';
import { bundledPackages, noticesText } from './notices.mjs';

// The @/ alias comes from tsconfig paths, which esbuild reads itself.
const common = { bundle: true, sourcemap: true, metafile: true, logLevel: 'info' };

const host = await build({
  ...common,
  entryPoints: ['src/host/index.ts'],
  outfile: 'dist/extension.cjs',
  platform: 'node',
  format: 'cjs',
  // VS Code 1.95 ships Node 20.
  target: 'node20',
  external: ['vscode'],
});

// The `elaia` command agents run to search what Elaia remembers. Plain Node, no VS Code.
const cli = await build({
  ...common,
  entryPoints: ['src/memory/cli.ts'],
  outfile: 'dist/elaia-cli.cjs',
  platform: 'node',
  format: 'cjs',
  target: 'node18',
});

const webview = await build({
  ...common,
  entryPoints: { main: 'src/webview/main.tsx' },
  outdir: 'dist/webview',
  platform: 'browser',
  format: 'iife',
  target: 'es2022',
  jsx: 'automatic',
  // Fixed names, so the HTML can point at them without a manifest.
  entryNames: '[name]',
  define: { 'process.env.NODE_ENV': '"production"' },
  // The logo goes inside the bundle, so the page needs no extra file.
  loader: { '.svg': 'dataurl' },
  minify: true,
});

// Every library the bundles hold ships its license with the vsix.
const packages = bundledPackages([host.metafile, cli.metafile, webview.metafile], process.cwd());
writeFileSync('dist/THIRD-PARTY-NOTICES.txt', noticesText(packages));
