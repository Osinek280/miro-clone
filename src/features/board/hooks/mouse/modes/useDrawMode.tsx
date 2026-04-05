import { useLayoutEffect, useRef } from 'react';
import type { DrawObject, HistoryOperation, Point } from '../../../types/types';
import { roundPoint } from '../../../utils/cameraUtils';
import { useCanvasStore } from '../../../store/useCanvasStore';

export function useDrawMode(
  setCurrentPath: React.Dispatch<React.SetStateAction<Point[]>>,
  setObjects: React.Dispatch<React.SetStateAction<DrawObject[]>>,
  currentColor: string,
  currentSize: number,
  pushSyncedOperation: (op: HistoryOperation) => void,
) {
  const strokePathRef = useRef<Point[]>([]);

  useLayoutEffect(() => {
    useCanvasStore.getState().setInProgressStrokeRef(strokePathRef);
    return () => useCanvasStore.getState().setInProgressStrokeRef(null);
  }, []);

  const onMouseDown = (point: Point) => {
    strokePathRef.current = [point];
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

  const onMouseMove = (point: Point, shiftKey = false) => {
    const prev = strokePathRef.current;
    if (prev.length === 0) {
      strokePathRef.current = [point];
      useCanvasStore.getState().scheduleRedraw();
      return;
    }
    const last = prev[prev.length - 1];
    const dx = point.x - last.x;
    const dy = point.y - last.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (shiftKey) {
      const start = prev[0];
      const totalDx = point.x - start.x;
      const totalDy = point.y - start.y;
      const totalDist = Math.sqrt(totalDx * totalDx + totalDy * totalDy);

      if (totalDist === 0) {
        strokePathRef.current = [start];
        useCanvasStore.getState().scheduleRedraw();
        return;
      }

      const angle = Math.atan2(totalDy, totalDx);
      const snappedAngle = snapAngleOnlyWhenClose(angle);
      const endX = start.x + totalDist * Math.cos(snappedAngle);
      const endY = start.y + totalDist * Math.sin(snappedAngle);
      const snapDx = endX - start.x;
      const snapDy = endY - start.y;

      const step = 1.5;
      const steps = Math.max(1, Math.floor(totalDist / step));
      const linePoints: Point[] = [start];
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        linePoints.push(
          roundPoint({
            x: start.x + snapDx * t,
            y: start.y + snapDy * t,
          }),
        );
      }
      strokePathRef.current = linePoints;
      useCanvasStore.getState().scheduleRedraw();
      return;
    }

    const steps = Math.floor(distance / 0.25);
    if (steps > 0) {
      for (let i = 1; i <= steps; i++) {
        prev.push(
          roundPoint({
            x: last.x + (dx * i) / steps,
            y: last.y + (dy * i) / steps,
          }),
        );
      }
      useCanvasStore.getState().scheduleRedraw();
    }
  };

  const onMouseUp = () => {
    const path = strokePathRef.current;
    strokePathRef.current = [];
    if (path.length === 0) return;
    const object: DrawObject = {
      id: crypto.randomUUID(),
      type: 'PATH',
      points: path.map(roundPoint),
      color: currentColor,
      size: currentSize,
      tombstone: false,
      positionTimestamp: Date.now(),
    };
    pushSyncedOperation({
      opId: crypto.randomUUID(),
      timestamp: Date.now(),
      type: 'add',
      objects: [object],
    });

    setObjects((p) => [...p, object]);
    setCurrentPath([]);
  };

  return { onMouseDown, onMouseMove, onMouseUp };
}
