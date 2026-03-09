import type { RefObject } from "react";
import type { Camera, Point } from "../types/types";

export function screenToWorld(
  screenX: number,
  screenY: number,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  camera: Camera,
): Point {
  const canvas = canvasRef.current;
  if (!canvas) return { x: 0, y: 0 };
  const rect = canvas.getBoundingClientRect();
  return {
    x: (screenX - rect.left - camera.offsetX) / camera.zoom,
    y: (screenY - rect.top - camera.offsetY) / camera.zoom,
  };
}

export function worldToScreen(
  worldX: number,
  worldY: number,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  camera: Camera,
): Point {
  const canvas = canvasRef.current;
  if (!canvas) return { x: 0, y: 0 };
  const rect = canvas.getBoundingClientRect();
  return {
    x: worldX * camera.zoom + camera.offsetX + rect.left,
    y: worldY * camera.zoom + camera.offsetY + rect.top,
  };
}

export function getCanvasPoint(
  e: React.MouseEvent<HTMLCanvasElement> | MouseEvent,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  camera: Camera,
): Point {
  return screenToWorld(e.clientX, e.clientY, canvasRef, camera);
}
