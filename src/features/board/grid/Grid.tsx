import { useEffect, useRef } from 'react';
import type { Camera } from '../types/types';
import { useGrid } from './useGrid';

interface GridProps {
  cameraRef: React.RefObject<Camera>;
}

export function Grid({ cameraRef }: GridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { drawGrid } = useGrid(canvasRef, cameraRef);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      drawGrid();
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [drawGrid]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
