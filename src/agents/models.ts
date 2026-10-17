// The models a chat can pick, from the agent in use. Claude takes these aliases with --model;
// "default" leaves the choice to Claude. A `command` agent has no picker.
export const CLAUDE_MODELS = [
  { id: 'default', label: 'Default' },
  { id: 'opus', label: 'Opus' },
  { id: 'sonnet', label: 'Sonnet' },
  { id: 'haiku', label: 'Haiku' },
];

export const modelsFor = (agent: string) => (agent === 'claude' ? CLAUDE_MODELS : []);
