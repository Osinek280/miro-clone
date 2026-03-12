import { useRef, useState } from 'react';
import type { Camera, DrawObject, Point, SelectionBox } from '../../types/types';
import { findObjectAtPoint } from '../../utils/objectUtils';
import { calcBoundingBox } from '../../utils/objectUtils';

export function useSelectMode(
  cameraRef: React.RefObject<Camera>,
  objects: DrawObject[],
  setObjects: React.Dispatch<React.SetStateAction<DrawObject[]>>,
  selectionBox: SelectionBox,
  setSelectionBox: React.Dispatch<React.SetStateAction<SelectionBox>>,
  selectedBoundingBox: SelectionBox,
  setSelectedBoundingBox: React.Dispatch<React.SetStateAction<SelectionBox>>
) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isMoving, setIsMoving] = useState(false);
  const lastMousePosRef = useRef<Point>({ x: 0, y: 0 });

  const clearSelection = () => {
    setSelectedIds([]);
    setSelectionBox(null);
    setSelectedBoundingBox(null);
  };

  const onMouseDown = (point: Point) => {
    const obj = findObjectAtPoint(point, objects, cameraRef.current.zoom);
    if (obj) {
      if (selectedIds.includes(obj.id)) {
        setIsMoving(true);
      } else {
        setSelectedIds([obj.id]);
        setSelectedBoundingBox(calcBoundingBox([obj]));
        setIsMoving(true);
      }
      lastMousePosRef.current = point;
    } else {
      setSelectionBox({ start: point, end: point });
      setSelectedIds([]);
      setSelectedBoundingBox(null);
    }
  };

  const onMouseMove = (point: Point) => {
    if (selectionBox) {
      setSelectionBox({ ...selectionBox, end: point });
    } else if (isMoving) {
      const dx = point.x - lastMousePosRef.current.x;
      const dy = point.y - lastMousePosRef.current.y;
      setObjects((prev) =>
        prev.map((o) =>
          selectedIds.includes(o.id)
            ? {
              ...o,
              points: o.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
            }
            : o
        )
      );
      setSelectedBoundingBox((prev) =>
        prev
          ? {
            start: { x: prev.start.x + dx, y: prev.start.y + dy },
            end: { x: prev.end.x + dx, y: prev.end.y + dy },
          }
          : null
      );
      lastMousePosRef.current = point;
    }
  };

  const onMouseUp = () => {
    if (selectionBox) {
      const { start, end } = selectionBox;
      const minX = Math.min(start.x, end.x);
      const maxX = Math.max(start.x, end.x);
      const minY = Math.min(start.y, end.y);
      const maxY = Math.max(start.y, end.y);
      const selected = objects.filter((obj) =>
        obj.points.some(
          (p) => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY
        )
      );
      setSelectedIds(selected.map((o) => o.id));
      setSelectedBoundingBox(
        selected.length > 0 ? calcBoundingBox(selected) : null
      );
      setSelectionBox(null);
    }
    setIsMoving(false);
  };

  return {
    selectedIds,
    setSelectedIds,
    clearSelection,
    selectionBox,
    selectedBoundingBox,
    isMoving,
    onMouseDown,
    onMouseMove,
    onMouseUp,
  };
}
