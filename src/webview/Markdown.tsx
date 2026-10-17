import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// The agent writes Markdown. Rendered here; raw HTML in it is never run.
export function Markdown({ text }: { text: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}
