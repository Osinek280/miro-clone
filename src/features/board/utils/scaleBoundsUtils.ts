import { POINT_SCALE } from '../constants/pointPrecision';
import type {
  BoundsRect,
  BoxEdge,
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
 * Hit-test which edge of the selection box is under the pointer (world space).
 * Corner overlap picks the edge with the smaller perpendicular distance.
 */
export function hitTestBoxEdge(
  point: Point,
  box: SelectionBox,
  zoom: number,
): BoxEdge | null {
  if (!box) return null;
  const slop = 8 / zoom;
  const minX = Math.min(box.start.x, box.end.x);
  const maxX = Math.max(box.start.x, box.end.x);
  const minY = Math.min(box.start.y, box.end.y);
  const maxY = Math.max(box.start.y, box.end.y);

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

/** New bounds after dragging one edge toward `pointer` (opposite edge fixed). */
export function computeResizedBounds(
  edge: BoxEdge,
  initial: BoundsRect,
  pointer: Point,
  zoom: number,
): BoundsRect {
  const minSpan = Math.max(1e-3, 8 / zoom);
  let { minX, maxX, minY, maxY } = initial;

  switch (edge) {
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
    default:
      break;
  }

  return { minX, minY, maxX, maxY };
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
