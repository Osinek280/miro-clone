import { useEffect, useRef, useState, useCallback } from 'react';
import { WebGLRenderer } from './WebGLRenderer';
import { DrawModeEnum, type DrawObject } from './types/types';
import { useRender } from './hooks/useRenderer';
import { useCamera } from './hooks/useCamera';
import { useMouseHandlers } from './hooks/useMouseHandlers';
import Palette from './components/Palette';
import { getCursor } from './utils/cursorUtils';
import Toolbar from './components/Toolbar';
import { Zoom } from './components/Zoom';
import { Grid } from './grid/Grid';
import SelectionToolbar from './components/SelectionToolbar';
import { useHistoryStore } from './hooks/useHistoryStore';

export default function Whiteboard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const cameraRef = useRef({ zoom: 1, offsetX: 0, offsetY: 0 });
  const targetCameraRef = useRef({ zoom: 1, offsetX: 0, offsetY: 0 });
  const [mode, setMode] = useState<DrawModeEnum>(DrawModeEnum.Draw);

  const { renderFrame, state } = useRender(rendererRef, cameraRef);
  const history = useHistoryStore();

  const {
    animationFrameRef,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    animateCameraRef,
    displayZoom,
  } = useCamera(canvasRef, cameraRef, targetCameraRef, renderFrame);

  const { handleMouseDown, handleMouseMove, handleMouseUp } = useMouseHandlers(
    canvasRef,
    cameraRef,
    targetCameraRef,
    renderFrame,
    state,
    mode,
    setMode
  );

  const generateObjects = () => {
    const prev = state.objects;
    const arr: DrawObject[] = [];

    for (let i = 0; i < 10000; i++) {
      const x = Math.random() * 5000 - 2500;
      const y = Math.random() * 5000 - 2500;

      arr.push({
        id: `obj-${i}`,
        points: [
          { x, y },
          { x: x + Math.random() * 50, y: y + Math.random() * 50 },
        ],
        type: 'path',
        color: '#0d0d0d',
        size: 15,
      });
    }

    history.pushOperation({
      type: 'batch',
      operations: [
        { type: 'remove', objects: prev },
        { type: 'addMany', objects: arr },
      ],
    });
    state.setObjects(arr);
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
    const canvas = canvasRef.current;
    if (!canvas || !rendererRef.current) return;

    // Pobierz wymiary canvasa
    const rect = canvas.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Set initial camera offset so (0,0) is at center
    cameraRef.current.offsetX = centerX;
    cameraRef.current.offsetY = centerY;

    // Update targetCameraRef so animation doesn't move the camera
    targetCameraRef.current.offsetX = centerX;
    targetCameraRef.current.offsetY = centerY;
  }, []);

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

  const { color, size, setColor, setSize, selectedBoundingBox } = state;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;
      const isUndo = mod && !e.shiftKey && key === 'z';
      const isRedo =
        (mod && e.shiftKey && key === 'z') || (mod && key === 'y');

      if (!isUndo && !isRedo) return;

      e.preventDefault();

      const current = state.objects;

      if (isUndo) {
        const prev = history.undo(current);
        if (prev) state.setObjects(prev);
      } else if (isRedo) {
        const next = history.redo(current);
        if (next) state.setObjects(next);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [history, state.objects, state.setObjects]);

  return (
    <div className="w-full h-full relative bg-gray-100">
      <div className="absolute top-4 left-4 z-10 flex gap-2 flex-wrap z-40">
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

      {selectedBoundingBox && (
        <SelectionToolbar
          selectedBoundingBox={selectedBoundingBox}
          cameraRef={cameraRef}
          canvasRef={canvasRef}
        />
      )}

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
