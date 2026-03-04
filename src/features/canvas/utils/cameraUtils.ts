import type { RefObject } from "react";
import type { Camera, DrawObject, Point } from "../types/types";

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

export function isPointOnPath(
  point: Point,
  path: Point[],
  threshold: number = 5,
): boolean {
  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i];
    const p2 = path[i + 1];

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length === 0) continue;

    const t = Math.max(
      0,
      Math.min(
        1,
        ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / (length * length),
      ),
    );
    const proj = {
      x: p1.x + t * dx,
      y: p1.y + t * dy,
    };

    const dist = Math.sqrt((point.x - proj.x) ** 2 + (point.y - proj.y) ** 2);
    if (dist < threshold) return true;
  }
  return false;
}

export function findObjectAtPoint(
  point: Point,
  objects: DrawObject[],
): DrawObject | null {
  for (let i = objects.length - 1; i >= 0; i--) {
    if (isPointOnPath(point, objects[i].points)) {
      return objects[i];
    }
  }
  return null;
}
