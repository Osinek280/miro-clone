import { useCallback, useEffect, useRef } from 'react';
import { MATH_UNIT_WORLD_SCALE } from '../constants/mathViewConstants';
import type { Camera } from '../types/types';

export type GridStyle = 'grid' | 'dots' | 'axes';

const SUBDIVISIONS = 5;
const MIN_PX_SPACING = 20;

/** Nice tick step in mathematical units (1, 2, 5, 10, …). */
function niceStepMath(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  const exp = Math.floor(Math.log10(raw));
  const base = 10 ** exp;
  const f = raw / base;
  let m = 1;
  if (f <= 1) m = 1;
  else if (f <= 2) m = 2;
  else if (f <= 5) m = 5;
  else m = 10;
  return m * base;
}

/** Readable labels for world-coordinate ticks (canvas: x→, y↓). */
function formatTickLabel(v: number): string {
  if (!Number.isFinite(v)) return '';
  const a = Math.abs(v);
  if (a === 0) return '0';
  if (a < 1e-4 || a >= 1e6) return v.toExponential(1);
  const rounded = Math.round(v * 1e6) / 1e6;
  if (Number.isInteger(rounded) && Math.abs(rounded) < 1e9) {
    return String(rounded);
  }
  const s = rounded.toFixed(4).replace(/\.?0+$/, '');
  return s === '-0' ? '0' : s;
}

export function useGrid(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  cameraRef: React.RefObject<Camera>,
  style: GridStyle = 'dots',
) {
  const prevCameraRef = useRef({ zoom: -1, offsetX: -1, offsetY: -1 });
  const rafRef = useRef<number | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { zoom, offsetX, offsetY } = cameraRef.current;
    const { width, height } = canvas;

    ctx.clearRect(0, 0, width, height);

    const raw = MIN_PX_SPACING / (zoom * Math.max(MATH_UNIT_WORLD_SCALE, 1e-9));
    let spacingMath = niceStepMath(raw);
    if (spacingMath < 1) spacingMath = 1;
    const spacing = spacingMath * MATH_UNIT_WORLD_SCALE;
    const subSpacing = (spacingMath / SUBDIVISIONS) * MATH_UNIT_WORLD_SCALE;
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

    if (style === 'grid' || style === 'axes') {
      if (subSpacingPx >= MIN_PX_SPACING) {
        drawLines(subSpacing, '#e5e7eb', 0.5);
      }
      drawLines(spacing, '#d1d5db', 1);

      ctx.beginPath();
      ctx.strokeStyle = '#9ca3af';
      ctx.lineWidth = 1.5;
      ctx.moveTo(offsetX, 0);
      ctx.lineTo(offsetX, height);
      ctx.moveTo(0, offsetY);
      ctx.lineTo(width, offsetY);
      ctx.stroke();
    }

    if (style === 'axes') {
      // Ticks on world axes (y = 0, x = 0), aligned with the drawn axis lines.
      const tickLen = 6;
      const labelGap = 4;
      const labelFont = '11px system-ui, ui-sans-serif, sans-serif';

      ctx.font = labelFont;
      ctx.fillStyle = '#4b5563';
      ctx.strokeStyle = '#9ca3af';
      ctx.lineWidth = 1;

      const halfTick = tickLen / 2;
      const axisY = offsetY;
      const axisX = offsetX;

      // X axis (world y = 0): vertical ticks + x labels next to the axis.
      if (axisY >= -halfTick && axisY <= height + halfTick) {
        ctx.textAlign = 'center';
        const startTickX = Math.floor(worldLeft / spacing) * spacing;
        const labelBelowY = axisY + halfTick + labelGap;
        const roomBelow = height - labelBelowY;
        const putXLabelsBelow = roomBelow >= 12;
        for (let x = startTickX; x <= worldRight; x += spacing) {
          const sx = x * zoom + offsetX;
          if (sx < -8 || sx > width + 8) continue;
          ctx.beginPath();
          ctx.moveTo(sx, axisY - halfTick);
          ctx.lineTo(sx, axisY + halfTick);
          ctx.stroke();
          ctx.textBaseline = putXLabelsBelow ? 'top' : 'bottom';
          ctx.fillText(
            formatTickLabel(x / MATH_UNIT_WORLD_SCALE),
            sx,
            putXLabelsBelow ? labelBelowY : axisY - halfTick - labelGap,
          );
        }
      }

      // Y axis (world x = 0): horizontal ticks + y labels next to the axis.
      if (axisX >= -halfTick && axisX <= width + halfTick) {
        ctx.textBaseline = 'middle';
        const labelLeftX = axisX - halfTick - labelGap;
        const roomLeft = labelLeftX;
        const putYLabelsLeft = roomLeft >= 8;
        const startTickY = Math.floor(worldTop / spacing) * spacing;
        for (let y = startTickY; y <= worldBottom; y += spacing) {
          const sy = y * zoom + offsetY;
          if (sy < -8 || sy > height + 8) continue;
          ctx.beginPath();
          ctx.moveTo(axisX - halfTick, sy);
          ctx.lineTo(axisX + halfTick, sy);
          ctx.stroke();
          ctx.textAlign = putYLabelsLeft ? 'right' : 'left';
          ctx.fillText(
            formatTickLabel(y / MATH_UNIT_WORLD_SCALE),
            putYLabelsLeft
              ? Math.max(2, labelLeftX)
              : axisX + halfTick + labelGap,
            sy,
          );
        }
      }
    }

    if (style === 'dots') {
      ctx.fillStyle = '#9ca3af';
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

  // Custom RAF loop — redraws only when camera actually changed
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
