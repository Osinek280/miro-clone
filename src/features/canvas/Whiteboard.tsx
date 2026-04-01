import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PanelRightOpen } from 'lucide-react';
import { WebGLRenderer } from './WebGLRenderer';
import { DrawModeEnum, type DrawObject, type Point } from './types/types';
import { useCanvasStore } from './hooks/useCanvasStore';
import { useRedrawOnEquationChange } from './hooks/useRedrawOnEquationChange';
import { useCamera } from './hooks/useCamera';
import { useMouseHandlers } from './hooks/mouse/useMouseHandlers';
import Palette from './components/Palette';
import { getCursor } from './utils/cursorUtils';
import Toolbar from './components/Toolbar';
import { Zoom } from './components/Zoom';
import { Grid } from './grid/Grid';
import { useHistoryStore } from './hooks/useHistoryStore';
import { useBoardSync } from './hooks/useBoardSync';
import EquationSidebar from '../desmos/components/EquationSidebar';
import { MathKeyboardOverlay } from '../desmos/components/MathKeyboardOverlay';
import { useEquationStore } from '../desmos/store/useEquationStore';
import { newId } from '../desmos/utils/id';

export default function Whiteboard({
  boardId,
  onSnapshotError,
}: {
  boardId: string;
  onSnapshotError: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const cameraRef = useRef({ zoom: 1, offsetX: 0, offsetY: 0 });
  const targetCameraRef = useRef({ zoom: 1, offsetX: 0, offsetY: 0 });
  const [mode, setMode] = useState<DrawModeEnum>(DrawModeEnum.Draw);
  const [equationSidebarOpen, setEquationSidebarOpen] = useState(true);
  const equationInputFocused = useEquationStore((s) => s.equationInputFocused);
  useRedrawOnEquationChange();

  const history = useHistoryStore();

  const {
    animationFrameRef,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    animateCameraRef,
    displayZoom,
    setDisplayZoom,
  } = useCamera(canvasRef, cameraRef, targetCameraRef);

  const setCenterAtPoint = useCallback(
    (point: Point, zoom: number) => {
      const canvas = canvasRef.current;
      if (!canvas || !rendererRef.current) return;

      const rect = canvas.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const offsetX = centerX - point.x * zoom;
      const offsetY = centerY - point.y * zoom;

      cameraRef.current.zoom = zoom;
      cameraRef.current.offsetX = offsetX;
      cameraRef.current.offsetY = offsetY;

      targetCameraRef.current.zoom = zoom;
      targetCameraRef.current.offsetX = offsetX;
      targetCameraRef.current.offsetY = offsetY;

      setDisplayZoom(zoom);

      useCanvasStore.getState().renderFrame();
    },
    [setDisplayZoom],
  );

  const {
    pushSyncedOperation,
    pushSyncedCursorThrottled,
    publishOperation,
    boardReady,
    replayInitialCamera,
  } = useBoardSync(boardId, setCenterAtPoint, canvasRef, onSnapshotError);

  const { handleMouseDown, handleMouseMove, handleMouseUp } = useMouseHandlers(
    canvasRef,
    cameraRef,
    targetCameraRef,
    mode,
    setMode,
    pushSyncedOperation,
    pushSyncedCursorThrottled,
    boardReady,
  );

  const generateObjects = () => {
    const { objects, setObjects } = useCanvasStore.getState();
    const prev = objects;
    const arr: DrawObject[] = [];

    for (let i = 0; i < 10000; i++) {
      const x = Math.random() * 5000 - 2500;
      const y = Math.random() * 5000 - 2500;

      arr.push({
        id: newId(),
        points: [
          { x, y },
          { x: x + Math.random() * 50, y: y + Math.random() * 50 },
        ],
        type: 'path',
        color: '#0d0d0d',
        tombstone: false,
        positionTimestamp: Date.now(),
        size: 15,
      });
    }

    pushSyncedOperation({
      opId: newId(),
      timestamp: Date.now(),
      type: 'batch',
      operations: [
        {
          opId: newId(),
          timestamp: Date.now(),
          type: 'remove',
          ids: prev.map((o) => o.id),
        },
        {
          opId: newId(),
          timestamp: Date.now(),
          type: 'add',
          objects: arr,
        },
      ],
    });
    setObjects(arr);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new WebGLRenderer();
    if (!renderer.initialize(canvas)) {
      return;
    }

    rendererRef.current = renderer;
    useCanvasStore.getState().setRefs(rendererRef, cameraRef);

    const resizeCanvas = () => {
      renderer.resizeCanvas();
      useCanvasStore.getState().renderFrame();
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      renderer.cleanup();
    };
  }, []);

  useEffect(() => {
    if (!rendererRef.current || !boardReady) return;
    replayInitialCamera();
  }, [rendererRef, boardReady, replayInitialCamera]);

  const animateCamera = useCallback(() => {
    if (animateCameraRef.current) {
      animateCameraRef.current();
    }
  }, [animateCameraRef]);

  useEffect(() => {
    if (animationFrameRef.current === null) {
      const camera = cameraRef.current;
      const target = targetCameraRef.current;
      const zoomDiff = Math.abs(camera.zoom - target.zoom);
      const offsetDiff =
        Math.abs(camera.offsetX - target.offsetX) +
        Math.abs(camera.offsetY - target.offsetY);

      if (zoomDiff > 0.001 || offsetDiff > 0.001) {
        animationFrameRef.current = requestAnimationFrame(animateCamera);
      }
    }

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [animateCamera, animationFrameRef, cameraRef, targetCameraRef]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!boardReady) return;

      const key = e.key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;
      const isUndo = mod && !e.shiftKey && key === 'z';
      const isRedo = (mod && e.shiftKey && key === 'z') || (mod && key === 'y');

      const isDelete = key === 'delete';

      if (!isUndo && !isRedo && !isDelete) return;

      e.preventDefault();

      const store = useCanvasStore.getState();

      if (isDelete) {
        const { objects, selectedIds, setObjects, clearSelection } = store;
        const toRemove = objects.filter((o) => selectedIds.includes(o.id));
        if (toRemove.length > 0) {
          pushSyncedOperation({
            opId: newId(),
            timestamp: Date.now(),
            type: 'remove',
            ids: toRemove.map((o) => o.id),
          });
          setObjects((prev) =>
            prev.map((o) =>
              selectedIds.includes(o.id) ? { ...o, tombstone: true } : o,
            ),
          );
        }
        clearSelection();
        return;
      }

      const current = store.objects;

      if (isUndo) {
        const res = history.undo(current);
        if (res) {
          useCanvasStore.getState().setObjects(res.nextChildren);
          publishOperation(res.appliedOp);
        }
      } else if (isRedo) {
        const res = history.redo(current);
        if (res) {
          useCanvasStore.getState().setObjects(res.nextChildren);
          publishOperation(res.appliedOp);
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [history, boardReady, publishOperation, pushSyncedOperation]);

  return (
    <div className="flex h-full w-full min-h-0 bg-gray-100">
      <div className="relative min-h-0 min-w-0 flex-1">
        <div className="relative h-full min-h-0 min-w-0 w-full">
          <div className="absolute top-4 left-4 z-40 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!boardReady}
              onClick={generateObjects}
              className="px-4 py-2 rounded bg-amber-500 text-white cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
            >
              Generate 10k objects
            </button>
          </div>

          <Zoom
            handleZoomIn={handleZoomIn}
            handleZoomOut={handleZoomOut}
            handleZoomReset={handleZoomReset}
            displayZoom={displayZoom}
          />

          <Toolbar mode={mode} setMode={setMode} />

          {equationInputFocused ? <MathKeyboardOverlay /> : <Palette />}

          {boardReady && <Grid cameraRef={cameraRef} style="axes" />}

          {!boardReady && (
            <div
              className="absolute inset-0 z-11 flex items-center justify-center bg-gray-100/85 backdrop-blur-[2px] pointer-events-none"
              aria-busy="true"
              aria-live="polite"
            >
              <div className="flex flex-col items-center gap-4">
                <div
                  className="h-11 w-11 rounded-full border-2 border-gray-300 border-t-indigo-500 animate-spin motion-reduce:animate-none"
                  aria-hidden
                />
                <p className="text-sm font-medium text-gray-600 animate-pulse motion-reduce:animate-none">
                  Loading board…
                </p>
              </div>
            </div>
          )}

          <canvas
            ref={canvasRef}
            className="h-full w-full"
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 10,
              cursor: boardReady ? getCursor(mode) : 'wait',
              touchAction: 'none',
              pointerEvents: boardReady ? 'auto' : 'none',
            }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              handleMouseDown(
                e as unknown as React.MouseEvent<HTMLCanvasElement>,
              );
            }}
            onPointerMove={(e) =>
              handleMouseMove(
                e as unknown as React.MouseEvent<HTMLCanvasElement>,
              )
            }
            onPointerUp={(e) =>
              handleMouseUp(e as unknown as React.MouseEvent<HTMLCanvasElement>)
            }
            onPointerLeave={(e) =>
              handleMouseUp(e as unknown as React.MouseEvent<HTMLCanvasElement>)
            }
          />
        </div>

        {!equationSidebarOpen && (
          <button
            type="button"
            onClick={() => setEquationSidebarOpen(true)}
            className="absolute cursor-pointer top-1/2 right-0 z-40 flex h-24 w-9 -translate-y-1/2 items-center justify-center rounded-l-md border border-gray-200 bg-white text-gray-600 shadow-md transition-colors hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-expanded={false}
            aria-label="Show Equations"
          >
            <PanelRightOpen className="size-5 shrink-0" aria-hidden />
          </button>
        )}
      </div>

      <EquationSidebar
        title="Equations"
        open={equationSidebarOpen}
        onOpenChange={setEquationSidebarOpen}
      />
    </div>
  );
}
