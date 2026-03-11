import { type DrawObject, type Point } from '../../types/types';

export function useDrawMode(
  setCurrentPath: React.Dispatch<React.SetStateAction<Point[]>>,
  setObjects: React.Dispatch<React.SetStateAction<DrawObject[]>>,
  currentColor: string,
  currentSize: number
) {
  const onMouseDown = (point: Point) => {
    return [point]; // initial path
  };

  const onMouseMove = (point: Point, prev: Point[]): Point[] => {
    if (prev.length === 0) return [point];
    const last = prev[prev.length - 1];
    const dx = point.x - last.x;
    const dy = point.y - last.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
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
    setObjects((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        type: 'path',
        points: path,
        color: currentColor,
        size: currentSize,
        selected: false,
      },
    ]);
    setCurrentPath([]);
  };

  return { onMouseDown, onMouseMove, onMouseUp };
}
