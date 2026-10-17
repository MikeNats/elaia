export function ErrorBanner({ text, onDismiss }: { text: string | null; onDismiss(): void }) {
  if (!text) return null;
  return (
    <div className="banner-error" role="alert">
      <span>{text}</span>
      <button className="link" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  );
}
