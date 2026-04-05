import { useLayoutEffect, useRef } from 'react';
import type {
  Camera,
  HistoryOperation,
  Point,
  SelectionRotateSession,
} from '../../../types/types';
import { calcBoundingBox } from '../../../utils/objectUtils';
import {
  applyRotateDeltaToObjects,
  cornersOfAxisBounds,
  rotateOutlineCorners,
  rotationDeltaFromPointers,
} from '../../../utils/rotateUtils';
import {
  hitTestBoxRotateHandle,
  selectionBoxToBounds,
} from '../../../utils/scaleBoundsUtils';
import { useCanvasStore } from '../../../store/useCanvasStore';

export function useSelectionRotate(
  cameraRef: React.RefObject<Camera>,
  pushSyncedOperation: (op: HistoryOperation) => void,
  lastMousePosRef: React.MutableRefObject<Point>,
) {
  const { setObjects, setSelectedBoundingBox, setSelectedOrientedQuad } =
    useCanvasStore();

  const selectionRotateSessionRef = useRef<SelectionRotateSession | null>(null);

  useLayoutEffect(() => {
    useCanvasStore
      .getState()
      .setSelectionRotateSessionRef(selectionRotateSessionRef);
    return () => useCanvasStore.getState().setSelectionRotateSessionRef(null);
  }, []);

  const onMouseDownRotate = (point: Point): boolean => {
    const zoom = cameraRef.current.zoom;
    const st = useCanvasStore.getState();
    if (!st.selectedBoundingBox || st.selectedIds.length === 0) return false;
    if (
      hitTestBoxRotateHandle(
        point,
        st.selectedBoundingBox,
        zoom,
        st.selectedOrientedQuad,
      ) == null
    ) {
      return false;
    }

    const b = selectionBoxToBounds(st.selectedBoundingBox);
    const quad0: [Point, Point, Point, Point] = st.selectedOrientedQuad
      ? [
          { ...st.selectedOrientedQuad[0] },
          { ...st.selectedOrientedQuad[1] },
          { ...st.selectedOrientedQuad[2] },
          { ...st.selectedOrientedQuad[3] },
        ]
      : cornersOfAxisBounds(b);
    const cx = (quad0[0].x + quad0[1].x + quad0[2].x + quad0[3].x) / 4;
    const cy = (quad0[0].y + quad0[1].y + quad0[2].y + quad0[3].y) / 4;
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
    return true;
  };

  const onMouseMoveRotate = (point: Point): boolean => {
    const state = useCanvasStore.getState();
    if (!state.isRotating || !state.selectionRotateSessionRef?.current)
      return false;
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
    return true;
  };

  const onMouseUpRotate = (): boolean => {
    const state = useCanvasStore.getState();
    const rotating = state.isRotating;
    const ids = state.selectedIds;
    const objs = state.objects;
    if (
      !rotating ||
      ids.length === 0 ||
      !state.selectionRotateSessionRef?.current
    ) {
      return false;
    }
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
          rotateOutlineCorners(sess.initialRotateCorners, sess.center, delta),
        );
      }
    }
    state.selectionRotateSessionRef.current = null;
    return true;
  };

  return {
    onMouseDownRotate,
    onMouseMoveRotate,
    onMouseUpRotate,
  };
}
