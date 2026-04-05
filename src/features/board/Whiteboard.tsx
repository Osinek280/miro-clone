import React, { useEffect, useRef, useState, useCallback } from 'react';
import { WebGLRenderer } from './WebGLRenderer';
import { DrawModeEnum, type DrawObject, type Point } from './types/types';
import { useCamera } from './hooks/useCamera';
import { useMouseHandlers } from './hooks/mouse/useMouseHandlers';
import Palette from './components/Palette';
import { getCursor } from './utils/cursorUtils';
import Toolbar from './components/Toolbar';
import { Zoom } from './components/Zoom';
// import { Grid } from './grid/Grid';
import { useBoardSync } from './hooks/useBoardSync';
import { usePasteImage } from './hooks/usePasteImage';
import { useHistoryStore } from './store/useHistoryStore';
import { useCanvasStore } from './store/useCanvasStore';

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

  const { objects, setObjects, color, size, setColor, setSize } =
    useCanvasStore();

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

  usePasteImage(canvasRef, cameraRef, boardReady, pushSyncedOperation);

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
    const prev = objects;
    const arr: DrawObject[] = [];

    for (let i = 0; i < 10000; i++) {
      const x = Math.random() * 5000 - 2500;
      const y = Math.random() * 5000 - 2500;

      arr.push({
        id: crypto.randomUUID(),
        points: [
          { x, y },
          { x: x + Math.random() * 50, y: y + Math.random() * 50 },
        ],
        type: 'PATH',
        color: '#0d0d0d',
        tombstone: false,
        positionTimestamp: Date.now(),
        size: 15,
      });
    }

    pushSyncedOperation({
      opId: crypto.randomUUID(),
      timestamp: Date.now(),
      type: 'batch',
      operations: [
        {
          opId: crypto.randomUUID(),
          timestamp: Date.now(),
          type: 'remove',
          ids: prev.map((o) => o.id),
        },
        {
          opId: crypto.randomUUID(),
          timestamp: Date.now(),
          type: 'add',
          objects: arr,
        },
      ],
    });
    setObjects(arr);
  };

  // Initialize WebGL
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new WebGLRenderer();
    if (!renderer.initialize(canvas)) {
      return;
    }

    rendererRef.current = renderer;
    useCanvasStore.getState().setRefs(rendererRef, cameraRef);

    // Set up resize handler
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

  // Start animation loop if needed
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
            opId: crypto.randomUUID(),
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
    <div className="w-full h-full relative bg-gray-100">
      <div className="absolute top-4 left-4 flex gap-2 flex-wrap z-40">
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

      <Palette
        color={color}
        size={size}
        setColor={setColor}
        setSize={setSize}
      />

      {/* {boardReady && <Grid cameraRef={cameraRef} />} */}

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
              Ładowanie planszy…
            </p>
          </div>
        </div>
      )}

      <canvas
        ref={canvasRef}
        tabIndex={boardReady ? 0 : -1}
        className="w-full h-full outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 focus-visible:ring-offset-2"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 10,
          cursor: boardReady ? getCursor(mode) : 'wait',
          touchAction: 'none',
          pointerEvents: boardReady ? 'auto' : 'none',
        }}
        onPointerDown={(e) => {
          e.currentTarget.focus({ preventScroll: true });
          e.currentTarget.setPointerCapture(e.pointerId);
          handleMouseDown(e as unknown as React.MouseEvent<HTMLCanvasElement>);
        }}
        onPointerMove={(e) =>
          handleMouseMove(e as unknown as React.MouseEvent<HTMLCanvasElement>)
        }
        onPointerUp={(e) =>
          handleMouseUp(e as unknown as React.MouseEvent<HTMLCanvasElement>)
        }
        onPointerLeave={(e) =>
          handleMouseUp(e as unknown as React.MouseEvent<HTMLCanvasElement>)
        }
      />
    </div>
  );
}
