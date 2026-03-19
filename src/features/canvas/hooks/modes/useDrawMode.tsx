import type { Client } from '@stomp/stompjs';
import { type DrawObject, type Point } from '../../types/types';
import { useHistoryStore } from '../useHistoryStore';

export function useDrawMode(
  setCurrentPath: React.Dispatch<React.SetStateAction<Point[]>>,
  setObjects: React.Dispatch<React.SetStateAction<DrawObject[]>>,
  currentColor: string,
  currentSize: number,
  stompClientRef: React.RefObject<Client | null>,
) {
  const { pushOperation } = useHistoryStore.getState();

  const onMouseDown = (point: Point) => {
    return [point]; // initial path
  };

  /** Threshold in radians – snap only when the angle is very close to a target value (~10°) */
  const SNAP_THRESHOLD_RAD = (2 * Math.PI) / 180;

  /** Angular distance in the range [-π, π] */
  const angleDist = (a: number, b: number): number => {
    let d = a - b;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return Math.abs(d);
  };

  /** Snaps to 0° / 45° / 90° / … only when the angle is within SNAP_THRESHOLD of that value */
  const snapAngleOnlyWhenClose = (angleRad: number): number => {
    const targets = [
      0,
      Math.PI / 4,
      Math.PI / 2,
      (3 * Math.PI) / 4,
      Math.PI,
      -Math.PI / 4,
      -Math.PI / 2,
      (-3 * Math.PI) / 4,
    ];
    let bestTarget = angleRad;
    let bestDist = Infinity;
    for (const t of targets) {
      const d = angleDist(angleRad, t);
      if (d < bestDist) {
        bestDist = d;
        bestTarget = t;
      }
    }
    return bestDist <= SNAP_THRESHOLD_RAD ? bestTarget : angleRad;
  };

  const onMouseMove = (
    point: Point,
    prev: Point[],
    shiftKey = false,
  ): Point[] => {
    if (prev.length === 0) return [point];
    const last = prev[prev.length - 1];
    const dx = point.x - last.x;
    const dy = point.y - last.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (shiftKey) {
      const start = prev[0];
      const totalDx = point.x - start.x;
      const totalDy = point.y - start.y;
      const totalDist = Math.sqrt(totalDx * totalDx + totalDy * totalDy);

      if (totalDist === 0) return [start];

      const angle = Math.atan2(totalDy, totalDx);
      const snappedAngle = snapAngleOnlyWhenClose(angle);
      const endX = start.x + totalDist * Math.cos(snappedAngle);
      const endY = start.y + totalDist * Math.sin(snappedAngle);
      const snapDx = endX - start.x;
      const snapDy = endY - start.y;

      const step = 0.25;
      const steps = Math.max(1, Math.floor(totalDist / step));
      const linePoints: Point[] = [start];
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        linePoints.push({ x: start.x + snapDx * t, y: start.y + snapDy * t });
      }
      return linePoints;
    }

    const steps = Math.floor(distance / 0.25);
    const newPoints: Point[] = [];
    for (let i = 1; i <= steps; i++) {
      newPoints.push({
        x: last.x + (dx * i) / steps,
        y: last.y + (dy * i) / steps,
      });
    }
    return [...prev, ...newPoints];
  };

  const onMouseUp = (path: Point[]) => {
    if (path.length === 0) return;
    const object: DrawObject = {
      id: crypto.randomUUID(),
      type: 'path',
      points: path,
      color: currentColor,
      size: currentSize,
      tombstone: false,
      positionTimestamp: Date.now(),
    };
    pushOperation({ type: 'add', objects: [object] });
    const client = stompClientRef.current;

    console.log('points length', object.points.length);
    console.log(JSON.stringify(object).length, 'bytes');

    if (client?.connected) {
      console.log('sending draw message');
      client.publish({
        destination: '/app/draw',
        body: JSON.stringify({ type: 'add', object }),
      });
    }
    setObjects((prev) => [...prev, object]);
    setCurrentPath([]);
  };

  return { onMouseDown, onMouseMove, onMouseUp };
}
