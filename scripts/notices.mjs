// The third-party notices file: which node_modules packages went into the bundles
// (read from esbuild metafiles), each with its own LICENSE text. MIT asks for that text.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const LICENSE_FILE = /^(licen[cs]e|copying)/i;

// The package folder a bundled file came from: up to the last node_modules/ and one
// name after it, or two for a @scope/name. A nested copy counts as its own package.
export function packageDir(input) {
  const parts = input.split('/');
  const at = parts.lastIndexOf('node_modules');
  if (at === -1) return null;
  const take = parts[at + 1]?.startsWith('@') ? 3 : 2;
  if (parts.length < at + take) return null;
  return parts.slice(0, at + take).join('/');
}

function readPackage(full) {
  const pkg = JSON.parse(readFileSync(path.join(full, 'package.json'), 'utf8'));
  const file = readdirSync(full).find((name) => LICENSE_FILE.test(name));
  if (!file) return { name: pkg.name, missing: true };
  return {
    name: pkg.name,
    version: pkg.version,
    license: pkg.license ?? 'UNKNOWN',
    licenseText: readFileSync(path.join(full, file), 'utf8').trim(),
  };
}

export function bundledPackages(metafiles, root) {
  const dirs = new Set();
  for (const meta of metafiles) {
    for (const input of Object.keys(meta.inputs)) {
      const dir = packageDir(input);
      if (dir) dirs.add(dir);
    }
  }
  const found = [...dirs].map((dir) => readPackage(path.join(root, dir)));
  const missing = found.filter((p) => p.missing).map((p) => p.name);
  if (missing.length > 0) {
    throw new Error(
      `No LICENSE file in bundled package(s): ${missing.sort().join(', ')}. ` +
        'Its notice cannot ship, so the build stops.',
    );
  }
  const key = (p) => `${p.name}@${p.version}`;
  return found.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
}

export function noticesText(packages) {
  const head =
    'Third-party notices\n\n' +
    'Elaia bundles the packages below into its dist/ files. Each one is listed with its license.';
  const line = '-'.repeat(72);
  const body = packages.map(
    (p) => `${line}\n${p.name}@${p.version} (${p.license})\n\n${p.licenseText}`,
  );
  return `${[head, ...body].join('\n\n')}\n`;
}
