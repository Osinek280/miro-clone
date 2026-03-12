import { useEffect, useRef } from 'react';
import {
  DrawModeEnum,
  type Camera,
  type RenderStateAPI,
} from '../types/types';
import { useState } from 'react';
import { getCanvasPoint } from '../utils/cameraUtils';
import { useDrawMode } from './modes/useDrawMode';
import { useSelectMode } from './modes/useSelectMode';
import { useGrabMode } from './modes/useGrabMode';

export function useMouseHandlers(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  cameraRef: React.RefObject<Camera>,
  targetCameraRef: React.RefObject<Camera>,
  renderFrame: () => void,
  state: RenderStateAPI,
  mode: DrawModeEnum,
  setMode: React.Dispatch<React.SetStateAction<DrawModeEnum>>
) {
  const {
    objects,
    setObjects,
    setCurrentPath,
    currentPath,
    color: currentColor,
    size: currentSize,
    selectionBox,
    setSelectionBox,
    selectedBoundingBox,
    setSelectedBoundingBox,
  } = state;

  const [isDrawing, setIsDrawing] = useState(false);
  const prevModeRef = useRef<DrawModeEnum>(DrawModeEnum.Draw);
  const isGrabbingRef = useRef(false);

  const draw = useDrawMode(
    setCurrentPath,
    setObjects,
    currentColor,
    currentSize
  );
  const select = useSelectMode(
    cameraRef,
    objects,
    setObjects,
    selectionBox,
    setSelectionBox,
    selectedBoundingBox,
    setSelectedBoundingBox
  );

  const grab = useGrabMode(cameraRef, targetCameraRef, renderFrame);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 1 || mode === DrawModeEnum.Grab) {
      prevModeRef.current = mode;
      setMode(DrawModeEnum.Grab);
      isGrabbingRef.current = true;
      return;
    }
    const point = getCanvasPoint(e, canvasRef, cameraRef.current);
    if (mode === DrawModeEnum.Select) {
      select.onMouseDown(point);
    } else if (mode === DrawModeEnum.Draw) {
      setIsDrawing(true);
      setCurrentPath(draw.onMouseDown(point));
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isGrabbingRef.current) {
      grab.onMouseMove(e);
      return;
    }
    const point = getCanvasPoint(e, canvasRef, cameraRef.current);
    if (mode === DrawModeEnum.Select) {
      select.onMouseMove(point);
    } else if (mode === DrawModeEnum.Draw && isDrawing) {
      setCurrentPath((prev) => draw.onMouseMove(point, prev, e.shiftKey));
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 1 || isGrabbingRef.current) {
      setMode(prevModeRef.current);
      isGrabbingRef.current = false;
      return;
    }
    if (mode === DrawModeEnum.Select) {
      select.onMouseUp();
    } else if (mode === DrawModeEnum.Draw) {
      draw.onMouseUp(currentPath);
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
