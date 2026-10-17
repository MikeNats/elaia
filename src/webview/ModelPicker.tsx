import type { ThreadRef } from '@/shared';
import type { Post } from './host';

// The model for this chat, from the agent in use. The next message uses it; the chat goes on.
export function ModelPicker({
  threadRef,
  models,
  model,
  post,
}: {
  threadRef: ThreadRef;
  models: { id: string; label: string }[];
  model: string;
  post: Post;
}) {
  if (models.length === 0) return null;
  return (
    <label className="model-picker" title="The model for this chat">
      Model
      <select
        value={model}
        onChange={(event) => post({ type: 'set-model', ...threadRef, model: event.target.value })}
      >
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
    </label>
  );
}
