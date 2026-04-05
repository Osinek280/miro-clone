import { useLayoutEffect, useRef } from 'react';
import type {
  Camera,
  HistoryOperation,
  Point,
  SelectionResizeSession,
  SelectionRotateSession,
} from '../../../types/types';
import { roundPoint } from '../../../utils/cameraUtils';
import {
  calcBoundingBox,
  drawObjectIntersectsSelectionRect,
  findObjectAtPoint,
  getVisibleObjects,
  selectionHasRotatedImage,
} from '../../../utils/objectUtils';
import {
  applyRotateDeltaToObjects,
  cornersOfAxisBounds,
  offsetSelectionQuad,
  rotateOutlineCorners,
  rotationDeltaFromPointers,
} from '../../../utils/rotateUtils';
import {
  boundsChanged,
  boundsToSelectionBox,
  computeResizedBounds,
  hitTestBoxResizeHandle,
  hitTestBoxRotateHandle,
  mapDrawObjectWithBounds,
  selectionBoxToBounds,
} from '../../../utils/scaleBoundsUtils';
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
  const selectionRotateSessionRef = useRef<SelectionRotateSession | null>(null);

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

  useLayoutEffect(() => {
    useCanvasStore
      .getState()
      .setSelectionRotateSessionRef(selectionRotateSessionRef);
    return () => useCanvasStore.getState().setSelectionRotateSessionRef(null);
  }, []);

  const onMouseDown = (point: Point, shiftKey = false) => {
    dragOffsetRef.current.x = 0;
    dragOffsetRef.current.y = 0;
    const zoom = cameraRef.current.zoom;
    const st = useCanvasStore.getState();
    if (st.selectedBoundingBox && st.selectedIds.length > 0) {
      if (
        hitTestBoxRotateHandle(
          point,
          st.selectedBoundingBox,
          zoom,
          st.selectedOrientedQuad,
        ) != null
      ) {
        const b = selectionBoxToBounds(st.selectedBoundingBox);
        const quad0: [Point, Point, Point, Point] = st.selectedOrientedQuad
          ? [
              { ...st.selectedOrientedQuad[0] },
              { ...st.selectedOrientedQuad[1] },
              { ...st.selectedOrientedQuad[2] },
              { ...st.selectedOrientedQuad[3] },
            ]
          : cornersOfAxisBounds(b);
        const cx =
          (quad0[0].x + quad0[1].x + quad0[2].x + quad0[3].x) / 4;
        const cy =
          (quad0[0].y + quad0[1].y + quad0[2].y + quad0[3].y) / 4;
        const center = { x: cx, y: cy };
        const pathSnapshots: SelectionRotateSession['pathSnapshots'] = {};
        const imageSnapshots: SelectionRotateSession['imageSnapshots'] = {};
        for (const id of st.selectedIds) {
          const o = st.objects.find((x) => x.id === id);
          if (o?.type === 'PATH') {
            pathSnapshots[id] = o.points.map((p) => ({ x: p.x, y: p.y }));
          } else if (o?.type === 'IMAGE') {
            imageSnapshots[id] = {
              x: o.x,
              y: o.y,
              width: o.width,
              height: o.height,
              rotation: o.rotation ?? 0,
            };
          }
        }
        selectionRotateSessionRef.current = {
          center,
          initialRotateCorners: quad0,
          accumulatedRadians: 0,
          prevPointerForRotate: { x: point.x, y: point.y },
          lastPoint: point,
          pathSnapshots,
          imageSnapshots,
        };
        const store = useCanvasStore.getState();
        store.setIsRotating(true);
        store.scheduleRedraw();
        lastMousePosRef.current = point;
        return;
      }
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
        setSelectedOrientedQuad(null);
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
    if (state.isRotating && state.selectionRotateSessionRef?.current) {
      const sess = state.selectionRotateSessionRef.current;
      const zoom = cameraRef.current.zoom;
      const minRadiusWorld = 6 / zoom;
      sess.accumulatedRadians += rotationDeltaFromPointers(
        sess.center,
        sess.prevPointerForRotate,
        point,
        minRadiusWorld,
      );
      sess.prevPointerForRotate = { x: point.x, y: point.y };
      sess.lastPoint = point;
      state.scheduleRedraw();
      return;
    }
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
    const rotating = state.isRotating;
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
      setSelectedIds(selected.map((o) => o.id));
      setSelectedBoundingBox(
        selected.length > 0 ? calcBoundingBox(selected) : null,
      );
      setSelectedOrientedQuad(null);
      setSelectionBox(null);
    } else if (
      rotating &&
      ids.length > 0 &&
      state.selectionRotateSessionRef?.current
    ) {
      const sess = state.selectionRotateSessionRef.current;
      if (sess) {
        const delta = sess.accumulatedRadians;
        if (Math.abs(delta) > 1e-6) {
          const ts = Date.now();
          pushSyncedOperation({
            opId: crypto.randomUUID(),
            timestamp: ts,
            type: 'rotate',
            ids: [...ids],
            center: sess.center,
            deltaRadians: delta,
          });
          setObjects((prev) =>
            applyRotateDeltaToObjects(prev, ids, sess.center, delta, ts),
          );
          const nextObjs = applyRotateDeltaToObjects(
            objs,
            ids,
            sess.center,
            delta,
            ts,
          );
          const selected = nextObjs.filter((o) => ids.includes(o.id));
          setSelectedBoundingBox(
            selected.length > 0 ? calcBoundingBox(selected) : null,
          );
          setSelectedOrientedQuad(
            rotateOutlineCorners(
              sess.initialRotateCorners,
              sess.center,
              delta,
            ),
          );
        }
      }
      state.selectionRotateSessionRef.current = null;
    } else if (resizing && ids.length > 0 && state.selectionResizeSessionRef) {
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
