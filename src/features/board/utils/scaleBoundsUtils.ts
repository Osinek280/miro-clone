import { POINT_SCALE } from '../constants/pointPrecision';
import type {
  BoundsRect,
  BoxEdge,
  BoxResizeHandle,
  DrawObject,
  Point,
  SelectionBox,
} from '../types/types';

export function selectionBoxToBounds(
  box: NonNullable<SelectionBox>,
): BoundsRect {
  return {
    minX: Math.min(box.start.x, box.end.x),
    minY: Math.min(box.start.y, box.end.y),
    maxX: Math.max(box.start.x, box.end.x),
    maxY: Math.max(box.start.y, box.end.y),
  };
}

export function boundsToSelectionBox(b: BoundsRect): SelectionBox {
  return {
    start: { x: b.minX, y: b.minY },
    end: { x: b.maxX, y: b.maxY },
  };
}

function roundScalar(v: number): number {
  return Math.round(v * POINT_SCALE) / POINT_SCALE;
}

/** Map a point from old axis-aligned bounds into new bounds (linear per axis). */
export function mapPointAcrossBounds(
  p: Point,
  oldB: BoundsRect,
  newB: BoundsRect,
): Point {
  const ow = oldB.maxX - oldB.minX;
  const oh = oldB.maxY - oldB.minY;
  const sx = ow > 1e-9 ? (newB.maxX - newB.minX) / ow : 1;
  const sy = oh > 1e-9 ? (newB.maxY - newB.minY) / oh : 1;
  return {
    x: newB.minX + (p.x - oldB.minX) * sx,
    y: newB.minY + (p.y - oldB.minY) * sy,
  };
}

/** Max relative stroke change per axis; avoids explosion when bbox is very flat. */
const STROKE_RATIO_MIN = 1 / 32;
const STROKE_RATIO_MAX = 32;

function clampedAxisStrokeRatio(oldSpan: number, newSpan: number): number {
  if (oldSpan <= 1e-9) return 1;
  const r = newSpan / oldSpan;
  return Math.min(STROKE_RATIO_MAX, Math.max(STROKE_RATIO_MIN, r));
}

/**
 * Isotropic-ish stroke scale: geometric mean of per-axis ratios (each axis clamped).
 * Using max(sx, sy) made strokes explode when one dimension of the selection was tiny.
 */
export function strokeScaleFactor(oldB: BoundsRect, newB: BoundsRect): number {
  const ow = oldB.maxX - oldB.minX;
  const oh = oldB.maxY - oldB.minY;
  const nw = newB.maxX - newB.minX;
  const nh = newB.maxY - newB.minY;
  const sx = clampedAxisStrokeRatio(ow, nw);
  const sy = clampedAxisStrokeRatio(oh, nh);
  return Math.sqrt(sx * sy);
}

export function boundsChanged(a: BoundsRect, b: BoundsRect): boolean {
  return (
    Math.abs(a.minX - b.minX) > 1e-6 ||
    Math.abs(a.minY - b.minY) > 1e-6 ||
    Math.abs(a.maxX - b.maxX) > 1e-6 ||
    Math.abs(a.maxY - b.maxY) > 1e-6
  );
}

/**
 * CSS cursor for a resize handle (edges + corners).
 */
export function resizeHandleCursor(handle: BoxResizeHandle): string {
  switch (handle) {
    case 'n':
    case 's':
      return 'ns-resize';
    case 'e':
    case 'w':
      return 'ew-resize';
    case 'nw':
    case 'se':
      return 'nwse-resize';
    case 'ne':
    case 'sw':
      return 'nesw-resize';
    default:
      return 'default';
  }
}

/**
 * Hit-test resize handle: corners first (two-axis), then edges (one-axis).
 */
