import { useState, type DragEvent } from 'react';
import type { ThreadRef } from '@/shared';
import type { Post } from './host';

function readAsBase64(file: File): Promise<{ name: string; data: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({ name: file.name, data: String(reader.result).split(',')[1] ?? '' });
    reader.onerror = () => reject(reader.error ?? new Error(`could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

// Files dropped on the main chat go to the host, which saves them in the repo's inbox.
export function useFileDrop(threadRef: ThreadRef, enabled: boolean, post: Post) {
  const [dropping, setDropping] = useState(false);
  if (!enabled) return { dropping: false, handlers: {} };
  const handlers = {
    onDragOver: (e: DragEvent) => {
      e.preventDefault();
      setDropping(true);
    },
    onDragLeave: () => setDropping(false),
    onDrop: async (e: DragEvent) => {
      e.preventDefault();
      setDropping(false);
      const files = await Promise.all([...e.dataTransfer.files].map(readAsBase64));
      if (files.length > 0) post({ type: 'drop-files', project: threadRef.project, files });
    },
  };
  return { dropping, handlers };
}
