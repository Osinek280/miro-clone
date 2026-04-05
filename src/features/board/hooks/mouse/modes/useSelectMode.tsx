import { useLayoutEffect, useRef } from 'react';
import type { Camera, HistoryOperation, Point } from '../../../types/types';
import { roundPoint } from '../../../utils/cameraUtils';
import {
  calcBoundingBox,
  drawObjectIntersectsSelectionRect,
  findObjectAtPoint,
  getVisibleObjects,
} from '../../../utils/objectUtils';
import { useCanvasStore } from '../../../store/useCanvasStore';

export function useSelectMode(
  cameraRef: React.RefObject<Camera>,
  pushSyncedOperation: (op: HistoryOperation) => void,
) {
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

  const lastMousePosRef = useRef<Point>({ x: 0, y: 0 });
  const dragStartRef = useRef<Point>({ x: 0, y: 0 });
  const dragOffsetRef = useRef<Point>({ x: 0, y: 0 });

  useLayoutEffect(() => {
    useCanvasStore.getState().setSelectionDragOffsetRef(dragOffsetRef);
    return () => useCanvasStore.getState().setSelectionDragOffsetRef(null);
  }, []);

  const onMouseDown = (point: Point) => {
    dragOffsetRef.current.x = 0;
    dragOffsetRef.current.y = 0;
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

    if (currentSelectionBox) {
      setSelectionBox({ ...currentSelectionBox, end: point });
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
    const box = state.selectionBox;
    const moving = state.isMoving;
    const ids = state.selectedIds;
    const objs = state.objects;

    if (box) {
      const { start, end } = box;
      const minX = Math.min(start.x, end.x);
      const maxX = Math.max(start.x, end.x);
      const minY = Math.min(start.y, end.y);
      const maxY = Math.max(start.y, end.y);
      const visible = getVisibleObjects(objs);
      const selected = visible.filter((obj) =>
        drawObjectIntersectsSelectionRect(obj, minX, maxX, minY, maxY),
      );
      setSelectedIds(selected.map((o) => o.id));
      setSelectedBoundingBox(
        selected.length > 0 ? calcBoundingBox(selected) : null,
      );
      setSelectionBox(null);
    } else if (moving && ids.length > 0) {
      const dx = dragOffsetRef.current.x;
      const dy = dragOffsetRef.current.y;
      if (dx !== 0 || dy !== 0) {
        const ts = Date.now();
        pushSyncedOperation({
          opId: crypto.randomUUID(),
          timestamp: ts,
          type: 'translate',
          ids: [...ids],
          dx,
          dy,
        });
        setObjects((prev) =>
          prev.map((o) => {
            if (!ids.includes(o.id)) return o;
            if (o.type === 'IMAGE') {
              const p = roundPoint({ x: o.x + dx, y: o.y + dy });
              return { ...o, x: p.x, y: p.y, positionTimestamp: ts };
            }
            return {
              ...o,
              points: o.points.map((pt) =>
                roundPoint({ x: pt.x + dx, y: pt.y + dy }),
              ),
              positionTimestamp: ts,
            };
          }),
        );
        setSelectedBoundingBox((prev) =>
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
