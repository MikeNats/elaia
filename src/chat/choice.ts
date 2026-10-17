// Which agent runs a chat turn, and with what limits.
export type AgentChoice =
  | {
      kind: 'claude';
      bin: string;
      permissionMode: string;
      allowedTools: string[];
      readOnly: boolean;
      denyRules?: string[];
      extraSystemPrompt?: string;
      addDirs?: string[];
      tools?: string[];
      model?: string;
    }
  | { kind: 'command'; command: string };
