import { useEffect, useRef } from 'react';
import {
  DrawModeEnum,
  type Camera,
  type HistoryOperation,
} from '../types/types';
import { getCanvasPoint } from '../utils/cameraUtils';
import { useDrawMode } from './modes/useDrawMode';
import { useSelectMode } from './modes/useSelectMode';
import { useGrabMode } from './modes/useGrabMode';
import { useCanvasStore } from './useCanvasStore';

export function useMouseHandlers(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  cameraRef: React.RefObject<Camera>,
  targetCameraRef: React.RefObject<Camera>,
  mode: DrawModeEnum,
  setMode: React.Dispatch<React.SetStateAction<DrawModeEnum>>,
  pushSyncedOperation: (op: HistoryOperation) => void,
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
  const select = useSelectMode(cameraRef);
  const grab = useGrabMode(cameraRef, targetCameraRef);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
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
