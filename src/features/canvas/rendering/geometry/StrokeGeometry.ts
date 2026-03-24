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

export function buildStrokeGeometry(
  points: Point[],
  color: Rgba,
  size: number,
): CachedGeometry | null {
  if (points.length === 0) return null;

  const [r, g, b, a] = color;
  const buf: number[] = [];

  let lastX = NaN;
  let lastY = NaN;

  for (const p of points) {
    const dx = p.x - lastX;
    const dy = p.y - lastY;
    if (dx * dx + dy * dy < MIN_DIST * MIN_DIST && buf.length > 0) continue;

    buf.push(p.x, p.y, r, g, b, a, size);
    lastX = p.x;
    lastY = p.y;
  }

  // Always add the last point so the path ends exactly there.
  const last = points[points.length - 1];
  if (last.x !== lastX || last.y !== lastY) {
    buf.push(last.x, last.y, r, g, b, a, size);
  }

  const pointCount = buf.length / FPV;
  return { buffer: new Float32Array(buf), pointCount };
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
