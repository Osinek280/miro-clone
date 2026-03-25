import type { Point } from '../../types/types';

// Minimum distance between stored points (world space).
// mouseMove already interpolates every ~2px - this remains as a fallback.
export const MIN_DIST = 1.5;

// Floats per vertex in interleaved buffer:
// [x, y, r, g, b, a, pointSize]
export const FPV = 7;

export type Rgba = [number, number, number, number];

export interface CachedGeometry {
  buffer: Float32Array; // interleaved [x,y, r,g,b,a, size] per point
  pointCount: number;
}

export function hexToRgba(hex: string): Rgba {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (h.length !== 6) return [0, 0, 0, 1];
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
    1,
  ];
}

function countStrokeVertices(points: Point[]): number {
  let lastX = NaN;
  let lastY = NaN;
  let count = 0;

  for (const p of points) {
    const dx = p.x - lastX;
    const dy = p.y - lastY;
    if (dx * dx + dy * dy < MIN_DIST * MIN_DIST && count > 0) continue;
    count++;
    lastX = p.x;
    lastY = p.y;
  }

  const last = points[points.length - 1];
  if (last.x !== lastX || last.y !== lastY) count++;
  return count;
}

export function buildStrokeGeometry(
  points: Point[],
  color: Rgba,
  size: number,
): CachedGeometry | null {
  if (points.length === 0) return null;

  const pointCount = countStrokeVertices(points);
  if (pointCount === 0) return null;

  const [r, g, b, a] = color;
  const buf = new Float32Array(pointCount * FPV);
  let lastX = NaN;
  let lastY = NaN;
  let w = 0;

  const write = (x: number, y: number) => {
    buf[w] = x;
    buf[w + 1] = y;
    buf[w + 2] = r;
    buf[w + 3] = g;
    buf[w + 4] = b;
    buf[w + 5] = a;
    buf[w + 6] = size;
    w += FPV;
  };

  for (const p of points) {
    const dx = p.x - lastX;
    const dy = p.y - lastY;
    if (dx * dx + dy * dy < MIN_DIST * MIN_DIST && w > 0) continue;
    write(p.x, p.y);
    lastX = p.x;
    lastY = p.y;
  }

  const last = points[points.length - 1];
  if (last.x !== lastX || last.y !== lastY) {
    write(last.x, last.y);
  }

  return { buffer: buf, pointCount };
}

/** Copy cached interleaved vertices into `all` at float offset, adding (ox, oy) to x,y. */
export function writeGeometryWithOffset(
  geometry: CachedGeometry,
  all: Float32Array,
  floatOffset: number,
  ox: number,
  oy: number,
): void {
  const buf = geometry.buffer;
  const pc = geometry.pointCount;
  if (ox === 0 && oy === 0) {
    all.set(buf, floatOffset);
    return;
  }

  let w = floatOffset;
  for (let i = 0; i < pc; i++) {
    const si = i * FPV;
    all[w] = buf[si] + ox;
    all[w + 1] = buf[si + 1] + oy;
    all[w + 2] = buf[si + 2];
    all[w + 3] = buf[si + 3];
    all[w + 4] = buf[si + 4];
    all[w + 5] = buf[si + 5];
    all[w + 6] = buf[si + 6];
    w += FPV;
  }
}
