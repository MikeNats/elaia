import * as vscode from 'vscode';
import { SettingsSchema, type Settings } from '@/app';

// Reads Elaia's settings. A wrong value throws with the setting's name, so you know what to fix.
export function readSettings(): Settings {
  const c = vscode.workspace.getConfiguration('elaia');
  const parsed = SettingsSchema.safeParse({
    workflow: c.get('workflow'),
    glafkaPath: c.get('glafkaPath'),
    platform: c.get('platform'),
    agent: c.get('agent'),
    claudePath: c.get('claudePath'),
    agentCommand: c.get('agentCommand'),
    permissionMode: c.get('permissionMode'),
    allowedTools: c.get('allowedTools'),
    autoAdvance: c.get('autoAdvance'),
    handoffAt: c.get('handoffAt'),
    permissions: c.get('permissions'),
  });
  if (parsed.success) return parsed.data;
  const where = parsed.error.issues
    .map((i) => `elaia.${i.path.join('.')}: ${i.message}`)
    .join('; ');
  throw new Error(
    `Elaia settings are not valid — ${where}. Fix them in Settings, then reload the window.`,
  );
}
