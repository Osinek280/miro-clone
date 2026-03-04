import { useEffect, useRef, useState, useCallback } from "react";
import { WebGLRenderer } from "./WebGLRenderer";
import type { DrawObject, Point } from "./types/types";
import { useCamera } from "./hooks/useCamera";
import { useMouseHandlers } from "./hooks/useMouseHandlers";

export default function Whiteboard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const [objects, setObjects] = useState<DrawObject[]>([]);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);
  const [mode, setMode] = useState<"draw" | "select">("draw");

  const objectsRef = useRef(objects);
  const currentPathRef = useRef(currentPath);

  const {
    worldToScreen,
    cameraRef,
    targetCameraRef,
    animationFrameRef,
    handleWheel,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    animateCameraRef,
    displayZoom,
  } = useCamera(canvasRef, rendererRef, objectsRef, currentPathRef);

  const {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    selectionBox,
    selectedObjectId,
    setSelectedObjectId,
  } = useMouseHandlers(
    canvasRef,
    cameraRef,
    objects,
    setObjects,
    setCurrentPath,
    currentPath,
    mode,
  );

  // Deselect all objects when mode changes to draw
  useEffect(() => {
    if (mode === "draw") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setObjects((prev) => prev.map((o) => ({ ...o, selected: false })));
      setSelectedObjectId(null);
    }
  }, [mode, setSelectedObjectId]);

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
    objectsRef.current = objects;
    currentPathRef.current = currentPath;
  }, [objects, currentPath]);

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
    );
  }, [objects, currentPath, cameraRef]);

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
          onClick={() => setMode("draw")}
          className={`px-4 py-2 rounded ${mode === "draw" ? "bg-blue-500 text-white" : "bg-white text-gray-700"}`}
        >
          Draw
        </button>
        <button
          onClick={() => setMode("select")}
          className={`px-4 py-2 rounded ${mode === "select" ? "bg-blue-500 text-white" : "bg-white text-gray-700"}`}
        >
          Select
        </button>
        {selectedObjectId && (
          <button
            onClick={() => {
              setObjects((prev) =>
                prev.filter((o) => o.id !== selectedObjectId),
              );
              setSelectedObjectId(null);
            }}
            className="px-4 py-2 rounded bg-red-500 text-white"
          >
            Delete
          </button>
        )}
      </div>
      <div className="absolute top-4 right-4 z-10 flex gap-2 items-center bg-white rounded shadow-lg px-3 py-2">
        <button
          onClick={handleZoomOut}
          disabled={displayZoom <= 0.01}
          className="px-3 py-1 rounded bg-gray-200 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300"
        >
          −
        </button>
        <span className="px-3 py-1 text-sm font-medium text-gray-700 min-w-15 text-center">
          {Math.round(displayZoom * 100)}%
        </span>
        <button
          onClick={handleZoomIn}
          disabled={displayZoom >= 4.0}
          className="px-3 py-1 rounded bg-gray-200 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300"
        >
          +
        </button>
        <button
          onClick={handleZoomReset}
          className="px-3 py-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300 text-xs"
        >
          Reset
        </button>
      </div>
      {selectionBox && (
        <div
          style={{
            position: "fixed",
            left: Math.min(
              worldToScreen(selectionBox.start.x, selectionBox.start.y).x,
              worldToScreen(selectionBox.end.x, selectionBox.end.y).x,
            ),
            top: Math.min(
              worldToScreen(selectionBox.start.x, selectionBox.start.y).y,
              worldToScreen(selectionBox.end.x, selectionBox.end.y).y,
            ),
            width: Math.abs(
              worldToScreen(selectionBox.end.x, selectionBox.end.y).x -
                worldToScreen(selectionBox.start.x, selectionBox.start.y).x,
            ),
            height: Math.abs(
              worldToScreen(selectionBox.end.x, selectionBox.end.y).y -
                worldToScreen(selectionBox.start.x, selectionBox.start.y).y,
            ),
            border: "2px solid #3b82f6",
            backgroundColor: "rgba(59, 130, 246, 0.1)",
            pointerEvents: "none",
            zIndex: 5,
          }}
        />
      )}
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{
          cursor: `url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABEAAAARCAQAAACRZI9xAAAA1ElEQVR4Xq3NPQ4BURQF4FMgUfjZAi16jdYiKEWYQoRZAEOhkRGS1yhIRJjMLEEjmUb0ViER9SRy5GUiPPN07inPd+8FtMMEi0zruxBkaJ1EYDP3C6RodRyw7AczLWKave0SlCn7gR15Jy/Yq5uoHkJ0Fix8g2HXAfOXEHUcDphQwaC3D7cl2i5pKW8+gcx0zX4EmLs3MFyOmPkrANgYbt6grQGxxzx1VUAW6rBwEi/Q8jiOAIA1w5V18m7utADgpHJser54LGhoAUCTE9ZZYlxbA3gCk6KrqV6OZIIAAAAASUVORK5CYII=") 1 16, auto`,
          touchAction: "none",
        }}
        onPointerDown={(e) => {
          e.preventDefault();
          handleMouseDown(e as unknown as React.MouseEvent<HTMLCanvasElement>);
        }}
        onPointerMove={(e) => {
          e.preventDefault();
          handleMouseMove(e as unknown as React.MouseEvent<HTMLCanvasElement>);
        }}
        onPointerUp={(e) => {
          e.preventDefault();
          handleMouseUp();
        }}
        onPointerLeave={(e) => {
          e.preventDefault();
          handleMouseUp();
        }}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />
    </div>
  );
}
