import type * as vscode from 'vscode';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// What the fake VS Code was asked to do, and every way Elaia could start a process.
const fake = vi.hoisted(() => ({
  shown: [] as string[],
  commands: new Map<string, () => unknown>(),
  spawn: vi.fn(),
  execFile: vi.fn(),
  execFileSync: vi.fn(),
}));

vi.mock('vscode', () => ({
  window: {
    showErrorMessage: (text: string) => {
      fake.shown.push(text);
      return Promise.resolve(undefined);
    },
  },
  commands: {
    registerCommand: (id: string, run: () => unknown) => {
      fake.commands.set(id, run);
      return { dispose: () => undefined };
    },
  },
}));
vi.mock('node:child_process', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  spawn: fake.spawn,
  execFile: fake.execFile,
  execFileSync: fake.execFileSync,
}));

import { activate } from '@/host/extension';

const MESSAGE = 'Elaia runs on macOS and Linux for now.';
const realPlatform = process.platform;

function context(): vscode.ExtensionContext {
  return {
    subscriptions: [],
    globalStorageUri: { fsPath: '/nowhere' },
    extensionPath: '/nowhere',
  } as unknown as vscode.ExtensionContext;
}

describe('activate on Windows', () => {
  beforeEach(() => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    fake.shown.length = 0;
    fake.commands.clear();
  });
  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: realPlatform });
  });

  it('shows one message and starts nothing', () => {
    const api = activate(context());
    expect(fake.shown).toEqual([MESSAGE]);
    expect([...fake.commands.keys()]).toEqual(['elaia.open']);
    expect(api.app).toBeNull();
    expect(fake.spawn).not.toHaveBeenCalled();
    expect(fake.execFile).not.toHaveBeenCalled();
    expect(fake.execFileSync).not.toHaveBeenCalled();
  });

  it('shows the same message again from Open Panel', () => {
    activate(context());
    void fake.commands.get('elaia.open')?.();
    expect(fake.shown).toEqual([MESSAGE, MESSAGE]);
  });
});
