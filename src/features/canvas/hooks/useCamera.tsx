import { useCallback, useRef, useState } from "react";
import type { Camera, DrawObject, Point } from "../types/types";
import type { WebGLRenderer } from "../WebGLRenderer";
import { screenToWorld as utilScreenToWorld } from "../utils/cameraUtils";

export function useCamera(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  rendererRef: React.RefObject<WebGLRenderer | null>,
  objectsRef: React.RefObject<DrawObject[]>,
  currentPathRef: React.RefObject<Point[]>,
) {
  const cameraRef = useRef<Camera>({ zoom: 1, offsetX: 0, offsetY: 0 });
  const targetCameraRef = useRef<Camera>({ zoom: 1, offsetX: 0, offsetY: 0 });
  const animationFrameRef = useRef<number | null>(null);

  const [displayZoom, setDisplayZoom] = useState(1.0);

  const animateCameraRef = useRef<() => void>(() => {
    const camera = cameraRef.current;
    const target = targetCameraRef.current;
    const LERP_SPEED = 0.25;
    const zoomDiff = Math.abs(camera.zoom - target.zoom);
    const offsetDiff =
      Math.abs(camera.offsetX - target.offsetX) +
      Math.abs(camera.offsetY - target.offsetY);
    const threshold = 0.001;

    if (zoomDiff > threshold || offsetDiff > threshold) {
      camera.zoom += (target.zoom - camera.zoom) * LERP_SPEED;
      camera.offsetX += (target.offsetX - camera.offsetX) * LERP_SPEED;
      camera.offsetY += (target.offsetY - camera.offsetY) * LERP_SPEED;

      setDisplayZoom(Math.round(camera.zoom * 100) / 100);

      // render
      if (rendererRef.current) {
        rendererRef.current.render(
          objectsRef.current,
          currentPathRef.current,
          camera.zoom,
          camera.offsetX,
          camera.offsetY,
        );
      }

      animationFrameRef.current = requestAnimationFrame(
        animateCameraRef.current,
      );
    } else {
      // snap
      camera.zoom = target.zoom;
      camera.offsetX = target.offsetX;
      camera.offsetY = target.offsetY;
      setDisplayZoom(Math.round(camera.zoom * 100) / 100);

      if (rendererRef.current) {
        rendererRef.current.render(
          objectsRef.current,
          currentPathRef.current,
          camera.zoom,
          camera.offsetX,
          camera.offsetY,
        );
      }

      animationFrameRef.current = null;
    }
  });

  const animateCamera = useCallback(() => {
    if (animateCameraRef.current) animateCameraRef.current();
  }, []);

  // Zoom w stronę punktu
  const zoomTowardPoint = useCallback(
    (screenX: number, screenY: number, newZoom: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const camera = cameraRef.current;

      const rect = canvas.getBoundingClientRect();
      const screenPointX = screenX - rect.left;
      const screenPointY = screenY - rect.top;

      const worldX = (screenPointX - camera.offsetX) / camera.zoom;
      const worldY = (screenPointY - camera.offsetY) / camera.zoom;

      const newOffsetX = screenPointX - worldX * newZoom;
      const newOffsetY = screenPointY - worldY * newZoom;

      targetCameraRef.current = {
        zoom: newZoom,
        offsetX: newOffsetX,
        offsetY: newOffsetY,
      };

      if (animationFrameRef.current === null) {
        animationFrameRef.current = requestAnimationFrame(animateCamera);
      }
    },
    [animateCamera, canvasRef],
  );

  const worldToScreen = useCallback(
    (worldX: number, worldY: number) => {
      const canvas = canvasRef.current;
      const camera = cameraRef.current;
      if (!canvas || !camera) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: worldX * camera.zoom + camera.offsetX + rect.left,
        y: worldY * camera.zoom + camera.offsetY + rect.top,
      };
    },
    [canvasRef, cameraRef],
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      e.stopPropagation();

      const camera = cameraRef.current;
      const currentZoom = camera.zoom;

      const delta = e.deltaY;
      const isTrackpad = Math.abs(delta) < 50;
      const zoomFactor = isTrackpad ? 1.02 : 1.15;
      const zoomMultiplier = delta > 0 ? 1 / zoomFactor : zoomFactor;

      let newZoom = currentZoom * zoomMultiplier;
      newZoom = Math.max(0.01, Math.min(4.0, newZoom));

      if (Math.abs(newZoom - currentZoom) > 0.0001) {
        zoomTowardPoint(e.clientX, e.clientY, newZoom);
      }
    },
    [zoomTowardPoint],
  );

  const handleZoomIn = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const camera = cameraRef.current;
    const newZoom = Math.min(4.0, camera.zoom * 1.2);
    zoomTowardPoint(centerX, centerY, newZoom); // Smooth zoom for buttons too
  };

  const handleZoomOut = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const camera = cameraRef.current;
    const newZoom = Math.max(0.01, camera.zoom / 1.2);
    zoomTowardPoint(centerX, centerY, newZoom);
  };

  const handleZoomReset = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    zoomTowardPoint(centerX, centerY, 1.0);
  };

  const screenToWorld = useCallback(
    (x: number, y: number) =>
      utilScreenToWorld(x, y, canvasRef, cameraRef.current),
    [canvasRef, cameraRef],
  );

  return {
    worldToScreen,
    screenToWorld,
    handleWheel,
    cameraRef,
    targetCameraRef,
    displayZoom,
    setDisplayZoom,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    animationFrameRef,
    animateCameraRef,
  };
}
