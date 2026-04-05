import type { DrawObject, ImageDrawObject, Point } from '../types/types';

/** Exclude tombstoned (soft-deleted) objects for display and hit-test. */
export function getVisibleObjects(objects: DrawObject[]): DrawObject[] {
  return objects.filter((o) => !o.tombstone);
}

/** Axis-aligned bounds containing a rotated image quad. */
export function imageRotatedAxisBounds(obj: ImageDrawObject): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  const corners = imageRotatedCornerPoints(obj);
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of corners) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

function imageRotatedCornerPoints(obj: ImageDrawObject): Point[] {
  const w = obj.width;
  const h = obj.height;
  const rot = obj.rotation ?? 0;
  const cx = obj.x + w / 2;
  const cy = obj.y + h / 2;
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const local: Point[] = [
    { x: -w / 2, y: -h / 2 },
    { x: w / 2, y: -h / 2 },
    { x: w / 2, y: h / 2 },
    { x: -w / 2, y: h / 2 },
  ];
  return local.map((p) => ({
    x: cx + c * p.x - s * p.y,
    y: cy + s * p.x + c * p.y,
  }));
}

/** Selection handles quad (nw, ne, se, sw) aligned with the image’s rotation. */
export function imageOrientedSelectionQuad(
  obj: ImageDrawObject,
): [Point, Point, Point, Point] {
  const pts = imageRotatedCornerPoints(obj);
  return [pts[0]!, pts[1]!, pts[2]!, pts[3]!];
}

/** Single non-axis-aligned image selection → rotated chrome; otherwise axis-aligned only. */
export function orientedSelectionQuadForIds(
  objects: DrawObject[],
  ids: readonly string[],
): [Point, Point, Point, Point] | null {
  if (ids.length !== 1) return null;
  const o = objects.find((x) => x.id === ids[0]);
  if (o?.type !== 'IMAGE') return null;
  if (Math.abs(o.rotation ?? 0) <= 1e-6) return null;
  return imageOrientedSelectionQuad(o);
}

/** True if any selected image has non-zero rotation (resize uses axis-aligned remap only). */
export function selectionHasRotatedImage(
  objects: DrawObject[],
  selectedIds: readonly string[],
): boolean {
  const idSet = new Set(selectedIds);
  for (const o of objects) {
    if (o.type !== 'IMAGE' || !idSet.has(o.id)) continue;
    if (Math.abs(o.rotation ?? 0) > 1e-6) return true;
  }
  return false;
}

export const calcBoundingBox = (objs: DrawObject[]) => {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (const obj of objs) {
    if (obj.type === 'IMAGE') {
      const b = imageRotatedAxisBounds(obj);
      if (b.minX < minX) minX = b.minX;
      if (b.minY < minY) minY = b.minY;
      if (b.maxX > maxX) maxX = b.maxX;
      if (b.maxY > maxY) maxY = b.maxY;
      continue;
    }

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
  threshold: number,
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
      Math.min(1, ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / lenSq),
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
  zoom: number = 1, // <-- receive zoom from camera
): DrawObject | null {
  const visible = getVisibleObjects(objects);
  const BASE_HIT_PX = 8;

  for (let i = visible.length - 1; i >= 0; i--) {
    const obj = visible[i];

    if (obj.type === 'IMAGE') {
      const margin = BASE_HIT_PX / zoom;
      const rot = obj.rotation ?? 0;
      if (Math.abs(rot) < 1e-9) {
        if (
          point.x >= obj.x - margin &&
          point.x <= obj.x + obj.width + margin &&
          point.y >= obj.y - margin &&
          point.y <= obj.y + obj.height + margin
        ) {
          return obj;
        }
        continue;
      }
      const w = obj.width;
      const h = obj.height;
      const cx = obj.x + w / 2;
      const cy = obj.y + h / 2;
      const c = Math.cos(-rot);
      const s = Math.sin(-rot);
      const dx = point.x - cx;
      const dy = point.y - cy;
      const lx = c * dx - s * dy;
      const ly = s * dx + c * dy;
      if (
        lx >= -w / 2 - margin &&
        lx <= w / 2 + margin &&
        ly >= -h / 2 - margin &&
        ly <= h / 2 + margin
      ) {
        return obj;
      }
      continue;
    }

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

/**
 * World-space marquee: path is included if any vertex lies inside the rect;
 * image if its axis-aligned bounds intersect the rect.
 */
export function drawObjectIntersectsSelectionRect(
  obj: DrawObject,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
): boolean {
  if (obj.type === 'IMAGE') {
    const b = imageRotatedAxisBounds(obj);
    return !(maxX < b.minX || minX > b.maxX || maxY < b.minY || minY > b.maxY);
  }
  return obj.points.some(
    (p) => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY,
  );
}
