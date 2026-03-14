import type { Camera } from '../../types/types';
import { useCanvasStore } from '../useCanvasStore';

export function useGrabMode(
  cameraRef: React.RefObject<Camera>,
  targetCameraRef: React.RefObject<Camera>
) {
  const onMouseMove = (e: React.MouseEvent) => {
    const dx = e.movementX;
    const dy = e.movementY;
    cameraRef.current.offsetX += dx;
    cameraRef.current.offsetY += dy;
    targetCameraRef.current.offsetX += dx;
    targetCameraRef.current.offsetY += dy;
    useCanvasStore.getState().renderFrame();
  };

  return { onMouseMove };
}
