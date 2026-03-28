import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, PanelRightOpen } from 'lucide-react';

const MIN_WIDTH = 200;
const MAX_WIDTH = 560;
const DEFAULT_WIDTH = 320;
const HANDLE_PX = 6;

type EquationSidebarProps = {
  title?: string;
  defaultOpen?: boolean;
  defaultWidth?: number;
  side?: 'left' | 'right';
  className?: string;
};

export default function EquationSidebar({
  title = 'Equations',
  defaultOpen = true,
  defaultWidth = DEFAULT_WIDTH,
  side = 'right',
  className = '',
}: EquationSidebarProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [width, setWidth] = useState(() =>
    Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, defaultWidth)),
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
      const next =
        side === 'right'
          ? startWidthRef.current - dx
          : startWidthRef.current + dx;
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
  }, [side]);

  if (!open) {
    return (
      <div
        className={`absolute top-1/2 z-50 -translate-y-1/2 ${side === 'right' ? 'right-0' : 'left-0'} ${className}`}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex cursor-pointer h-24 w-9 items-center justify-center rounded-l-md border border-gray-200 bg-white text-gray-600 shadow-md transition-colors hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          style={
            side === 'left'
              ? { borderRadius: '0 0.375rem 0.375rem 0' }
              : undefined
          }
          aria-expanded={false}
          aria-label={`Show ${title}`}
        >
          <PanelRightOpen
            className={`size-5 shrink-0 ${side === 'left' ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>
      </div>
    );
  }

  const handle = (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      onPointerDown={onResizePointerDown}
      className="shrink-0 cursor-col-resize touch-none border-gray-200 bg-gray-100/60 hover:bg-indigo-100/70 active:bg-indigo-200/80"
      style={{ width: HANDLE_PX }}
    />
  );

  return (
    <aside
      className={`absolute top-0 bottom-0 z-50 flex border-gray-200 bg-white shadow-lg ${side === 'right' ? 'right-0 border-l' : 'left-0 border-r'} ${className}`}
      style={{ width }}
    >
      {side === 'right' ? handle : null}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-200 px-3 py-2">
          <span className="truncate text-sm font-medium text-gray-800">
            {title}
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded cursor-pointer p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label={`Hide ${title}`}
          >
            {side === 'right' ? (
              <ChevronRight className="size-5" aria-hidden />
            ) : (
              <ChevronLeft className="size-5" aria-hidden />
            )}
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto p-3 text-sm text-gray-700">
          Equations List Here
        </div>
      </div>

      {side === 'left' ? handle : null}
    </aside>
  );
}