export function hitTestBoxResizeHandle(
  point: Point,
  box: SelectionBox,
  zoom: number,
): BoxResizeHandle | null {
  if (!box) return null;
  const slop = 8 / zoom;
  const minX = Math.min(box.start.x, box.end.x);
  const maxX = Math.max(box.start.x, box.end.x);
  const minY = Math.min(box.start.y, box.end.y);
  const maxY = Math.max(box.start.y, box.end.y);

  if (Math.abs(point.x - minX) <= slop && Math.abs(point.y - minY) <= slop)
    return 'nw';
  if (Math.abs(point.x - maxX) <= slop && Math.abs(point.y - minY) <= slop)
    return 'ne';
  if (Math.abs(point.x - minX) <= slop && Math.abs(point.y - maxY) <= slop)
    return 'sw';
  if (Math.abs(point.x - maxX) <= slop && Math.abs(point.y - maxY) <= slop)
    return 'se';

  const nearN =
    point.x >= minX - slop &&
    point.x <= maxX + slop &&
    point.y >= minY - slop &&
    point.y <= minY + slop;
  const nearS =
    point.x >= minX - slop &&
    point.x <= maxX + slop &&
    point.y >= maxY - slop &&
    point.y <= maxY + slop;
  const nearW =
    point.x >= minX - slop &&
    point.x <= minX + slop &&
    point.y >= minY - slop &&
    point.y <= maxY + slop;
  const nearE =
    point.x >= maxX - slop &&
    point.x <= maxX + slop &&
    point.y >= minY - slop &&
    point.y <= maxY + slop;

  type Cand = { edge: BoxEdge; d: number };
  const cands: Cand[] = [];
  if (nearN) cands.push({ edge: 'n', d: Math.abs(point.y - minY) });
  if (nearS) cands.push({ edge: 's', d: Math.abs(point.y - maxY) });
  if (nearW) cands.push({ edge: 'w', d: Math.abs(point.x - minX) });
  if (nearE) cands.push({ edge: 'e', d: Math.abs(point.x - maxX) });
  if (cands.length === 0) return null;
  cands.sort((u, v) => u.d - v.d);
  return cands[0].edge;
}

/**
 * Axis-aligned resize (one or two edges without fixed aspect ratio).
 */
