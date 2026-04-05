import { useLayoutEffect, useRef } from 'react';
import type {
  Camera,
  HistoryOperation,
  Point,
  SelectionResizeSession,
} from '../../../types/types';
import { roundPoint } from '../../../utils/cameraUtils';
import {
  calcBoundingBox,
  drawObjectIntersectsSelectionRect,
  findObjectAtPoint,
  getVisibleObjects,
  orientedSelectionQuadForIds,
  selectionHasRotatedImage,
} from '../../../utils/objectUtils';
import { offsetSelectionQuad } from '../../../utils/rotateUtils';
import {
  boundsChanged,
  boundsToSelectionBox,
  computeResizedBounds,
  hitTestBoxResizeHandle,
  mapDrawObjectWithBounds,
  selectionBoxToBounds,
} from '../../../utils/scaleBoundsUtils';
import { useCanvasStore } from '../../../store/useCanvasStore';
import { useSelectionRotate } from './useSelectionRotate';

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
    setSelectedOrientedQuad,
    selectedIds,
    setSelectedIds,
    isMoving,
    setIsMoving,
    setIsResizing,
    setIsRotating,
    clearSelection,
  } = useCanvasStore();

  const lastMousePosRef = useRef<Point>({ x: 0, y: 0 });
  const dragStartRef = useRef<Point>({ x: 0, y: 0 });
  const dragOffsetRef = useRef<Point>({ x: 0, y: 0 });
  const selectionResizeSessionRef = useRef<SelectionResizeSession | null>(null);

  const { onMouseDownRotate, onMouseMoveRotate, onMouseUpRotate } =
    useSelectionRotate(cameraRef, pushSyncedOperation, lastMousePosRef);

  useLayoutEffect(() => {
    useCanvasStore.getState().setSelectionDragOffsetRef(dragOffsetRef);
    return () => useCanvasStore.getState().setSelectionDragOffsetRef(null);
  }, []);

  useLayoutEffect(() => {
    useCanvasStore
      .getState()
      .setSelectionResizeSessionRef(selectionResizeSessionRef);
    return () => useCanvasStore.getState().setSelectionResizeSessionRef(null);
  }, []);

  const onMouseDown = (point: Point, shiftKey = false) => {
    dragOffsetRef.current.x = 0;
    dragOffsetRef.current.y = 0;
    const zoom = cameraRef.current.zoom;
    const st = useCanvasStore.getState();
    if (st.selectedBoundingBox && st.selectedIds.length > 0) {
      if (onMouseDownRotate(point)) return;
      if (
        !st.selectedOrientedQuad &&
        !selectionHasRotatedImage(st.objects, st.selectedIds)
      ) {
        const handle = hitTestBoxResizeHandle(
          point,
          st.selectedBoundingBox,
          zoom,
        );
        if (handle) {
          selectionResizeSessionRef.current = {
            handle,
            initialBounds: selectionBoxToBounds(st.selectedBoundingBox),
            lastPoint: point,
            uniformScale: shiftKey,
          };
          const store = useCanvasStore.getState();
          store.setIsResizing(true);
          store.scheduleRedraw();
          lastMousePosRef.current = point;
          return;
        }
      }
    }

    const obj = findObjectAtPoint(point, objects, zoom);
    if (obj) {
      dragStartRef.current = point;
      if (selectedIds.includes(obj.id)) {
        setIsMoving(true);
      } else {
        setSelectedIds([obj.id]);
        setSelectedBoundingBox(calcBoundingBox([obj]));
        setSelectedOrientedQuad(orientedSelectionQuadForIds(objects, [obj.id]));
        setIsMoving(true);
      }
      lastMousePosRef.current = point;
    } else {
      setSelectionBox({ start: point, end: point });
      setSelectedIds([]);
      setSelectedBoundingBox(null);
      setSelectedOrientedQuad(null);
    }
  };

  const onMouseMove = (point: Point, shiftKey = false) => {
    const state = useCanvasStore.getState();
    if (onMouseMoveRotate(point)) return;
    if (state.isResizing && state.selectionResizeSessionRef?.current) {
      const sess = state.selectionResizeSessionRef.current;
      sess.lastPoint = point;
      sess.uniformScale = shiftKey;
      state.scheduleRedraw();
      return;
    }
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

  const onMouseUp = (shiftKey = false) => {
    const state = useCanvasStore.getState();
    const box = state.selectionBox;
    const moving = state.isMoving;
    const resizing = state.isResizing;
    const ids = state.selectedIds;
    const objs = state.objects;
    const zoom = cameraRef.current.zoom;

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
      const ids = selected.map((o) => o.id);
      setSelectedIds(ids);
      setSelectedBoundingBox(
        selected.length > 0 ? calcBoundingBox(selected) : null,
      );
      setSelectedOrientedQuad(
        selected.length > 0 ? orientedSelectionQuadForIds(selected, ids) : null,
      );
      setSelectionBox(null);
    } else if (!onMouseUpRotate()) {
      if (resizing && ids.length > 0 && state.selectionResizeSessionRef) {
        const sess = state.selectionResizeSessionRef.current;
        if (sess) {
          const uniform = sess.uniformScale || shiftKey;
          const newBounds = computeResizedBounds(
            sess.handle,
            sess.initialBounds,
            sess.lastPoint,
            zoom,
            uniform,
          );
          if (boundsChanged(sess.initialBounds, newBounds)) {
            const ts = Date.now();
            pushSyncedOperation({
              opId: crypto.randomUUID(),
              timestamp: ts,
              type: 'scaleBounds',
              ids: [...ids],
              oldBounds: sess.initialBounds,
              newBounds,
            });
            const idSet = new Set(ids);
            setObjects((prev) =>
              prev.map((o) =>
                mapDrawObjectWithBounds(
                  o,
                  idSet,
                  sess.initialBounds,
                  newBounds,
                  ts,
                ),
              ),
            );
            setSelectedBoundingBox(boundsToSelectionBox(newBounds));
            setSelectedOrientedQuad(null);
          }
        }
        state.selectionResizeSessionRef.current = null;
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
          setSelectedOrientedQuad((prev) =>
            prev ? offsetSelectionQuad(prev, dx, dy) : null,
          );
        }
        dragOffsetRef.current.x = 0;
        dragOffsetRef.current.y = 0;
      }
    }
    setIsMoving(false);
    setIsResizing(false);
    setIsRotating(false);
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
