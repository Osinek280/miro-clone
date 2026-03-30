import { useLayoutEffect, useRef } from 'react';
import type { Camera, HistoryOperation, Point } from '../../../types/types';
import { useCanvasStore } from '../../useCanvasStore';
import { roundPoint } from '../../../utils/cameraUtils';
import {
  calcBoundingBox,
  findObjectAtPoint,
  getVisibleObjects,
} from '../../../utils/objectUtils';

export function useSelectMode(
  cameraRef: React.RefObject<Camera>,
  pushSyncedOperation: (op: HistoryOperation) => void,
) {
  const lastMousePosRef = useRef<Point>({ x: 0, y: 0 });
  const dragStartRef = useRef<Point>({ x: 0, y: 0 });
  const dragOffsetRef = useRef<Point>({ x: 0, y: 0 });

  useLayoutEffect(() => {
    useCanvasStore.getState().setSelectionDragOffsetRef(dragOffsetRef);
    return () => useCanvasStore.getState().setSelectionDragOffsetRef(null);
  }, []);

  const onMouseDown = (point: Point) => {
    const state = useCanvasStore.getState();
    dragOffsetRef.current.x = 0;
    dragOffsetRef.current.y = 0;
    const obj = findObjectAtPoint(point, state.objects, cameraRef.current.zoom);
    if (obj) {
      dragStartRef.current = point;
      if (state.selectedIds.includes(obj.id)) {
        state.setIsMoving(true);
      } else {
        state.setSelectedIds([obj.id]);
        state.setSelectedBoundingBox(calcBoundingBox([obj]));
        state.setIsMoving(true);
      }
      lastMousePosRef.current = point;
    } else {
      state.setSelectionBox({ start: point, end: point });
      state.setSelectedIds([]);
      state.setSelectedBoundingBox(null);
    }
  };

  const onMouseMove = (point: Point) => {
    const state = useCanvasStore.getState();
    const currentSelectionBox = state.selectionBox;
    const currentIsMoving = state.isMoving;

    if (currentSelectionBox) {
      state.setSelectionBox({ ...currentSelectionBox, end: point });
    } else if (currentIsMoving) {
      const dx = point.x - lastMousePosRef.current.x;
      const dy = point.y - lastMousePosRef.current.y;
      dragOffsetRef.current.x += dx;
      dragOffsetRef.current.y += dy;
      lastMousePosRef.current = point;
      useCanvasStore.getState().scheduleRedraw();
    }
  };

  const onMouseUp = () => {
    const state = useCanvasStore.getState();
    const { selectionBox, isMoving, selectedIds, objects } = state;

    if (selectionBox) {
      const { start, end } = selectionBox;
      const minX = Math.min(start.x, end.x);
      const maxX = Math.max(start.x, end.x);
      const minY = Math.min(start.y, end.y);
      const maxY = Math.max(start.y, end.y);
      const visible = getVisibleObjects(objects);
      const selected = visible.filter((obj) =>
        obj.points.some(
          (p) => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY,
        ),
      );
      state.setSelectedIds(selected.map((o) => o.id));
      state.setSelectedBoundingBox(
        selected.length > 0 ? calcBoundingBox(selected) : null,
      );
      state.setSelectionBox(null);
    } else if (isMoving && selectedIds.length > 0) {
      const dx = dragOffsetRef.current.x;
      const dy = dragOffsetRef.current.y;
      if (dx !== 0 || dy !== 0) {
        const ts = Date.now();
        pushSyncedOperation({
          opId: crypto.randomUUID(),
          timestamp: ts,
          type: 'translate',
          ids: [...selectedIds],
          dx,
          dy,
        });
        state.setObjects((prev) =>
          prev.map((o) =>
            selectedIds.includes(o.id)
              ? {
                  ...o,
                  points: o.points.map((p) =>
                    roundPoint({ x: p.x + dx, y: p.y + dy }),
                  ),
                  positionTimestamp: ts,
                }
              : o,
          ),
        );
        state.setSelectedBoundingBox((prev) =>
          prev
            ? {
                start: roundPoint({
                  x: prev.start.x + dx,
                  y: prev.start.y + dy,
                }),
                end: roundPoint({
                  x: prev.end.x + dx,
                  y: prev.end.y + dy,
                }),
              }
            : null,
        );
      }
      dragOffsetRef.current.x = 0;
      dragOffsetRef.current.y = 0;
    }
    state.setIsMoving(false);
  };

  return {
    clearSelection: useCanvasStore.getState().clearSelection,
    onMouseDown,
    onMouseMove,
    onMouseUp,
  };
}
