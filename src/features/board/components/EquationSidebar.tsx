import { ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

const MIN_WIDTH = 200;
const MAX_WIDTH = 560;
const DEFAULT_WIDTH = 320;
const HANDLE_WIDTH = 8;

export default function EquationSidebar({
  onOpenChange,
}: {
  onOpenChange: (open: boolean) => void;
}) {
  const [width, setWidth] = useState(() =>
    Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, DEFAULT_WIDTH)),
  );

  const draggingRef = useRef(false);
  const startPointerXRef = useRef(0);
  const startWidthRef = useRef(0);

  const onResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      draggingRef.current = true;
      startPointerXRef.current = e.clientX;
      startWidthRef.current = width;
    },
    [width],
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      const dx = e.clientX - startPointerXRef.current;
      const next = startWidthRef.current - dx;
      setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, next)));
    };

    const onUp = () => {
      draggingRef.current = false;
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, []);

  const handle = (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      onPointerDown={onResizePointerDown}
      className="shrink-0 cursor-col-resize touch-none border-gray-200 bg-gray-100/60 hover:bg-indigo-100/70 active:bg-indigo-200/80"
      style={{ width: HANDLE_WIDTH }}
    />
  );
  return (
    <aside
      className="flex h-full shrink-0 border-gray-200 bg-white shadow-lg border-l"
      style={{ width }}
    >
      {handle}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-200 px-3 py-2">
          <span className="truncate text-sm font-medium text-gray-800">
            Equations
          </span>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded cursor-pointer p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label="Hide Equations"
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto text-sm text-gray-700">
          {/* <EquationList pushSyncedEquation={pushSyncedEquation} /> */}
        </div>
      </div>
    </aside>
  );
}
