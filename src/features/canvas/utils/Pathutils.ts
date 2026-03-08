/**
 * Adaptive point sampling for smooth drawing input.
 *
 * Strategy:
 *  - Minimum distance threshold prevents micro-jitter points
 *  - Velocity-based angle threshold: fast strokes = fewer points needed,
 *    slow precise strokes = more detail captured
 *  - Result: smooth Catmull-Rom input without over-sampling
 */

import type { Point } from "../types/types";

const MIN_DISTANCE = 3; // px — ignore micro-jitter
const ANGLE_THRESHOLD = 0.08; // radians — capture direction changes
const MAX_DISTANCE = 20; // px — force a point for long gaps (coarse moves)

function buildStrokeMesh(
  points: Point[],
  halfWidth: number,
  feather: number = 0.5,
): { positions: Float32Array; alphas: Float32Array } {
  if (points.length < 2)
    return { positions: new Float32Array(0), alphas: new Float32Array(0) };

  // We'll emit 2 vertices per point (left + right side)
  const vCount = points.length * 2;
  const positions = new Float32Array(vCount * 2);
  const alphas = new Float32Array(vCount);

  // For each point compute the normal direction
  const normals: { nx: number; ny: number }[] = [];

  for (let i = 0; i < points.length; i++) {
    let nx = 0;
    let ny = 0;

    if (i === 0) {
      const dx = points[1].x - points[0].x;
      const dy = points[1].y - points[0].y;
      const len = Math.hypot(dx, dy) || 1;
      nx = -dy / len;
      ny = dx / len;
    } else if (i === points.length - 1) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      const len = Math.hypot(dx, dy) || 1;
      nx = -dy / len;
      ny = dx / len;
    } else {
      // Average of prev and next tangents (miter join)
      const dx1 = points[i].x - points[i - 1].x;
      const dy1 = points[i].y - points[i - 1].y;
      const len1 = Math.hypot(dx1, dy1) || 1;

      const dx2 = points[i + 1].x - points[i].x;
      const dy2 = points[i + 1].y - points[i].y;
      const len2 = Math.hypot(dx2, dy2) || 1;

      // Tangent normals
      const n1x = -dy1 / len1;
      const n1y = dx1 / len1;
      const n2x = -dy2 / len2;
      const n2y = dx2 / len2;

      // Average and normalize miter
      let mx = (n1x + n2x) / 2;
      let my = (n1y + n2y) / 2;
      const mlen = Math.hypot(mx, my) || 1;
      mx /= mlen;
      my /= mlen;

      // Miter length via dot product with original normal to avoid extreme spikes
      const dot = n1x * mx + n1y * my;
      const miterLen = Math.min(1.0 / (dot || 0.001), 4.0); // cap miter
      nx = mx * miterLen;
      ny = my * miterLen;
    }

    normals.push({ nx, ny });
  }

  // Fill vertex buffers: left side, right side
  for (let i = 0; i < points.length; i++) {
    const { nx, ny } = normals[i];
    const px = points[i].x;
    const py = points[i].y;

    // Left vertex (index i*2)
    positions[i * 2 * 2 + 0] = px + nx * halfWidth;
    positions[i * 2 * 2 + 1] = py + ny * halfWidth;
    alphas[i * 2] = feather; // outer edge — semi-transparent for AA

    // Right vertex (index i*2 + 1)
    positions[(i * 2 + 1) * 2 + 0] = px - nx * halfWidth;
    positions[(i * 2 + 1) * 2 + 1] = py - ny * halfWidth;
    alphas[i * 2 + 1] = feather;
  }

  return { positions, alphas };
}

export function buildSoftStrokeMesh(
  points: Point[],
  halfWidth: number,
): { positions: Float32Array; alphas: Float32Array } {
  const outerHalf = halfWidth;
  const innerHalf = halfWidth * 0.6;

  const outer = buildStrokeMesh(points, outerHalf, 0.0);
  const inner = buildStrokeMesh(points, innerHalf, 1.0);

  const totalPositions = outer.positions.length + inner.positions.length;
  const totalAlphas = outer.alphas.length + inner.alphas.length;

  const positions = new Float32Array(totalPositions);
  const alphas = new Float32Array(totalAlphas);

  positions.set(outer.positions, 0);
  positions.set(inner.positions, outer.positions.length);
  alphas.set(outer.alphas, 0);
  alphas.set(inner.alphas, outer.alphas.length);

  return { positions, alphas };
}

