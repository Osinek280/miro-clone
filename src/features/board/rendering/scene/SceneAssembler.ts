import type { DrawObject, ImageDrawObject, Point } from '../../types/types';
import type { GeometryCache } from '../cache/GeometryCache';
import {
  buildStrokeGeometry,
  hexToRgba,
  FPV,
  writeGeometryWithOffset,
} from '../geometry/StrokeGeometry';

export type BrushDrawPass = {
  kind: 'brush';
  vertices: Float32Array;
  pointCount: number;
};

export type ImageDrawPass = {
  kind: 'image';
  obj: ImageDrawObject;
  drawX: number;
  drawY: number;
};

export type SceneDrawPass = BrushDrawPass | ImageDrawPass;

function appendPathRunToPasses(
  pathRun: DrawObject[],
  cache: GeometryCache,
  dragSet: Set<string> | null,
  ox: number,
  oy: number,
  passes: SceneDrawPass[],
): void {
  let totalPoints = 0;
  for (const obj of pathRun) {
    if (obj.type !== 'path') continue;
    const g = cache.get(obj.id);
    if (g) totalPoints += g.pointCount;
  }
  if (totalPoints === 0) return;

  const all = new Float32Array(totalPoints * FPV);
  let offset = 0;

  for (const obj of pathRun) {
    if (obj.type !== 'path') continue;
    const g = cache.get(obj.id);
    if (!g) continue;
    if (dragSet?.has(obj.id)) {
      writeGeometryWithOffset(g, all, offset, ox, oy);
      offset += g.buffer.length;
    } else {
      all.set(g.buffer, offset);
      offset += g.buffer.length;
    }
  }

  passes.push({ kind: 'brush', vertices: all, pointCount: totalPoints });
}

/**
 * Ordered draw passes so Z-order matches `objects`: path batches and images interleaved.
 * Live stroke is always the last brush pass.
 */
export function buildSceneDrawPasses(params: {
  objects: DrawObject[];
  cache: GeometryCache;
  currentPath: Point[];
  currentColor: string;
  currentSize: number;
  selectionDrag: { offset: Point; selectedIds: readonly string[] } | null;
}): SceneDrawPass[] {
  const {
    objects,
    cache,
    currentPath,
    currentColor,
    currentSize,
    selectionDrag,
  } = params;

  const dragSet =
    selectionDrag &&
    selectionDrag.selectedIds.length > 0 &&
    (selectionDrag.offset.x !== 0 || selectionDrag.offset.y !== 0)
      ? new Set(selectionDrag.selectedIds)
      : null;
  const ox = selectionDrag?.offset.x ?? 0;
  const oy = selectionDrag?.offset.y ?? 0;

  const passes: SceneDrawPass[] = [];
  let pathRun: DrawObject[] = [];

  const flushPaths = () => {
    appendPathRunToPasses(pathRun, cache, dragSet, ox, oy, passes);
    pathRun = [];
  };

  for (const obj of objects) {
    if (obj.type === 'image') {
      flushPaths();
      const dx = dragSet?.has(obj.id) ? ox : 0;
      const dy = dragSet?.has(obj.id) ? oy : 0;
      passes.push({
        kind: 'image',
        obj,
        drawX: obj.x + dx,
        drawY: obj.y + dy,
      });
    } else {
      pathRun.push(obj);
    }
  }
  flushPaths();

  if (currentPath.length > 0) {
    const liveGeo = buildStrokeGeometry(
      currentPath,
      hexToRgba(currentColor),
      currentSize,
    );
    if (liveGeo) {
      passes.push({
        kind: 'brush',
        vertices: liveGeo.buffer,
        pointCount: liveGeo.pointCount,
      });
    }
  }

  return passes;
}
