import { useCallback, useEffect, useRef, useState } from 'react';
import type { WebGLRenderer } from '../WebGLRenderer';
import type {
  Camera,
  DrawObject,
  Point,
  RenderState,
  SelectionBox,
} from '../types/types';

// ─────────────────────────────────────────────────────────────────────────────
// useRender
//
// Single source of truth for all state that drives the canvas render.
// - Owns React state: objects, currentPath, color, size, selectionBox, selectedBoundingBox.
// - Keeps stateRef in sync so renderFrame() (used from rAF/callbacks) always sees latest.
// - Only place that calls renderer.render(). Camera read from cameraRef at render time.
// ─────────────────────────────────────────────────────────────────────────────

const initialRenderState: RenderState = {
  objects: [],
  currentPath: [],
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
  color: '#000',
  size: 10,
  selectionBox: null,
  selectedBoundingBox: null,
};

export function useRender(
  rendererRef: React.RefObject<WebGLRenderer | null>,
  cameraRef: React.RefObject<Camera>
) {
  const [objects, setObjects] = useState<DrawObject[]>([]);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);
  const [color, setColor] = useState('#000');
  const [size, setSize] = useState(10);
  const [selectionBox, setSelectionBox] = useState<SelectionBox>(null);
  const [selectedBoundingBox, setSelectedBoundingBox] =
    useState<SelectionBox>(null);

  const stateRef = useRef<RenderState>({ ...initialRenderState });

  const renderFrame = useCallback(() => {
    const r = rendererRef.current;
    const s = stateRef.current;
    const c = cameraRef.current;
    if (!r) return;

    r.render(
      s.objects,
      s.currentPath,
      c.zoom,
      c.offsetX,
      c.offsetY,
      s.color,
      s.size,
      s.selectionBox,
      s.selectedBoundingBox
    );
  }, [rendererRef, cameraRef]);

  useEffect(() => {
    stateRef.current.objects = objects;
    stateRef.current.currentPath = currentPath;
    stateRef.current.color = color;
    stateRef.current.size = size;
    stateRef.current.selectionBox = selectionBox;
    stateRef.current.selectedBoundingBox = selectedBoundingBox;
    renderFrame();
  }, [
    objects,
    currentPath,
    color,
    size,
    selectionBox,
    selectedBoundingBox,
    renderFrame,
  ]);

  return {
    renderFrame,
    state: {
      objects,
      setObjects,
      currentPath,
      setCurrentPath,
      color,
      setColor,
      size,
      setSize,
      selectionBox,
      setSelectionBox,
      selectedBoundingBox,
      setSelectedBoundingBox,
    }
  };
}

