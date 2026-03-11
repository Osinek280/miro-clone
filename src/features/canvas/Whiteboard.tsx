import { useEffect, useRef, useState, useCallback } from "react";
import { WebGLRenderer } from "./WebGLRenderer";
import {
  DrawModeEnum,
  type DrawObject,
  type Point,
  type SelectionBox,
  type ToolState,
} from "./types/types";
import { useCamera } from "./hooks/useCamera";
import { useMouseHandlers } from "./hooks/useMouseHandlers";
import Palette from "./components/Palette";
import { usePalette } from "./components/usePalette";
import { getCursor } from "./utils/cursorUtils";
import Toolbar from "./components/Toolbar";
import { Zoom } from "./components/Zoom";
import { Grid } from "./grid/Grid";

export default function Whiteboard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const [objects, setObjects] = useState<DrawObject[]>([]);
  const [mode, setMode] = useState<DrawModeEnum>(DrawModeEnum.Draw);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);
  const objectsRef = useRef(objects);
  const currentPathRef = useRef(currentPath);
  const selectionBoxRef = useRef<SelectionBox>(null);
  const selectedBoundingBoxRef = useRef<SelectionBox>(null);

  const tsRef = useRef<ToolState>({
    // ts -> tool settings
    color: "#000",
    size: 10,
  });

  const { color, size, setColor, setSize } = usePalette(tsRef, mode, setMode);

  const {
    cameraRef,
    targetCameraRef,
    animationFrameRef,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    animateCameraRef,
    displayZoom,
  } = useCamera(
    canvasRef,
    rendererRef,
    objectsRef,
    currentPathRef,
    tsRef,
    selectionBoxRef,
    selectedBoundingBoxRef,
  );

  const {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    selectionBox,
    selectedBoundingBox,
  } = useMouseHandlers(
    canvasRef,
    cameraRef,
    targetCameraRef,
    rendererRef,
    objects,
    setObjects,
    setCurrentPath,
    currentPath,
    color,
    size,
    mode,
    setMode,
    selectionBoxRef,
    selectedBoundingBoxRef,
  );

  const generateObjects = () => {
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
        type: "path",
        color: "#0d0d0d",
        size: 15,
      });
    }

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

    // Set up resize handler
    const resizeCanvas = () => {
      renderer.resizeCanvas();
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
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

    // Ustaw początkowy offset kamery, aby (0,0) było na środku
    cameraRef.current.offsetX = centerX;
    cameraRef.current.offsetY = centerY;

    // Zaktualizuj targetCameraRef, żeby animacja nie przesunęła kamery
    targetCameraRef.current.offsetX = centerX;
    targetCameraRef.current.offsetY = centerY;
  }, []);

  useEffect(() => {
    objectsRef.current = objects;
    currentPathRef.current = currentPath;
  }, [objects, currentPath]);

  useEffect(() => {
    selectionBoxRef.current = selectionBox;
    selectedBoundingBoxRef.current = selectedBoundingBox;
  }, [selectionBox, selectedBoundingBox]);

  const animateCamera = useCallback(() => {
    if (animateCameraRef.current) {
      animateCameraRef.current();
    }
  }, [animateCameraRef]);

  // Render function
  const render = useCallback(() => {
    if (!rendererRef.current) return;
    const camera = cameraRef.current;
    rendererRef.current.render(
      objects,
      currentPath,
      camera.zoom,
      camera.offsetX,
      camera.offsetY,
      color,
      size,
      selectionBox,
      selectedBoundingBox,
    );
  }, [
    objects,
    currentPath,
    cameraRef,
    color,
    size,
    selectionBox,
    selectedBoundingBox,
  ]);

  // Render on changes
  useEffect(() => {
    render();
  }, [render]);

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

  return (
    <div className="w-full h-full relative bg-gray-100">
      <div className="absolute top-4 left-4 z-10 flex gap-2 flex-wrap">
        <button
          onClick={generateObjects}
          className="px-4 py-2 rounded bg-amber-500 text-white"
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
          position: "absolute",
          inset: 0,
          zIndex: 1,
          cursor: getCursor(mode),
          touchAction: "none",
        }}
        onPointerDown={(e) =>
          handleMouseDown(e as unknown as React.MouseEvent<HTMLCanvasElement>)
        }
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