export function catmullRomSpline(points: Point[], segments = 12): Point[] {
  if (points.length < 2) return points;
  if (points.length === 2) {
    // Simple linear interpolation for just 2 points
    const result: Point[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      result.push({
        x: points[0].x + (points[1].x - points[0].x) * t,
        y: points[0].y + (points[1].y - points[0].y) * t,
      });
    }
    return result;
  }

  const out: Point[] = [];

  // Pad the array with phantom points at each end
  const pts = [
    { x: 2 * points[0].x - points[1].x, y: 2 * points[0].y - points[1].y },
    ...points,
    {
      x: 2 * points[points.length - 1].x - points[points.length - 2].x,
      y: 2 * points[points.length - 1].y - points[points.length - 2].y,
    },
  ];

  for (let i = 1; i < pts.length - 2; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2];

    for (let j = 0; j < segments; j++) {
      const t = j / segments;
      const t2 = t * t;
      const t3 = t2 * t;

      // Catmull-Rom formula (alpha = 0.5 centripetal variant simplified)
      const x =
        0.5 *
        (2 * p1.x +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);

      const y =
        0.5 *
        (2 * p1.y +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);

      out.push({ x, y });
    }
  }

  // Add the final point
  out.push(points[points.length - 1]);
  return out;
}

export function updatePath(prev: Point[], point: Point): Point[] {
  if (prev.length === 0) return [point];

  const last = prev[prev.length - 1];
  const dx = point.x - last.x;
  const dy = point.y - last.y;
  const distance = Math.hypot(dx, dy);

  // Skip if too close — removes jitter
  if (distance < MIN_DISTANCE) return prev;

  // Always add if far enough to prevent gaps in fast strokes
  if (distance >= MAX_DISTANCE) {
    return [...prev, point];
  }

  // Check angle change relative to previous segment — add point only if
  // direction changes meaningfully (captures curves, ignores straight drag)
  if (prev.length >= 2) {
    const prev2 = prev[prev.length - 2];
    const prevDx = last.x - prev2.x;
    const prevDy = last.y - prev2.y;
    const prevLen = Math.hypot(prevDx, prevDy) || 1;

    // Dot product of normalized vectors
    const dot =
      (dx / distance) * (prevDx / prevLen) +
      (dy / distance) * (prevDy / prevLen);
    const angle = Math.acos(Math.max(-1, Math.min(1, dot)));

    if (angle < ANGLE_THRESHOLD) {
      // Nearly straight — skip to let Catmull-Rom handle the interpolation
      return prev;
    }
  }

  return [...prev, point];
}

/**
 * Ramer-Douglas-Peucker simplification.
 * Run on pointerup to clean up the final path before storing.
 * epsilon: max allowed deviation in pixels (2-3px works well)
 */
export function simplifyPath(points: Point[], epsilon = 2.0): Point[] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let maxIdx = 0;

  const start = points[0];
  const end = points[points.length - 1];
  const lineLen = Math.hypot(end.x - start.x, end.y - start.y);

  for (let i = 1; i < points.length - 1; i++) {
    const dist = pointToLineDistance(points[i], start, end, lineLen);
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  if (maxDist > epsilon) {
    const left = simplifyPath(points.slice(0, maxIdx + 1), epsilon);
    const right = simplifyPath(points.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  }

  return [start, end];
}

function pointToLineDistance(
  p: Point,
  a: Point,
  b: Point,
  lineLen: number,
): number {
  if (lineLen === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  return (
    Math.abs((b.y - a.y) * p.x - (b.x - a.x) * p.y + b.x * a.y - b.y * a.x) /
    lineLen
  );
}
