import type { DrawObject, Point } from '../../types/types';
import type { GeometryCache } from '../cache/GeometryCache';
import {
  buildStrokeGeometry,
  hexToRgba,
  FPV,
  writeGeometryWithOffset,
} from '../geometry/StrokeGeometry';

export function assembleSceneBuffer(params: {
  objects: DrawObject[];
  cache: GeometryCache;
  currentPath: Point[];
  currentColor: string;
  currentSize: number;
  selectionDrag: { offset: Point; selectedIds: readonly string[] } | null;
}): { vertices: Float32Array; pointCount: number } {
  const { objects, cache, currentPath, currentColor, currentSize, selectionDrag } =
    params;

  let liveGeo = null;
  if (currentPath.length > 0) {
    liveGeo = buildStrokeGeometry(currentPath, hexToRgba(currentColor), currentSize);
  }

  let totalPoints = 0;
  for (const obj of objects) {
    const g = cache.get(obj.id);
    if (g) totalPoints += g.pointCount;
  }
  if (liveGeo) totalPoints += liveGeo.pointCount;

  if (totalPoints === 0) return { vertices: new Float32Array(0), pointCount: 0 };

  const dragSet =
    selectionDrag &&
    selectionDrag.selectedIds.length > 0 &&
    (selectionDrag.offset.x !== 0 || selectionDrag.offset.y !== 0)
      ? new Set(selectionDrag.selectedIds)
      : null;
  const ox = selectionDrag?.offset.x ?? 0;
  const oy = selectionDrag?.offset.y ?? 0;

  const all = new Float32Array(totalPoints * FPV);
  let offset = 0;

  const append = (buffer: Float32Array) => {
    all.set(buffer, offset);
    offset += buffer.length;
  };

  for (const obj of objects) {
    const g = cache.get(obj.id);
    if (!g) continue;
    if (dragSet?.has(obj.id)) {
      writeGeometryWithOffset(g, all, offset, ox, oy);
      offset += g.buffer.length;
    } else {
      append(g.buffer);
    }
  }

  // Keep current stroke on top.
  if (liveGeo) append(liveGeo.buffer);

  return { vertices: all, pointCount: totalPoints };
}
