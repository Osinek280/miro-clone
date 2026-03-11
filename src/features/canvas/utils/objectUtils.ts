import type { DrawObject, Point } from '../types/types';

export const calcBoundingBox = (objs: DrawObject[]) => {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (const obj of objs) {
    const r = (obj.size ?? 15) / 2;
    for (const p of obj.points) {
      if (p.x - r < minX) minX = p.x - r;
      if (p.y - r < minY) minY = p.y - r;
      if (p.x + r > maxX) maxX = p.x + r;
      if (p.y + r > maxY) maxY = p.y + r;
    }
  }

  return {
    start: { x: minX, y: minY },
    end: { x: maxX, y: maxY },
  };
};

export function isPointOnPath(
  point: Point,
  path: Point[],
  threshold: number
): boolean {
  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i];
    const p2 = path[i + 1];

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lenSq = dx * dx + dy * dy;

    if (lenSq === 0) {
      // Degenerate segment — check distance to the point itself
      const dist = Math.hypot(point.x - p1.x, point.y - p1.y);
      if (dist < threshold) return true;
      continue;
    }

    const t = Math.max(
      0,
      Math.min(1, ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / lenSq)
    );
    const projX = p1.x + t * dx;
    const projY = p1.y + t * dy;

    const dist = Math.hypot(point.x - projX, point.y - projY);
    if (dist < threshold) return true;
  }
  return false;
}

export function findObjectAtPoint(
  point: Point,
  objects: DrawObject[],
  zoom: number = 1 // <-- receive zoom from camera
): DrawObject | null {
  // BASE_HIT_PX is the desired hit margin in *screen* pixels.
  // Dividing by zoom converts it to world-space units, matching
  // the coordinate space your points are stored in.
  const BASE_HIT_PX = 8;

  for (let i = objects.length - 1; i >= 0; i--) {
    const obj = objects[i];

    // The visible stroke radius in world-space is (size / 2).
    // Add a small screen-space margin on top for comfortable clicking.
    const strokeRadius = (obj.size ?? 15) / 2;
    const threshold = strokeRadius + BASE_HIT_PX / zoom;

    if (isPointOnPath(point, obj.points, threshold)) {
      return obj;
    }
  }
  return null;
}
