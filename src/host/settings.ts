import * as vscode from 'vscode';
import { settingsFrom, type Settings } from '@/app';

// Reads Elaia's settings. A repo's own .vscode/settings.json cannot pick a program,
// a command or a permission: settingsFrom reads only your User value for those.
export function readSettings(): Settings {
  return settingsFrom(vscode.workspace.getConfiguration('elaia'));
}
