import { useEffect, useRef } from 'react';
import {
  DrawModeEnum,
  type Camera,
  type HistoryOperation,
  type Point,
} from '../../types/types';
import { getCursor } from '../../utils/cursorUtils';
import { getCanvasPoint } from '../../utils/cameraUtils';
import { selectionHasRotatedImage } from '../../utils/objectUtils';
import { offsetSelectionQuad } from '../../utils/rotateUtils';
import {
  hitTestBoxResizeHandle,
  hitTestBoxRotateHandle,
  resizeHandleCursor,
} from '../../utils/scaleBoundsUtils';
import { useDrawMode } from './modes/useDrawMode';
import { useSelectMode } from './modes/useSelectMode';
import { useGrabMode } from './modes/useGrabMode';
import { useCanvasStore } from '../../store/useCanvasStore';

export function useMouseHandlers(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  cameraRef: React.RefObject<Camera>,
  targetCameraRef: React.RefObject<Camera>,
  mode: DrawModeEnum,
  setMode: React.Dispatch<React.SetStateAction<DrawModeEnum>>,
  pushSyncedOperation: (op: HistoryOperation) => void,
  pushSyncedCursor: (cursor: Point) => void,
  boardReady: boolean,
) {
  const {
    setCurrentPath,
    setObjects,
    color: currentColor,
    size: currentSize,
    setIsDrawing,
    setIsGrabbing,
  } = useCanvasStore();

  const prevModeRef = useRef<DrawModeEnum>(DrawModeEnum.Draw);

  const draw = useDrawMode(
    setCurrentPath,
    setObjects,
    currentColor,
    currentSize,
    pushSyncedOperation,
  );
  const select = useSelectMode(cameraRef, pushSyncedOperation);
  const grab = useGrabMode(cameraRef, targetCameraRef);

  const applySelectHoverCursor = (worldPoint: Point) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const st = useCanvasStore.getState();
    const zoom = cameraRef.current.zoom;

    if (st.isResizing && st.selectionResizeSessionRef?.current) {
      canvas.style.cursor = resizeHandleCursor(
        st.selectionResizeSessionRef.current.handle,
      );
      return;
    }

    if (st.isRotating) {
      canvas.style.cursor = 'grab';
      return;
    }

    if (st.isMoving) {
      canvas.style.cursor = getCursor(DrawModeEnum.Select);
      return;
    }

    if (
      st.selectedBoundingBox &&
      st.selectedIds.length > 0 &&
      !st.selectionBox
    ) {
      const drag = st.selectionDragOffsetRef?.current;
      const quadForHit =
        st.selectedOrientedQuad &&
        drag &&
        (drag.x !== 0 || drag.y !== 0)
          ? offsetSelectionQuad(st.selectedOrientedQuad, drag.x, drag.y)
          : st.selectedOrientedQuad;
      if (
        hitTestBoxRotateHandle(
          worldPoint,
          st.selectedBoundingBox,
          zoom,
          quadForHit,
        ) != null
      ) {
        canvas.style.cursor = 'grab';
        return;
      }
      if (
        !quadForHit &&
        !selectionHasRotatedImage(st.objects, st.selectedIds)
      ) {
        const handle = hitTestBoxResizeHandle(
          worldPoint,
          st.selectedBoundingBox,
          zoom,
        );
        if (handle) {
          canvas.style.cursor = resizeHandleCursor(handle);
          return;
        }
      }
    }

    canvas.style.cursor = getCursor(DrawModeEnum.Select);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!boardReady) return;
    if (e.button === 1 || mode === DrawModeEnum.Grab) {
      prevModeRef.current = mode;
      setMode(DrawModeEnum.Grab);
      setIsGrabbing(true);
      return;
    }
    const point = getCanvasPoint(e, canvasRef, cameraRef.current);
    if (mode === DrawModeEnum.Select) {
      select.onMouseDown(point, e.shiftKey);
    } else if (mode === DrawModeEnum.Draw) {
      setIsDrawing(true);
      draw.onMouseDown(point);
      useCanvasStore.getState().scheduleRedraw();
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!boardReady) return;
    pushSyncedCursor(getCanvasPoint(e, canvasRef, cameraRef.current));
    if (useCanvasStore.getState().isGrabbing) {
      grab.onMouseMove(e);
      return;
    }
    const point = getCanvasPoint(e, canvasRef, cameraRef.current);
    if (mode === DrawModeEnum.Select) {
      select.onMouseMove(point, e.shiftKey);
      applySelectHoverCursor(point);
    } else if (
      mode === DrawModeEnum.Draw &&
      useCanvasStore.getState().isDrawing
    ) {
      draw.onMouseMove(point, e.shiftKey);
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!boardReady) return;
    if (e.button === 1 || useCanvasStore.getState().isGrabbing) {
      setMode(prevModeRef.current);
      setIsGrabbing(false);
      return;
    }
    if (mode === DrawModeEnum.Select) {
      select.onMouseUp(e.shiftKey);
    } else if (mode === DrawModeEnum.Draw) {
      draw.onMouseUp();
      setIsDrawing(false);
    }
  };

  useEffect(() => {
    if (
      mode === DrawModeEnum.Draw &&
      (select.selectedIds.length > 0 ||
        select.selectionBox !== null ||
        select.selectedBoundingBox !== null)
    ) {
      select.clearSelection();
    }
  }, [mode, select]);

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    selectionBox: select.selectionBox,
    selectedBoundingBox: select.selectedBoundingBox,
  };
}
