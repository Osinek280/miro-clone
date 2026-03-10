import { useEffect, useRef } from "react";
import type { Camera } from "../types/types";
import { useGrid } from "./useGrid";

export type GridStyle = "grid" | "dots" | "axes"; // przyszłościowe

interface GridProps {
  cameraRef: React.RefObject<Camera>;
  style?: GridStyle;
}

export function Grid({ cameraRef, style = "grid" }: GridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { drawGrid } = useGrid(canvasRef, cameraRef, style);

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
