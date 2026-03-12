import type { Camera } from '../../types/types';

export function useGrabMode(
  cameraRef: React.RefObject<Camera>,
  targetCameraRef: React.RefObject<Camera>,
  renderFrame: () => void
) {
  const onMouseMove = (e: React.MouseEvent) => {
    const dx = e.movementX;
    const dy = e.movementY;
    cameraRef.current.offsetX += dx;
    cameraRef.current.offsetY += dy;
    targetCameraRef.current.offsetX += dx;
    targetCameraRef.current.offsetY += dy;
    renderFrame();
  };

  return { onMouseMove };
}
