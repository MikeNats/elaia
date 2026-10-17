import { describe, expect, it, vi } from 'vitest';
import { glafkaWorkflow } from '@/workflow/glafka';
import { guarded, NOT_TRUSTED_GLAFKA, NotTrustedError, type Workflow } from '@/workflow';

const OK = { code: 0, stdout: '', stderr: '' };
// A glafka that is not there: a call that got through would fail with "was not found".
const base = () => glafkaWorkflow('/nowhere/glafka');

describe('guarded', () => {
  it('refuses every command that can run the repo, with a rejected promise', async () => {
    const g = guarded(base(), () => false);
    const calls = [
      g.install('/p', 'claude'),
      g.setupFindings('/p'),
      g.keepFinding('/p', 'conventions'),
      g.changeFinding('/p', 'workspace'),
      g.create('/p', 'idea'),
      g.advance('/p', 'T'),
      g.startWork('/p', 'T'),
      g.startCoder('/p', 'T'),
      g.close('/p', 'T'),
      g.cancel('/p', 'T'),
    ];
    for (const call of calls) await expect(call).rejects.toThrow(NOT_TRUSTED_GLAFKA);
  });

  it('lets reads through, and checks each setup step when it runs', async () => {
    const run = vi.fn(async () => OK);
    const tickets = vi.fn(async () => []);
    const wf: Workflow = {
      ...base(),
      tickets,
      autoSetup: () => [{ label: 'Mapping', done: 'Done.', run }],
    };
    let trusted = false;
    const g = guarded(wf, () => trusted);
    await expect(g.tickets('/p')).resolves.toEqual([]);
    expect(g.planFile('T')).toBe(wf.planFile('T'));
    const [step] = g.autoSetup('/p', ['map']);
    await expect(step?.run()).rejects.toBeInstanceOf(NotTrustedError);
    expect(run).not.toHaveBeenCalled();
    trusted = true;
    await expect(step?.run()).resolves.toEqual(OK);
    expect(run).toHaveBeenCalledOnce();
  });

  it('asks at each call, so a Trust pressed later counts at once', async () => {
    const install = vi.fn(async () => OK);
    let trusted = false;
    const g = guarded({ ...base(), install }, () => trusted);
    await expect(g.install('/p', 'claude')).rejects.toBeInstanceOf(NotTrustedError);
    trusted = true;
    await expect(g.install('/p', 'claude')).resolves.toEqual(OK);
  });
});
