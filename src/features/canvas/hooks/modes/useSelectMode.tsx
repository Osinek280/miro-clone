import { useRef } from 'react';
import type { Camera, Point } from '../../types/types';
import { findObjectAtPoint } from '../../utils/objectUtils';
import { calcBoundingBox } from '../../utils/objectUtils';
import { useHistoryStore } from '../useHistoryStore';
import { useCanvasStore } from '../useCanvasStore';

export function useSelectMode(cameraRef: React.RefObject<Camera>) {
  const {
    objects,
    setObjects,
    selectionBox,
    setSelectionBox,
    selectedBoundingBox,
    setSelectedBoundingBox,
    selectedIds,
    setSelectedIds,
    isMoving,
    setIsMoving,
    clearSelection,
  } = useCanvasStore();

  const { pushOperation } = useHistoryStore.getState();
  const lastMousePosRef = useRef<Point>({ x: 0, y: 0 });
  const dragStartRef = useRef<Point>({ x: 0, y: 0 });

  const onMouseDown = (point: Point) => {
    const obj = findObjectAtPoint(point, objects, cameraRef.current.zoom);
    if (obj) {
      dragStartRef.current = point;
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
    const state = useCanvasStore.getState();
    const currentSelectionBox = state.selectionBox;
    const currentIsMoving = state.isMoving;
    const currentSelectedIds = state.selectedIds;

    if (currentSelectionBox) {
      setSelectionBox({ ...currentSelectionBox, end: point });
    } else if (currentIsMoving) {
      const dx = point.x - lastMousePosRef.current.x;
      const dy = point.y - lastMousePosRef.current.y;
      setObjects((prev) =>
        prev.map((o) =>
          currentSelectedIds.includes(o.id)
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
    } else if (isMoving && selectedIds.length > 0) {
      const start = dragStartRef.current;
      const end = lastMousePosRef.current;
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      if (dx !== 0 || dy !== 0) {
        pushOperation({
          type: 'move',
          deltas: selectedIds.map((id) => ({
            id,
            delta: { x: dx, y: dy },
          })),
        });
      }
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
