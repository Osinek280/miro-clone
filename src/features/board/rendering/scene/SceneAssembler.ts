import type {
  BoundsRect,
  DrawObject,
  ImageDrawObject,
  Point,
} from '../../types/types';
import { rotateImageSnapshot, rotatePathPointsInPlace } from '../../utils/rotateUtils';
import type { GeometryCache } from '../cache/GeometryCache';
import {
  buildStrokeGeometry,
  hexToRgba,
  FPV,
  writeGeometryWithBoundsRemap,
  writeGeometryWithOffset,
} from '../geometry/StrokeGeometry';
import {
  mapPointAcrossBounds,
  strokeScaleFactor,
} from '../../utils/scaleBoundsUtils';

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
  drawWidth: number;
  drawHeight: number;
  drawRotation: number;
};

export type SceneDrawPass = BrushDrawPass | ImageDrawPass;

function appendPathRunToPasses(
  pathRun: DrawObject[],
  cache: GeometryCache,
  resizeSet: Set<string> | null,
  dragSet: Set<string> | null,
  ox: number,
  oy: number,
  boundsRemap: { oldB: BoundsRect; newB: BoundsRect; sizeScale: number } | null,
  rotatePreview: {
    center: Point;
    delta: number;
    pathSnapshots: Record<string, Point[]>;
  } | null,
  passes: SceneDrawPass[],
): void {
  let totalPoints = 0;
  for (const obj of pathRun) {
    if (obj.type !== 'PATH') continue;
    if (rotatePreview?.pathSnapshots[obj.id]) {
      const pts = rotatePathPointsInPlace(
        rotatePreview.pathSnapshots[obj.id],
        rotatePreview.center,
        rotatePreview.delta,
      );
      const live = buildStrokeGeometry(
        pts,
        hexToRgba(obj.color || '#000'),
        obj.size || 15,
      );
      if (live) totalPoints += live.pointCount;
    } else {
      const g = cache.get(obj.id);
      if (g) totalPoints += g.pointCount;
    }
  }
  if (totalPoints === 0) return;

  const all = new Float32Array(totalPoints * FPV);
  let offset = 0;

  for (const obj of pathRun) {
    if (obj.type !== 'PATH') continue;
    const g = cache.get(obj.id);
    if (rotatePreview?.pathSnapshots[obj.id]) {
      const pts = rotatePathPointsInPlace(
        rotatePreview.pathSnapshots[obj.id],
        rotatePreview.center,
        rotatePreview.delta,
      );
      const live = buildStrokeGeometry(
        pts,
        hexToRgba(obj.color || '#000'),
        obj.size || 15,
      );
      if (live) {
        all.set(live.buffer, offset);
        offset += live.buffer.length;
      }
      continue;
    }
    if (!g) continue;
    if (boundsRemap && resizeSet?.has(obj.id)) {
      writeGeometryWithBoundsRemap(
        g,
        all,
        offset,
        boundsRemap.oldB,
        boundsRemap.newB,
        boundsRemap.sizeScale,
      );
      offset += g.buffer.length;
    } else if (dragSet?.has(obj.id)) {
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
  selectionResize: {
    selectedIds: readonly string[];
    oldBounds: BoundsRect;
    newBounds: BoundsRect;
  } | null;
  selectionRotate: {
    center: Point;
    deltaRadians: number;
    selectedIds: readonly string[];
    pathSnapshots: Record<string, Point[]>;
    imageSnapshots: Record<
      string,
      { x: number; y: number; width: number; height: number; rotation: number }
    >;
  } | null;
}): SceneDrawPass[] {
  const {
    objects,
    cache,
    currentPath,
    currentColor,
    currentSize,
    selectionDrag,
    selectionResize,
    selectionRotate,
  } = params;

  const rotatePreview =
    selectionRotate && selectionRotate.selectedIds.length > 0
      ? {
          center: selectionRotate.center,
          delta: selectionRotate.deltaRadians,
          pathSnapshots: selectionRotate.pathSnapshots,
        }
      : null;

  const resizeSet =
    !rotatePreview &&
    selectionResize &&
    selectionResize.selectedIds.length > 0
      ? new Set(selectionResize.selectedIds)
      : null;
  const boundsRemap =
    resizeSet && selectionResize
      ? {
          oldB: selectionResize.oldBounds,
          newB: selectionResize.newBounds,
          sizeScale: strokeScaleFactor(
            selectionResize.oldBounds,
            selectionResize.newBounds,
          ),
        }
      : null;

  const dragSet =
    !rotatePreview &&
    !boundsRemap &&
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
    appendPathRunToPasses(
      pathRun,
      cache,
      resizeSet,
      dragSet,
      ox,
      oy,
      boundsRemap,
      rotatePreview,
      passes,
    );
    pathRun = [];
  };

  for (const obj of objects) {
    if (obj.type === 'IMAGE') {
      flushPaths();
      let drawX = obj.x;
      let drawY = obj.y;
      let drawW = obj.width;
      let drawH = obj.height;
      let drawRotation = obj.rotation ?? 0;
      if (
        selectionRotate &&
        selectionRotate.imageSnapshots[obj.id] &&
        rotatePreview
      ) {
        const next = rotateImageSnapshot(
          selectionRotate.imageSnapshots[obj.id],
          selectionRotate.center,
          rotatePreview.delta,
        );
        drawX = next.x;
        drawY = next.y;
        drawRotation = next.rotation;
      } else if (resizeSet?.has(obj.id) && selectionResize) {
        const { oldBounds, newBounds } = selectionResize;
        const p = mapPointAcrossBounds(
          { x: obj.x, y: obj.y },
          oldBounds,
          newBounds,
        );
        drawX = p.x;
        drawY = p.y;
        const ow = oldBounds.maxX - oldBounds.minX;
        const oh = oldBounds.maxY - oldBounds.minY;
        const sx = ow > 1e-9 ? (newBounds.maxX - newBounds.minX) / ow : 1;
        const sy = oh > 1e-9 ? (newBounds.maxY - newBounds.minY) / oh : 1;
        drawW = obj.width * sx;
        drawH = obj.height * sy;
      } else {
        const dx = dragSet?.has(obj.id) ? ox : 0;
        const dy = dragSet?.has(obj.id) ? oy : 0;
        drawX = obj.x + dx;
        drawY = obj.y + dy;
      }
      passes.push({
        kind: 'image',
        obj,
        drawX,
        drawY,
        drawWidth: drawW,
        drawHeight: drawH,
        drawRotation,
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
