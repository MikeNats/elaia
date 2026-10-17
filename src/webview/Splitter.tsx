import { useRef, useState } from 'react';
import type { Side } from './useColumns';

interface SplitterProps {
  // Which side column this handle sizes. Left grows when dragged right, right when dragged left.
  side: Side;
  widths: Record<Side, number>;
  resize(side: Side, width: number): void;
  reset(side: Side): void;
  // The right column can slide away; while it is away the handle only shows the open button.
  rightClosed: boolean;
  toggleRight(): void;
}

const STEP = 16;

// A drag handle between two columns. Double-click puts the default width back.
export function Splitter({ side, widths, resize, reset, rightClosed, toggleRight }: SplitterProps) {
  const start = useRef<{ x: number; width: number } | null>(null);
  const [active, setActive] = useState(false);
  const width = widths[side];
  const sign = side === 'left' ? 1 : -1;
  const closed = side === 'right' && rightClosed;
  const stop = () => {
    start.current = null;
    setActive(false);
  };

  return (
    <div
      className={`splitter${active ? ' active' : ''}${closed ? ' closed' : ''}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${side} column`}
      aria-valuenow={width}
      tabIndex={0}
      title="Drag to resize · double-click to reset"
      onPointerDown={(e) => {
        if (closed) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = { x: e.clientX, width };
        setActive(true);
      }}
      onPointerMove={(e) => {
        if (start.current) resize(side, start.current.width + sign * (e.clientX - start.current.x));
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onDoubleClick={() => !closed && reset(side)}
      onKeyDown={(e) => {
        if (closed) return;
        if (e.key === 'ArrowLeft') resize(side, width - sign * STEP);
        if (e.key === 'ArrowRight') resize(side, width + sign * STEP);
      }}
    >
      {side === 'right' && (
        <button
          className="splitter-toggle"
          title={closed ? 'Show the ticket panel' : 'Hide the ticket panel'}
          aria-label={closed ? 'Show the ticket panel' : 'Hide the ticket panel'}
          onPointerDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onClick={toggleRight}
        >
          {closed ? '‹' : '›'}
        </button>
      )}
    </div>
  );
}
