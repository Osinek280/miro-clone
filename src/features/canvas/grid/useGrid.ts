import { useCallback, useEffect, useRef } from "react";
import type { Camera } from "../types/types";

export type GridStyle = "grid" | "dots" | "axes";

const GRID_BASE = 100;
const SUBDIVISIONS = 5;
const MIN_PX_SPACING = 20;

export function useGrid(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  cameraRef: React.RefObject<Camera>,
  style: GridStyle = "dots",
) {
  const prevCameraRef = useRef({ zoom: -1, offsetX: -1, offsetY: -1 });
  const rafRef = useRef<number | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { zoom, offsetX, offsetY } = cameraRef.current;
    const { width, height } = canvas;

    ctx.clearRect(0, 0, width, height);

    let spacing = GRID_BASE;
    while (spacing * zoom < MIN_PX_SPACING) spacing *= SUBDIVISIONS;
    while (spacing * zoom > MIN_PX_SPACING * SUBDIVISIONS * 2)
      spacing /= SUBDIVISIONS;

    const subSpacing = spacing / SUBDIVISIONS;
    const subSpacingPx = subSpacing * zoom;

    const worldLeft = -offsetX / zoom;
    const worldTop = -offsetY / zoom;
    const worldRight = (width - offsetX) / zoom;
    const worldBottom = (height - offsetY) / zoom;

    const drawLines = (step: number, color: string, lineWidth: number) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;

      const startX = Math.floor(worldLeft / step) * step;
      for (let x = startX; x <= worldRight; x += step) {
        const sx = x * zoom + offsetX;
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, height);
      }

      const startY = Math.floor(worldTop / step) * step;
      for (let y = startY; y <= worldBottom; y += step) {
        const sy = y * zoom + offsetY;
        ctx.moveTo(0, sy);
        ctx.lineTo(width, sy);
      }

      ctx.stroke();
    };

    if (style === "grid") {
      if (subSpacingPx >= MIN_PX_SPACING) {
        drawLines(subSpacing, "#e5e7eb", 0.5);
      }
      drawLines(spacing, "#d1d5db", 1);

      ctx.beginPath();
      ctx.strokeStyle = "#9ca3af";
      ctx.lineWidth = 1.5;
      ctx.moveTo(offsetX, 0);
      ctx.lineTo(offsetX, height);
      ctx.moveTo(0, offsetY);
      ctx.lineTo(width, offsetY);
      ctx.stroke();
    }

    if (style === "dots") {
      ctx.fillStyle = "#9ca3af";
      const step = subSpacingPx >= MIN_PX_SPACING ? subSpacing : spacing;
      const startX = Math.floor(worldLeft / step) * step;
      const startY = Math.floor(worldTop / step) * step;
      for (let x = startX; x <= worldRight; x += step) {
        for (let y = startY; y <= worldBottom; y += step) {
          const sx = x * zoom + offsetX;
          const sy = y * zoom + offsetY;
          ctx.beginPath();
          ctx.arc(sx, sy, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }, [canvasRef, cameraRef, style]);

  // Własna pętla RAF — przerysowuje tylko gdy kamera faktycznie się zmieniła
  useEffect(() => {
    const loop = () => {
      const cam = cameraRef.current;
      const prev = prevCameraRef.current;
      if (
        cam.zoom !== prev.zoom ||
        cam.offsetX !== prev.offsetX ||
        cam.offsetY !== prev.offsetY
      ) {
        draw();
        prevCameraRef.current = {
          zoom: cam.zoom,
          offsetX: cam.offsetX,
          offsetY: cam.offsetY,
        };
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [draw, cameraRef]);

  return { drawGrid: draw };
}
