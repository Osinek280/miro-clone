import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import EquationList from './EquationList';
import type { EquationRow } from '../types/types';

const MIN_WIDTH = 200;
const MAX_WIDTH = 560;
const DEFAULT_WIDTH = 320;
const HANDLE_PX = 6;

type EquationSidebarProps = {
  title?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultWidth?: number;
  side?: 'left' | 'right';
  className?: string;
  pushSyncedEquation: (
    equation: EquationRow,
    action: 'upsert' | 'remove',
  ) => void;
};

function EquationSidebar({
  title = 'Equations',
  open,
  onOpenChange,
  defaultWidth = DEFAULT_WIDTH,
  side = 'right',
  className = '',
  pushSyncedEquation,
}: EquationSidebarProps) {
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
    return null;
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
      className={`flex h-full shrink-0 border-gray-200 bg-white shadow-lg ${side === 'right' ? 'border-l' : 'border-r'} ${className}`}
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
            onClick={() => onOpenChange(false)}
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
        <div className="min-h-0 flex-1 overflow-auto text-sm text-gray-700">
          <EquationList pushSyncedEquation={pushSyncedEquation} />
        </div>
      </div>

      {side === 'left' ? handle : null}
    </aside>
  );
}

export default React.memo(EquationSidebar);
