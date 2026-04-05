import { create } from 'zustand';
import type { MutableRefObject, RefObject } from 'react';
import type { WebGLRenderer } from '../WebGLRenderer';
import type {
  Camera,
  DrawObject,
  Point,
  SelectionBox,
  SelectionResizeSession,
} from '../types/types';
import {
  boundsToSelectionBox,
  computeResizedBounds,
} from '../utils/scaleBoundsUtils';
import { getVisibleObjects } from '../utils/objectUtils';

// ─────────────────────────────────────────────────────────────────────────────
// Canvas store – single source of truth for render + interaction state.
// - Holds refs to renderer and camera (set from Whiteboard after init).
// - renderFrame() reads store state + refs and triggers a draw (no prop drilling).
// - Render is coalesced with rAF so multiple state updates in one frame = one draw.
// ─────────────────────────────────────────────────────────────────────────────

type SetStateAction<T> = T | ((prev: T) => T);

function resolveAction<T>(action: SetStateAction<T>, current: T): T {
  return typeof action === 'function'
    ? (action as (prev: T) => T)(current)
    : action;
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
  /** Live stroke while drawing — authoritative path; avoids O(n) store updates each move. */
  inProgressStrokeRef: MutableRefObject<Point[]> | null;
  /** Cumulative world offset while dragging selection (render-only until mouseUp). */
  selectionDragOffsetRef: MutableRefObject<Point> | null;
  /** Live edge-resize session (pointer + initial bounds). */
  selectionResizeSessionRef: MutableRefObject<SelectionResizeSession | null> | null;

  // Render state
  objects: DrawObject[];
  currentPath: Point[];
  color: string;
  size: number;
  selectionBox: SelectionBox;
  selectedBoundingBox: SelectionBox;
  cursors: Point[];

  // Interaction / selection
  selectedIds: string[];
  isDrawing: boolean;
  isMoving: boolean;
  isResizing: boolean;
  isGrabbing: boolean;

  // Refs + render
  setRefs: (
    rendererRef: RefObject<WebGLRenderer | null>,
    cameraRef: RefObject<Camera>,
  ) => void;
  setInProgressStrokeRef: (r: MutableRefObject<Point[]> | null) => void;
  setSelectionDragOffsetRef: (r: MutableRefObject<Point> | null) => void;
  setSelectionResizeSessionRef: (
    r: MutableRefObject<SelectionResizeSession | null> | null,
  ) => void;
  renderFrame: () => void;
  /** Coalesced redraw without mutating store slice (for ref-only preview updates). */
  scheduleRedraw: () => void;

  // Setters (render-affecting ones call renderFrame after update)
  setObjects: (action: SetStateAction<DrawObject[]>) => void;
  setCurrentPath: (action: SetStateAction<Point[]>) => void;
  setColor: (action: SetStateAction<string>) => void;
  setSize: (action: SetStateAction<number>) => void;
  setSelectionBox: (action: SetStateAction<SelectionBox>) => void;
  setSelectedBoundingBox: (action: SetStateAction<SelectionBox>) => void;
  setCursors: (action: SetStateAction<Point[]>) => void;

  setSelectedIds: (action: SetStateAction<string[]>) => void;
  setIsDrawing: (value: boolean) => void;
  setIsMoving: (value: boolean) => void;
  setIsResizing: (value: boolean) => void;
  setIsGrabbing: (value: boolean) => void;

  clearSelection: () => void;
}

export const useCanvasStore = create<CanvasStoreState>((set, get) => ({
  rendererRef: null,
  cameraRef: null,
  inProgressStrokeRef: null,
  selectionDragOffsetRef: null,
  selectionResizeSessionRef: null,

  objects: [],
  currentPath: [],
  color: '#000',
  size: 10,
  selectionBox: null,
  selectedBoundingBox: null,
  cursors: [],

  selectedIds: [],
  isDrawing: false,
  isMoving: false,
  isResizing: false,
  isGrabbing: false,

  setRefs: (rendererRef, cameraRef) => {
    set({ rendererRef, cameraRef });
    get().renderFrame();
  },

  setInProgressStrokeRef: (r) => set({ inProgressStrokeRef: r }),
  setSelectionDragOffsetRef: (r) => set({ selectionDragOffsetRef: r }),
  setSelectionResizeSessionRef: (r) => set({ selectionResizeSessionRef: r }),
  scheduleRedraw: () => scheduleRender(get),

  renderFrame: () => {
    const {
      rendererRef,
      cameraRef,
      objects,
      currentPath,
      color,
      size,
      selectionBox,
      selectedBoundingBox,
      isDrawing,
      inProgressStrokeRef,
      isMoving,
      isResizing,
      selectedIds,
      selectionDragOffsetRef,
      selectionResizeSessionRef,
      cursors,
    } = get();
    const r = rendererRef?.current;
    const c = cameraRef?.current;
    if (!r || !c) return;

    const liveStroke =
      isDrawing && inProgressStrokeRef && inProgressStrokeRef.current.length > 0
        ? inProgressStrokeRef.current
        : currentPath;

    const resizeSession =
      isResizing && selectionResizeSessionRef?.current
        ? selectionResizeSessionRef.current
        : null;
    const previewBounds =
      resizeSession != null
        ? computeResizedBounds(
            resizeSession.edge,
            resizeSession.initialBounds,
            resizeSession.lastPoint,
            c.zoom,
          )
        : null;

    const displaySelectedBox =
      previewBounds != null
        ? boundsToSelectionBox(previewBounds)
        : selectedBoundingBox;

    const selectionResize =
      resizeSession != null && previewBounds != null
        ? {
            selectedIds,
            oldBounds: resizeSession.initialBounds,
            newBounds: previewBounds,
          }
        : null;

    const selectionDrag =
      !selectionResize &&
      isMoving &&
      selectedIds.length > 0 &&
      selectionDragOffsetRef &&
      (selectionDragOffsetRef.current.x !== 0 ||
        selectionDragOffsetRef.current.y !== 0)
        ? {
            offset: selectionDragOffsetRef.current,
            selectedIds,
          }
        : null;

    r.render(
      getVisibleObjects(objects),
      liveStroke,
      c.zoom,
      c.offsetX,
      c.offsetY,
      color,
      size,
      selectionBox,
      displaySelectedBox,
      selectionDrag,
      selectionResize,
      cursors,
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
    set((s) => ({
      selectedBoundingBox: resolveAction(action, s.selectedBoundingBox),
    }));
    scheduleRender(get);
  },

  setSelectedIds: (action) =>
    set((s) => ({ selectedIds: resolveAction(action, s.selectedIds) })),
  setIsDrawing: (value) => set({ isDrawing: value }),
  setIsMoving: (value) => set({ isMoving: value }),
  setIsResizing: (value) => set({ isResizing: value }),
  setIsGrabbing: (value) => set({ isGrabbing: value }),

  setCursors: (action) => {
    set((s) => ({ cursors: resolveAction(action, s.cursors) }));
    scheduleRender(get);
  },

  clearSelection: () => {
    const dragRef = get().selectionDragOffsetRef;
    if (dragRef) dragRef.current = { x: 0, y: 0 };
    const resizeRef = get().selectionResizeSessionRef;
    if (resizeRef) resizeRef.current = null;
    set({
      selectedIds: [],
      selectionBox: null,
      selectedBoundingBox: null,
      isResizing: false,
    });
    scheduleRender(get);
  },
}));
