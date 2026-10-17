import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { EpicSchema, epicsDir, readEpic } from '@/epics';

const ticket = (key: string, dependsOn: string[] = []) => ({
  key,
  title: key,
  brief: key,
  dependsOn,
});
const epic = (tickets: unknown[]) => ({ title: 'Publish polish', tickets });

// What the schema says is wrong with an epic, or [] when it is valid.
const problems = (epic: object) => {
  const parsed = EpicSchema.safeParse({ title: 'Epic', ...epic });
  return parsed.success ? [] : parsed.error.issues.map((i) => i.message);
};

describe('epic schema', () => {
  it('accepts tickets that depend on earlier ones', () => {
    expect(problems({ tickets: [ticket('a'), ticket('b', ['a'])] })).toEqual([]);
    expect(problems({ ordered: true, tickets: [ticket('a'), ticket('b', ['a'])] })).toEqual([]);
  });

  it('rejects a ticket that depends on itself', () => {
    expect(problems({ tickets: [ticket('a', ['a'])] })).toEqual(['ticket "a" depends on itself']);
  });

  it('rejects a dependsOn loop and names its keys', () => {
    const tickets = [ticket('a', ['b']), ticket('b', ['c']), ticket('c', ['a'])];
    expect(problems({ tickets })).toEqual([
      'tickets depend on each other in a loop: "a" → "b" → "c" → "a"',
    ]);
  });

  it('rejects a ticket in an ordered epic that depends on a later one', () => {
    expect(problems({ ordered: true, tickets: [ticket('a', ['b']), ticket('b')] })).toEqual([
      'ticket "a" depends on "b", which comes after it in an ordered epic',
    ]);
  });
});

// Keys become thread names ('todo-<slug>~<key>'): the webview refuses any other kind.
describe('epic ticket keys', () => {
  it('accepts short kebab-case keys', () => {
    const parsed = EpicSchema.safeParse(
      epic([ticket('csv-export'), ticket('docs', ['csv-export'])]),
    );
    expect(parsed.success).toBe(true);
  });

  it.each(['csv export', 'Ticket 1', 'ü-x', '-x', 'a/b', '..'])('refuses key %j', (key) => {
    expect(EpicSchema.safeParse(epic([ticket(key)])).success).toBe(false);
  });

  it('refuses an unsafe name in dependsOn', () => {
    expect(EpicSchema.safeParse(epic([ticket('a', ['a b'])])).success).toBe(false);
  });

  it('reports a bad key as a problem with the epic file', () => {
    const project = mkdtempSync(path.join(tmpdir(), 'elaia-epic-'));
    const dir = path.join(epicsDir(project), 'publish-polish');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'epic.json'), JSON.stringify(epic([ticket('csv export')])));
    const read = readEpic(project, 'publish-polish');
    expect(read.epic).toBeNull();
    expect(read.problem).toContain('tickets.0.key');
  });

  it('reports an epic folder whose name is not a safe slug', () => {
    const project = mkdtempSync(path.join(tmpdir(), 'elaia-epic-'));
    const dir = path.join(epicsDir(project), 'publish polish');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'epic.json'), JSON.stringify(epic([])));
    const read = readEpic(project, 'publish polish');
    expect(read.epic).toBeNull();
    expect(read.problem).toContain('short kebab-case');
  });
});
