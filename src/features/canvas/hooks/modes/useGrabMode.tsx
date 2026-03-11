import type { Camera } from "../../types/types";
import type { WebGLRenderer } from "../../WebGLRenderer";
import type { DrawObject, Point } from "../../types/types";

type SelectionBox = { start: Point; end: Point } | null;

export function useGrabMode(
  cameraRef: React.RefObject<Camera>,
  targetCameraRef: React.RefObject<Camera>,
  rendererRef: React.RefObject<WebGLRenderer | null>,
  objects: DrawObject[],
  currentPath: Point[],
  currentColor: string,
  currentSize: number,
  selectionBoxRef: React.RefObject<SelectionBox>,
  selectedBoundingBoxRef: React.RefObject<SelectionBox>,
) {
  const onMouseMove = (e: React.MouseEvent) => {
    const dx = e.movementX;
    const dy = e.movementY;
    cameraRef.current.offsetX += dx;
    cameraRef.current.offsetY += dy;
    targetCameraRef.current.offsetX += dx;
    targetCameraRef.current.offsetY += dy;
    rendererRef.current?.render(
      objects,
      currentPath,
      cameraRef.current.zoom,
      cameraRef.current.offsetX,
      cameraRef.current.offsetY,
      currentColor,
      currentSize,
      selectionBoxRef.current,
      selectedBoundingBoxRef.current,
    );
  };

  return { onMouseMove };
}
