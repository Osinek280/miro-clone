import React, { useEffect, useRef, useState, useCallback } from 'react';
import { WebGLRenderer } from './WebGLRenderer';
import { DrawModeEnum, type DrawObject, type Point } from './types/types';
import { useCanvasStore } from './hooks/useCanvasStore';
import { useCamera } from './hooks/useCamera';
import { useMouseHandlers } from './hooks/mouse/useMouseHandlers';
import Palette from './components/Palette';
import { getCursor } from './utils/cursorUtils';
import Toolbar from './components/Toolbar';
import { Zoom } from './components/Zoom';
import { Grid } from './grid/Grid';
import { useHistoryStore } from './hooks/useHistoryStore';
import { useBoardSync } from './hooks/useBoardSync';

export default function Whiteboard({ boardId }: { boardId: string }) {
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

  const { pushSyncedOperation, pushSyncedCursorThrottled } = useBoardSync(
    boardId,
    setCenterAtPoint,
  );

  const { handleMouseDown, handleMouseMove, handleMouseUp } = useMouseHandlers(
    canvasRef,
    cameraRef,
    targetCameraRef,
    mode,
    setMode,
    pushSyncedOperation,
    pushSyncedCursorThrottled,
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
        type: 'path',
        color: '#0d0d0d',
        tombstone: false,
        positionTimestamp: Date.now(),
        size: 15,
      });
    }

    pushSyncedOperation({
      type: 'batch',
      operations: [
        { type: 'remove', objects: prev },
        { type: 'add', objects: arr },
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
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      renderer.cleanup();
    };
  }, []);

  useEffect(() => {
    console.log(objects);
  }, [objects]);

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
          history.pushOperation({ type: 'remove', objects: toRemove });
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
        const prev = history.undo(current);
        if (prev) useCanvasStore.getState().setObjects(prev);
      } else if (isRedo) {
        const next = history.redo(current);
        if (next) useCanvasStore.getState().setObjects(next);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [history]);

  return (
    <div className="w-full h-full relative bg-gray-100">
      <div className="absolute top-4 left-4 flex gap-2 flex-wrap z-40">
        <button
          onClick={generateObjects}
          className="px-4 py-2 rounded bg-amber-500 text-white cursor-pointer"
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

      <Grid cameraRef={cameraRef} style="grid"></Grid>

      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 10,
          cursor: getCursor(mode),
          touchAction: 'none',
        }}
        onPointerDown={(e) => {
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
