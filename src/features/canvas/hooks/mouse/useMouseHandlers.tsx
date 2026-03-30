import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  DrawModeEnum,
  type Camera,
  type HistoryOperation,
  type Point,
} from '../../types/types';
import { getCanvasPoint } from '../../utils/cameraUtils';
import { useDrawMode } from './modes/useDrawMode';
import { useSelectMode } from './modes/useSelectMode';
import { useGrabMode } from './modes/useGrabMode';
import { useCanvasStore } from '../useCanvasStore';

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
  } = useCanvasStore(
    useShallow((s) => ({
      setCurrentPath: s.setCurrentPath,
      setObjects: s.setObjects,
      color: s.color,
      size: s.size,
      setIsDrawing: s.setIsDrawing,
      setIsGrabbing: s.setIsGrabbing,
    })),
  );

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
      select.onMouseDown(point);
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
      select.onMouseMove(point);
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
      select.onMouseUp();
    } else if (mode === DrawModeEnum.Draw) {
      draw.onMouseUp();
      setIsDrawing(false);
    }
  };

  useEffect(() => {
    if (mode !== DrawModeEnum.Draw) return;

    const state = useCanvasStore.getState();
    if (
      state.selectedIds.length > 0 ||
      state.selectionBox !== null ||
      state.selectedBoundingBox !== null
    ) {
      state.clearSelection();
    }
  }, [mode]);

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  };
}