function computeResizedBoundsFree(
  handle: BoxResizeHandle,
  initial: BoundsRect,
  pointer: Point,
  zoom: number,
): BoundsRect {
  const minSpan = Math.max(1e-3, 8 / zoom);
  let { minX, maxX, minY, maxY } = initial;

  switch (handle) {
    case 'e':
      maxX = Math.max(minX + minSpan, pointer.x);
      break;
    case 'w':
      minX = Math.min(maxX - minSpan, pointer.x);
      break;
    case 's':
      maxY = Math.max(minY + minSpan, pointer.y);
      break;
    case 'n':
      minY = Math.min(maxY - minSpan, pointer.y);
      break;
    case 'se':
      maxX = Math.max(minX + minSpan, pointer.x);
      maxY = Math.max(minY + minSpan, pointer.y);
      break;
    case 'nw':
      minX = Math.min(maxX - minSpan, pointer.x);
      minY = Math.min(maxY - minSpan, pointer.y);
      break;
    case 'ne':
      maxX = Math.max(minX + minSpan, pointer.x);
      minY = Math.min(maxY - minSpan, pointer.y);
      break;
    case 'sw':
      minX = Math.min(maxX - minSpan, pointer.x);
      maxY = Math.max(minY + minSpan, pointer.y);
      break;
    default:
      break;
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Proportional resize: same scale factor on width and height from the fixed anchor
 * (opposite corner / edge side). Shift-drag uses this.
 */
function computeResizedBoundsUniform(
  handle: BoxResizeHandle,
  initial: BoundsRect,
  pointer: Point,
  zoom: number,
): BoundsRect {
  const minSpan = Math.max(1e-3, 8 / zoom);
  const { minX, maxX, minY, maxY } = initial;
  const oldW = maxX - minX;
  const oldH = maxY - minY;

  if (oldW <= 1e-9 || oldH <= 1e-9) {
    return computeResizedBoundsFree(handle, initial, pointer, zoom);
  }

  const minS = Math.max(minSpan / oldW, minSpan / oldH);

  /** Scale along diagonal from anchor: projects pointer onto the fixed-aspect ray (corner stays near cursor). */
  const cornerS = (dx: number, dy: number, vx: number, vy: number): number => {
    const d = vx * vx + vy * vy;
    if (d <= 1e-18) return minS;
    let t = (dx * vx + dy * vy) / d;
    if (t < minS) t = minS;
    return t;
  };

  let s = 1;
  switch (handle) {
    case 'e':
      s = Math.max(minSpan / oldW, (pointer.x - minX) / oldW);
      break;
    case 'w':
      s = Math.max(minSpan / oldW, (maxX - pointer.x) / oldW);
      break;
    case 's':
      s = Math.max(minSpan / oldH, (pointer.y - minY) / oldH);
      break;
    case 'n':
      s = Math.max(minSpan / oldH, (maxY - pointer.y) / oldH);
      break;
    case 'se':
      s = cornerS(pointer.x - minX, pointer.y - minY, oldW, oldH);
      break;
    case 'nw':
      s = cornerS(pointer.x - maxX, pointer.y - maxY, -oldW, -oldH);
      break;
    case 'ne':
      s = cornerS(pointer.x - minX, pointer.y - maxY, oldW, -oldH);
      break;
    case 'sw':
      s = cornerS(pointer.x - maxX, pointer.y - minY, -oldW, oldH);
      break;
    default:
      return initial;
  }

  const newW = oldW * s;
  const newH = oldH * s;

  switch (handle) {
    case 'e':
    case 's':
    case 'se':
      return { minX, minY, maxX: minX + newW, maxY: minY + newH };
    case 'w':
      return { minX: maxX - newW, minY, maxX, maxY: minY + newH };
    case 'n':
      return { minX, minY: maxY - newH, maxX: minX + newW, maxY };
    case 'nw':
      return { minX: maxX - newW, minY: maxY - newH, maxX, maxY };
    case 'ne':
      return { minX, minY: maxY - newH, maxX: minX + newW, maxY };
    case 'sw':
      return { minX: maxX - newW, minY, maxX, maxY: minY + newH };
    default:
      return { minX, minY, maxX: minX + newW, maxY: minY + newH };
  }
}

/**
 * New bounds after dragging a handle: opposite edge(s) fixed; `minSpan` enforced.
 * With `uniform`, width and height scale by the same factor (Shift).
 */
export function computeResizedBounds(
  handle: BoxResizeHandle,
  initial: BoundsRect,
  pointer: Point,
  zoom: number,
  uniform = false,
): BoundsRect {
  if (uniform) {
    return computeResizedBoundsUniform(handle, initial, pointer, zoom);
  }
  return computeResizedBoundsFree(handle, initial, pointer, zoom);
}

/** Apply bounds remap to one object if its id is selected (used after commit). */
export function mapDrawObjectWithBounds(
  obj: DrawObject,
  idSet: Set<string>,
  oldB: BoundsRect,
  newB: BoundsRect,
  opTs: number,
): DrawObject {
  if (!idSet.has(obj.id)) return obj;
  const objTs = obj.positionTimestamp ?? 0;
  if (opTs < objTs) return obj;

  const sizeScale = strokeScaleFactor(oldB, newB);

  if (obj.type === 'PATH') {
    const pts = obj.points.map((p) => {
      const m = mapPointAcrossBounds(p, oldB, newB);
      return { x: roundScalar(m.x), y: roundScalar(m.y) };
    });
    return {
      ...obj,
      points: pts,
      size: Math.max(0.25, roundScalar(obj.size * sizeScale)),
      positionTimestamp: opTs,
    };
  }

  const corner = mapPointAcrossBounds({ x: obj.x, y: obj.y }, oldB, newB);
  const ow = oldB.maxX - oldB.minX;
  const oh = oldB.maxY - oldB.minY;
  const sx = ow > 1e-9 ? (newB.maxX - newB.minX) / ow : 1;
  const sy = oh > 1e-9 ? (newB.maxY - newB.minY) / oh : 1;

  return {
    ...obj,
    x: roundScalar(corner.x),
    y: roundScalar(corner.y),
    width: Math.max(1e-3, roundScalar(obj.width * sx)),
    height: Math.max(1e-3, roundScalar(obj.height * sy)),
    positionTimestamp: opTs,
  };
}
