import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { chatsDir, elaiaDir, handoffsDir, prepareElaiaDir } from '@/memory';

const IGNORE = '# Elaia keeps chats and handoff notes here, on this machine only.\n*\n';
let project: string;
let elsewhere: string;
const ignoreFile = () => path.join(elaiaDir(project), '.gitignore');

beforeEach(() => {
  project = realpathSync(mkdtempSync(path.join(tmpdir(), 'elaia-places-')));
  elsewhere = realpathSync(mkdtempSync(path.join(tmpdir(), 'elaia-elsewhere-')));
});

describe('prepareElaiaDir', () => {
  it('makes .elaia, its .gitignore and the folder asked for', () => {
    prepareElaiaDir(project, handoffsDir(project, 'project'));
    expect(readFileSync(ignoreFile(), 'utf8')).toBe(IGNORE);
    expect(existsSync(handoffsDir(project, 'project'))).toBe(true);
  });

  it('never makes a deleted project folder again', () => {
    rmSync(project, { recursive: true, force: true });
    expect(() => prepareElaiaDir(project, chatsDir(project))).toThrow(
      `The project folder is missing: ${project}`,
    );
    expect(existsSync(project)).toBe(false);
  });

  it('replaces a .gitignore that does not ignore everything', () => {
    mkdirSync(elaiaDir(project));
    writeFileSync(ignoreFile(), '# just a comment\n');
    prepareElaiaDir(project, chatsDir(project));
    expect(readFileSync(ignoreFile(), 'utf8')).toBe(IGNORE);
  });

  it('writes nothing through a symlinked .elaia', () => {
    symlinkSync(elsewhere, elaiaDir(project));
    expect(() => prepareElaiaDir(project, chatsDir(project))).toThrow(
      `${elaiaDir(project)} is a symlink. Elaia writes nothing there.`,
    );
    expect(readdirSync(elsewhere)).toEqual([]);
  });

  it('writes nothing through a symlinked folder inside .elaia', () => {
    mkdirSync(elaiaDir(project));
    symlinkSync(elsewhere, chatsDir(project));
    expect(() => prepareElaiaDir(project, chatsDir(project))).toThrow(
      `${chatsDir(project)} is a symlink. Elaia writes nothing there.`,
    );
    expect(readdirSync(elsewhere)).toEqual([]);
  });

  it('writes nothing through a symlinked .gitignore', () => {
    mkdirSync(elaiaDir(project));
    const target = path.join(elsewhere, 'tracked.txt');
    writeFileSync(target, 'keep me\n');
    symlinkSync(target, ignoreFile());
    expect(() => prepareElaiaDir(project, chatsDir(project))).toThrow('is a symlink');
    expect(readFileSync(target, 'utf8')).toBe('keep me\n');
  });

  it('refuses a folder outside .elaia', () => {
    expect(() => prepareElaiaDir(project, path.join(project, 'docs'))).toThrow('is not in');
  });
});
