import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// The folder Elaia puts first on every agent's PATH, so `elaia recall` works in any chat.
export const binDir = (storeRoot: string) => path.join(storeRoot, 'bin');

export const MEMORY_TOOLS = ['Bash(elaia recall:*)', 'Bash(elaia show:*)'];

export function memoryEnv(storeRoot: string): Record<string, string> {
  const rest = process.env.PATH ?? '';
  return { PATH: `${binDir(storeRoot)}${path.delimiter}${rest}`, ELAIA_STORE: storeRoot };
}

const quote = (s: string) => `'${s.replaceAll("'", `'\\''`)}'`;

// Writes the `elaia` command. It uses `node` when there is one, else VS Code's own runtime.
export function installCli(storeRoot: string, cliFile: string, runtime: string): string {
  if (!existsSync(cliFile)) throw new Error(`${cliFile} is missing from the install`);
  const dir = binDir(storeRoot);
  mkdirSync(dir, { recursive: true });
  const args = `${quote(cliFile)} "$@"`;
  const sh = [
    '#!/bin/sh',
    '# Written by Elaia on every start. Search what Elaia remembers: elaia help',
    `export ELAIA_STORE=${quote(storeRoot)}`,
    `if command -v node >/dev/null 2>&1; then exec node ${args}; fi`,
    `ELECTRON_RUN_AS_NODE=1 exec ${quote(runtime)} ${args}`,
    '',
  ].join('\n');
  const file = path.join(dir, 'elaia');
  writeFileSync(file, sh);
  chmodSync(file, 0o755);
  const cmd = `@echo off\r\nset "ELAIA_STORE=${storeRoot}"\r\nnode "${cliFile}" %*\r\n`;
  writeFileSync(path.join(dir, 'elaia.cmd'), cmd);
  return file;
}
