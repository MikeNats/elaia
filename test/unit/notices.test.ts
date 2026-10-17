import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { bundledPackages, noticesText, packageDir } from '../../scripts/notices.mjs';

type Pkg = { name: string; version: string; license: string };

function fakePackage(root: string, dir: string, pkg: Pkg, licenseFile: string | null) {
  const full = path.join(root, dir);
  mkdirSync(full, { recursive: true });
  writeFileSync(path.join(full, 'package.json'), JSON.stringify(pkg));
  if (licenseFile) {
    writeFileSync(
      path.join(full, licenseFile),
      `${pkg.license} License\n\nCopyright (c) ${pkg.name} authors\n`,
    );
  }
}

const meta = (...inputs: string[]) => ({
  inputs: Object.fromEntries(inputs.map((input) => [input, {}])),
});

const tempRoot = () => mkdtempSync(path.join(tmpdir(), 'elaia-notices-'));

describe('packageDir', () => {
  it('finds the package folder a bundled file came from', () => {
    expect(packageDir('node_modules/react/index.js')).toBe('node_modules/react');
    expect(packageDir('node_modules/@scope/b/lib/x.js')).toBe('node_modules/@scope/b');
    expect(packageDir('node_modules/a/node_modules/c/y.js')).toBe('node_modules/a/node_modules/c');
    expect(packageDir('src/host/index.ts')).toBeNull();
  });
});

describe('bundledPackages', () => {
  it('lists each bundled package once, sorted, with its license text', () => {
    const root = tempRoot();
    fakePackage(
      root,
      'node_modules/zod',
      { name: 'zod', version: '4.0.0', license: 'MIT' },
      'LICENSE',
    );
    fakePackage(
      root,
      'node_modules/@scope/b',
      { name: '@scope/b', version: '1.0.0', license: 'ISC' },
      'license.md',
    );
    fakePackage(
      root,
      'node_modules/zod/node_modules/c',
      { name: 'c', version: '2.0.0', license: 'MIT' },
      'LICENCE.txt',
    );

    const packages = bundledPackages(
      [
        meta('src/a.ts', 'node_modules/zod/index.js', 'node_modules/zod/lib/b.js'),
        meta('node_modules/@scope/b/x.js', 'node_modules/zod/node_modules/c/y.js'),
      ],
      root,
    );

    expect(packages.map((p) => p.name)).toEqual(['@scope/b', 'c', 'zod']);
    expect(packages[2]).toMatchObject({ name: 'zod', version: '4.0.0', license: 'MIT' });
    expect(packages[2]?.licenseText).toContain('Copyright (c) zod authors');
  });

  it('throws and names the bundled package that has no license file', () => {
    const root = tempRoot();
    fakePackage(root, 'node_modules/zod', { name: 'zod', version: '4.0.0', license: 'MIT' }, null);
    fakePackage(
      root,
      'node_modules/react',
      { name: 'react', version: '19.0.0', license: 'MIT' },
      'LICENSE',
    );

    expect(() =>
      bundledPackages([meta('node_modules/zod/index.js', 'node_modules/react/index.js')], root),
    ).toThrow(/zod/);
  });
});

describe('noticesText', () => {
  it('lists each package with its version, license and full text', () => {
    const text = noticesText([
      {
        name: 'zod',
        version: '4.0.0',
        license: 'MIT',
        licenseText: 'MIT License\n\nCopyright (c) Colin',
      },
      {
        name: 'react',
        version: '19.0.0',
        license: 'MIT',
        licenseText: 'MIT License\n\nCopyright (c) Meta',
      },
    ]);

    expect(text).toContain('zod@4.0.0 (MIT)');
    expect(text).toContain('Copyright (c) Colin');
    expect(text).toContain('react@19.0.0 (MIT)');
    expect(text).toContain('Copyright (c) Meta');
  });
});
