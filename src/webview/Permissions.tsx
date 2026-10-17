import type { Post } from './host';

const SAYS = {
  ask: 'A card asks you before a command outside your allow list.',
  auto: 'Agents run commands without asking. The usual forms of git push, rm -r, sudo, curl, wget and npm publish are blocked. This is not a sandbox.',
};

// Ask or Auto, for every chat. It is the VS Code setting elaia.permissions.
export function Permissions({ mode, post }: { mode: 'ask' | 'auto'; post: Post }) {
  return (
    <section className="facts-section">
      <h3>Permissions</h3>
      <div className="switch" role="radiogroup" aria-label="Permissions">
        {(['ask', 'auto'] as const).map((m) => (
          <button
            key={m}
            role="radio"
            aria-checked={mode === m}
            className={mode === m ? 'on' : 'secondary'}
            onClick={() => post({ type: 'set-permissions', mode: m })}
          >
            {m === 'ask' ? 'Ask' : 'Auto'}
          </button>
        ))}
      </div>
      <p className="muted small">{SAYS[mode]}</p>
    </section>
  );
}
