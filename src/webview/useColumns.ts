import { useCallback, useEffect, useState } from 'react';
import { saveState, vscodeApi } from './host';

export type Side = 'left' | 'right';
type Widths = Record<Side, number>;

const DEFAULT: Widths = { left: 260, right: 320 };
const MIN_SIDE = 160;
const MIN_CENTER = 320;

function saved(): { widths?: Partial<Widths>; rightClosed?: boolean } | null {
  return vscodeApi().getState() as { widths?: Partial<Widths>; rightClosed?: boolean } | null;
}

// The facts column's width in pixels; the thread takes the rest. The facts column can also
// slide away. Both are remembered per panel. (`left` stays for widths saved before.)
export function useColumns(withLeft = false) {
  const [widths, setWidths] = useState<Widths>(() => ({ ...DEFAULT, ...saved()?.widths }));
  const [rightClosed, setRightClosed] = useState(() => saved()?.rightClosed === true);

  useEffect(() => {
    saveState({ widths, rightClosed });
  }, [widths, rightClosed]);

  const resize = useCallback((side: Side, width: number) => {
    setWidths((now) => {
      const other = side === 'left' ? now.right : now.left;
      const max = Math.max(MIN_SIDE, window.innerWidth - other - MIN_CENTER);
      return { ...now, [side]: Math.round(Math.min(max, Math.max(MIN_SIDE, width))) };
    });
  }, []);

  const reset = useCallback((side: Side) => resize(side, DEFAULT[side]), [resize]);
  const toggleRight = useCallback(() => setRightClosed((closed) => !closed), []);
  const right = `minmax(0, 1fr) 5px ${rightClosed ? 0 : widths.right}px`;
  const template = withLeft ? `${widths.left}px 5px ${right}` : right;
  return { widths, resize, reset, rightClosed, toggleRight, template };
}
