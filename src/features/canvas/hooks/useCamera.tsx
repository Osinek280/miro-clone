import { useCallback, useEffect, useRef, useState } from "react";
import type { Camera, DrawObject, Point, ToolState } from "../types/types";
import type { WebGLRenderer } from "../WebGLRenderer";
import { screenToWorld as utilScreenToWorld } from "../utils/cameraUtils";
import {
  CAMERA_LERP_SPEED,
  CAMERA_THRESHOLD,
  ZOOM_MIN,
  ZOOM_MAX,
  ZOOM_BUTTON_FACTOR,
  TRACKPAD_ZOOM_FACTOR,
  MOUSE_ZOOM_FACTOR,
  ZOOM_CHANGE_EPSILON,
  ZOOM_DISPLAY_PRECISION,
} from "../constants/cameraConstants";

export function useCamera(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  rendererRef: React.RefObject<WebGLRenderer | null>,
  objectsRef: React.RefObject<DrawObject[]>,
  currentPathRef: React.RefObject<Point[]>,
  toolStateRef: React.RefObject<ToolState>,
) {
  const cameraRef = useRef<Camera>({ zoom: 1, offsetX: 0, offsetY: 0 });
  const targetCameraRef = useRef<Camera>({ zoom: 1, offsetX: 0, offsetY: 0 });
  const animationFrameRef = useRef<number | null>(null);

  const [displayZoom, setDisplayZoom] = useState(1.0);

  const animateCameraRef = useRef<() => void>(() => {
    const camera = cameraRef.current;
    const target = targetCameraRef.current;
    const zoomDiff = Math.abs(camera.zoom - target.zoom);
    const offsetDiff =
      Math.abs(camera.offsetX - target.offsetX) +
      Math.abs(camera.offsetY - target.offsetY);

    if (zoomDiff > CAMERA_LERP_SPEED || offsetDiff > CAMERA_THRESHOLD) {
      camera.zoom += (target.zoom - camera.zoom) * CAMERA_LERP_SPEED;
      camera.offsetX += (target.offsetX - camera.offsetX) * CAMERA_LERP_SPEED;
      camera.offsetY += (target.offsetY - camera.offsetY) * CAMERA_LERP_SPEED;

      setDisplayZoom(
        Math.round(camera.zoom * ZOOM_DISPLAY_PRECISION) /
          ZOOM_DISPLAY_PRECISION,
      );

      // render
      if (rendererRef.current) {
        rendererRef.current.render(
          objectsRef.current,
          currentPathRef.current,
          camera.zoom,
          camera.offsetX,
          camera.offsetY,
          toolStateRef.current.color,
          toolStateRef.current.size,
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
      setDisplayZoom(
        Math.round(camera.zoom * ZOOM_DISPLAY_PRECISION) /
          ZOOM_DISPLAY_PRECISION,
      );

      if (rendererRef.current) {
        rendererRef.current.render(
          objectsRef.current,
          currentPathRef.current,
          camera.zoom,
          camera.offsetX,
          camera.offsetY,
          toolStateRef.current.color,
          toolStateRef.current.size,
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // przenieś tutaj logikę z handleWheel
      const delta = e.deltaY;
      const isTrackpad = Math.abs(delta) < 50;
      const zoomFactor = isTrackpad ? TRACKPAD_ZOOM_FACTOR : MOUSE_ZOOM_FACTOR;
      const zoomMultiplier = delta > 0 ? 1 / zoomFactor : zoomFactor;
      const currentZoom = cameraRef.current.zoom;
      let newZoom = currentZoom * zoomMultiplier;
      newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newZoom));
      if (Math.abs(newZoom - currentZoom) > ZOOM_CHANGE_EPSILON) {
        zoomTowardPoint(e.clientX, e.clientY, newZoom);
      }
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [canvasRef, zoomTowardPoint]);

  const handleZoomIn = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const camera = cameraRef.current;
    const newZoom = Math.min(ZOOM_MAX, camera.zoom * ZOOM_BUTTON_FACTOR);
    zoomTowardPoint(centerX, centerY, newZoom); // Smooth zoom for buttons too
  };

  const handleZoomOut = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const camera = cameraRef.current;
    const newZoom = Math.max(ZOOM_MIN, camera.zoom / ZOOM_BUTTON_FACTOR);
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
