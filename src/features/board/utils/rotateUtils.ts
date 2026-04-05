import { POINT_SCALE } from '../constants/pointPrecision';
import type {
  BoundsRect,
  DrawObject,
  ImageDrawObject,
  Point,
  SelectionBox,
} from '../types/types';
import { calcBoundingBox } from './objectUtils';
import { roundPoint } from './cameraUtils';

function roundScalar(v: number): number {
  return Math.round(v * POINT_SCALE) / POINT_SCALE;
}

/**
 * Signed angle from `prev`→`curr` around `center` (one step). Returns 0 when either
 * radius is below `minRadiusWorld` so passing the cursor through the pivot does not
 * explode atan2 / flip the angle.
 */
export function rotationDeltaFromPointers(
  center: Point,
  prev: Point,
  curr: Point,
  minRadiusWorld: number,
): number {
  const r0x = prev.x - center.x;
  const r0y = prev.y - center.y;
  const r1x = curr.x - center.x;
  const r1y = curr.y - center.y;
  const len0 = Math.hypot(r0x, r0y);
  const len1 = Math.hypot(r1x, r1y);
  const minR = Math.max(1e-9, minRadiusWorld);
  if (len0 < minR || len1 < minR) return 0;
  return angleDelta(Math.atan2(r1y, r1x), Math.atan2(r0y, r0x));
}

/** Smallest signed difference between two angles (radians). */
export function angleDelta(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

const CARDINAL_ROTATION_STEP = Math.PI / 2;

/**
 * When `radians` is within `toleranceRad` of a multiple of 90°, snap to that cardinal.
 */
export function snapRotationToCardinals(
  radians: number,
  toleranceRad: number,
): number {
  const k = Math.round(radians / CARDINAL_ROTATION_STEP);
  const snapped = k * CARDINAL_ROTATION_STEP;
  return Math.abs(radians - snapped) <= toleranceRad ? snapped : radians;
}

/**
 * Cardinal snap with hysteresis: enter within `enterTol`, leave only beyond `exitTol`
 * (exit > enter avoids flicker and stiff toggling at the boundary).
 */
export function rotateSnapWithHysteresis(
  rawAccumulated: number,
  lockedK: number | null,
  enterTol: number,
  exitTol: number,
): { displayRadians: number; rawAfter: number; lockedK: number | null } {
  const step = CARDINAL_ROTATION_STEP;
  let k = lockedK;
  const raw = rawAccumulated;

  if (k !== null) {
    const lockedAngle = k * step;
    if (Math.abs(raw - lockedAngle) > exitTol) {
      k = null;
    }
  }

  if (k !== null) {
    return { displayRadians: k * step, rawAfter: raw, lockedK: k };
  }

  const nearestK = Math.round(raw / step);
  const snapped = nearestK * step;
  if (Math.abs(raw - snapped) <= enterTol) {
    return { displayRadians: snapped, rawAfter: snapped, lockedK: nearestK };
  }

  return { displayRadians: raw, rawAfter: raw, lockedK: null };
}

/** Corners in order: nw, ne, se, sw (same winding as selection `drawRect`). */
export function cornersOfAxisBounds(
  b: BoundsRect,
): [Point, Point, Point, Point] {
  return [
    { x: b.minX, y: b.minY },
    { x: b.maxX, y: b.minY },
    { x: b.maxX, y: b.maxY },
    { x: b.minX, y: b.maxY },
  ];
}

/** Rotate a rigid rectangle (four corners) around `center` by `deltaRadians`. */
export function rotateOutlineCorners(
  corners: readonly [Point, Point, Point, Point],
  center: Point,
  deltaRadians: number,
): [Point, Point, Point, Point] {
  const r = (p: Point) => rotatePointAround(p, center, deltaRadians);
  return [r(corners[0]), r(corners[1]), r(corners[2]), r(corners[3])];
}

export function offsetSelectionQuad(
  quad: readonly [Point, Point, Point, Point],
  dx: number,
  dy: number,
): [Point, Point, Point, Point] {
  return [
    { x: quad[0].x + dx, y: quad[0].y + dy },
    { x: quad[1].x + dx, y: quad[1].y + dy },
    { x: quad[2].x + dx, y: quad[2].y + dy },
    { x: quad[3].x + dx, y: quad[3].y + dy },
  ];
}

export function rotatePointAround(
  p: Point,
  center: Point,
  radians: number,
): Point {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  return {
    x: center.x + c * dx - s * dy,
    y: center.y + s * dx + c * dy,
  };
}

export function rotatePathPointsInPlace(
  points: Point[],
  center: Point,
  radians: number,
): Point[] {
  return points.map((p) => roundPoint(rotatePointAround(p, center, radians)));
}

export function rotateImageSnapshot(
  snap: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
  },
  center: Point,
  deltaRadians: number,
): { x: number; y: number; rotation: number } {
  const w = snap.width;
  const h = snap.height;
  const oldCx = snap.x + w / 2;
  const oldCy = snap.y + h / 2;
  const moved = rotatePointAround({ x: oldCx, y: oldCy }, center, deltaRadians);
  return {
    x: roundScalar(moved.x - w / 2),
    y: roundScalar(moved.y - h / 2),
    rotation: snap.rotation + deltaRadians,
  };
}

/** Axis-aligned bounds of the selection after applying a live rotate preview. */
export function computeRotatedSelectionBox(
  objects: DrawObject[],
  ids: readonly string[],
  center: Point,
  deltaRadians: number,
  pathSnapshots: Record<string, Point[]>,
  imageSnapshots: Record<
    string,
    { x: number; y: number; width: number; height: number; rotation: number }
  >,
): SelectionBox | null {
  const idSet = new Set(ids);
  const temp: DrawObject[] = [];
  for (const o of objects) {
    if (!idSet.has(o.id)) continue;
    if (o.type === 'PATH' && pathSnapshots[o.id]) {
      temp.push({
        ...o,
        points: rotatePathPointsInPlace(
          pathSnapshots[o.id],
          center,
          deltaRadians,
        ),
      });
    } else if (o.type === 'IMAGE' && imageSnapshots[o.id]) {
      const n = rotateImageSnapshot(imageSnapshots[o.id], center, deltaRadians);
      const im: ImageDrawObject = {
        ...o,
        x: n.x,
        y: n.y,
        rotation: n.rotation,
      };
      temp.push(im);
    }
  }
  return temp.length > 0 ? calcBoundingBox(temp) : null;
}

export function applyRotateDeltaToObjects(
  objects: DrawObject[],
  ids: readonly string[],
  center: Point,
  deltaRadians: number,
  opTs: number,
): DrawObject[] {
  const idSet = new Set(ids);
  return objects.map((obj) => {
    if (!idSet.has(obj.id)) return obj;
    const objTs = obj.positionTimestamp ?? 0;
    if (opTs < objTs) return obj;

    if (obj.type === 'PATH') {
      return {
        ...obj,
        points: rotatePathPointsInPlace(obj.points, center, deltaRadians),
        positionTimestamp: opTs,
      };
    }

    const next = rotateImageSnapshot(
      {
        x: obj.x,
        y: obj.y,
        width: obj.width,
        height: obj.height,
        rotation: obj.rotation ?? 0,
      },
      center,
      deltaRadians,
    );
    const o: ImageDrawObject = {
      ...obj,
      x: next.x,
      y: next.y,
      rotation: next.rotation,
      positionTimestamp: opTs,
    };
    return o;
  });
}
