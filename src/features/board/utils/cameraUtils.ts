import type { RefObject } from 'react';
import type { Camera, Point } from '../types/types';
import { POINT_SCALE } from '../constants/pointPrecision';

export function roundPoint(p: Point): Point {
  return {
    x: Math.round(p.x * POINT_SCALE) / POINT_SCALE,
    y: Math.round(p.y * POINT_SCALE) / POINT_SCALE,
  };
}

/** Client (viewport) coordinates → world space using the same mapping as pointer drawing. */
export function clientToWorldPoint(
  clientX: number,
  clientY: number,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  camera: Camera,
): Point {
  const canvas = canvasRef.current;
  if (!canvas) return { x: 0, y: 0 };
  const rect = canvas.getBoundingClientRect();
  return roundPoint({
    x: (clientX - rect.left - camera.offsetX) / camera.zoom,
    y: (clientY - rect.top - camera.offsetY) / camera.zoom,
  });
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
  return clientToWorldPoint(e.clientX, e.clientY, canvasRef, camera);
}

/**
 * Inverse of Whiteboard `setCenterAtPoint`: live camera + canvas → world center and zoom
 * for API snapshot/POST (offsetX/offsetY on the wire are world space, not pan offsets).
 * Uses `getBoundingClientRect()` dimensions like `setCenterAtPoint`, not `canvas.width`.
 */
export function cameraCanvasToPersistedCamera(
  camera: Camera,
  canvas: HTMLCanvasElement,
): Camera | null {
  const rect = canvas.getBoundingClientRect();
  const halfW = rect.width / 2;
  const halfH = rect.height / 2;
  if (halfW <= 0 || halfH <= 0) return null;
  return {
    offsetX: (halfW - camera.offsetX) / camera.zoom,
    offsetY: (halfH - camera.offsetY) / camera.zoom,
    zoom: camera.zoom,
  };
}
