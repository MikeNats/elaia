// An agent a chat has running: what it was asked, its latest step, and every step so far.
export interface LiveAgent {
  about: string;
  task: string;
  doing: string;
  steps: string[];
  startedAt: string;
}
