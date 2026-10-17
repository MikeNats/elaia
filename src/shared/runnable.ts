// One thing a repo can make run on your computer, and the file it came from.
export interface Runnable {
  // Relative to the project: '.claude/settings.json', say.
  file: string;
  // What it is: 'hook SessionStart', 'MCP server db', 'agents.coder'.
  what: string;
  // The command, URL or value, as written in the file.
  run: string;
}
