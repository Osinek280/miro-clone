import { create } from 'zustand';
import type { RefObject } from 'react';
import type { WebGLRenderer } from '../WebGLRenderer';
import type {
  Camera,
  DrawObject,
  Point,
  SelectionBox,
} from '../types/types';

// ─────────────────────────────────────────────────────────────────────────────
// Canvas store – single source of truth for render + interaction state.
// - Holds refs to renderer and camera (set from Whiteboard after init).
// - renderFrame() reads store state + refs and triggers a draw (no prop drilling).
// - Render is coalesced with rAF so multiple state updates in one frame = one draw.
// ─────────────────────────────────────────────────────────────────────────────

type SetStateAction<T> = T | ((prev: T) => T);

function resolveAction<T>(action: SetStateAction<T>, current: T): T {
  return typeof action === 'function' ? (action as (prev: T) => T)(current) : action;
}

let renderScheduled = false;
function scheduleRender(get: () => CanvasStoreState) {
  if (renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(() => {
    renderScheduled = false;
    get().renderFrame();
  });
}

export interface CanvasStoreState {
  // Refs (set once from Whiteboard)
  rendererRef: RefObject<WebGLRenderer | null> | null;
  cameraRef: RefObject<Camera> | null;

  // Render state
  objects: DrawObject[];
  currentPath: Point[];
  color: string;
  size: number;
  selectionBox: SelectionBox;
  selectedBoundingBox: SelectionBox;

  // Interaction / selection
  selectedIds: string[];
  isDrawing: boolean;
  isMoving: boolean;
  isGrabbing: boolean;

  // Refs + render
  setRefs: (
    rendererRef: RefObject<WebGLRenderer | null>,
    cameraRef: RefObject<Camera>
  ) => void;
  renderFrame: () => void;

  // Setters (render-affecting ones call renderFrame after update)
  setObjects: (action: SetStateAction<DrawObject[]>) => void;
  setCurrentPath: (action: SetStateAction<Point[]>) => void;
  setColor: (action: SetStateAction<string>) => void;
  setSize: (action: SetStateAction<number>) => void;
  setSelectionBox: (action: SetStateAction<SelectionBox>) => void;
  setSelectedBoundingBox: (action: SetStateAction<SelectionBox>) => void;

  setSelectedIds: (action: SetStateAction<string[]>) => void;
  setIsDrawing: (value: boolean) => void;
  setIsMoving: (value: boolean) => void;
  setIsGrabbing: (value: boolean) => void;

  clearSelection: () => void;
}

export const useCanvasStore = create<CanvasStoreState>((set, get) => ({
  rendererRef: null,
  cameraRef: null,

  objects: [],
  currentPath: [],
  color: '#000',
  size: 10,
  selectionBox: null,
  selectedBoundingBox: null,

  selectedIds: [],
  isDrawing: false,
  isMoving: false,
  isGrabbing: false,

  setRefs: (rendererRef, cameraRef) => {
    set({ rendererRef, cameraRef });
    get().renderFrame();
  },

  renderFrame: () => {
    const { rendererRef, cameraRef, objects, currentPath, color, size, selectionBox, selectedBoundingBox } = get();
    const r = rendererRef?.current;
    const c = cameraRef?.current;
    if (!r || !c) return;
    r.render(
      objects,
      currentPath,
      c.zoom,
      c.offsetX,
      c.offsetY,
      color,
      size,
      selectionBox,
      selectedBoundingBox
    );
  },

  setObjects: (action) => {
    set((s) => ({ objects: resolveAction(action, s.objects) }));
    scheduleRender(get);
  },

  setCurrentPath: (action) => {
    set((s) => ({ currentPath: resolveAction(action, s.currentPath) }));
    scheduleRender(get);
  },

  setColor: (action) => {
    set((s) => ({ color: resolveAction(action, s.color) }));
    scheduleRender(get);
  },

  setSize: (action) => {
    set((s) => ({ size: resolveAction(action, s.size) }));
    scheduleRender(get);
  },

  setSelectionBox: (action) => {
    set((s) => ({ selectionBox: resolveAction(action, s.selectionBox) }));
    scheduleRender(get);
  },

  setSelectedBoundingBox: (action) => {
    set((s) => ({ selectedBoundingBox: resolveAction(action, s.selectedBoundingBox) }));
    scheduleRender(get);
  },

  setSelectedIds: (action) => set((s) => ({ selectedIds: resolveAction(action, s.selectedIds) })),
  setIsDrawing: (value) => set({ isDrawing: value }),
  setIsMoving: (value) => set({ isMoving: value }),
  setIsGrabbing: (value) => set({ isGrabbing: value }),

  clearSelection: () => {
    set({
      selectedIds: [],
      selectionBox: null,
      selectedBoundingBox: null,
    });
    scheduleRender(get);
  },
}));
