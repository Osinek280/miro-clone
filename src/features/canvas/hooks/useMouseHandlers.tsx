import { useEffect, useRef, useState } from "react";
import {
  DrawModeEnum,
  type Camera,
  type DrawObject,
  type Point,
} from "../types/types";
import { getCanvasPoint } from "../utils/cameraUtils";
import { calcBoundingBox, findObjectAtPoint } from "../utils/objectUtils";
import type { WebGLRenderer } from "../WebGLRenderer";

export function useMouseHandlers(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  cameraRef: React.RefObject<Camera>,
  targetCameraRef: React.RefObject<Camera>, // <-- dodaj
  rendererRef: React.RefObject<WebGLRenderer | null>, // <-- dodaj
  objects: DrawObject[],
  setObjects: React.Dispatch<React.SetStateAction<DrawObject[]>>,
  setCurrentPath: React.Dispatch<React.SetStateAction<Point[]>>,
  currentPath: Point[],
  currentColor: string,
  currentSize: number,
) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isMoving, setIsMoving] = useState(false);
  const lastMousePosRef = useRef<Point>({ x: 0, y: 0 });
  const [isDrawing, setIsDrawing] = useState(false);
  const [mode, setMode] = useState<DrawModeEnum>(DrawModeEnum.Draw);
  const [selectedBoundingBox, setSelectedBoundingBox] = useState<{
    start: Point;
    end: Point;
  } | null>(null);

  const prevModeRef = useRef<DrawModeEnum>(DrawModeEnum.Draw);
  const isGrabbingRef = useRef(false);

  const [selectionBox, setSelectionBox] = useState<{
    start: Point;
    end: Point;
  } | null>(null);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getCanvasPoint(e, canvasRef, cameraRef.current);

    if (e.button === 1) {
      prevModeRef.current = mode;
      setMode(DrawModeEnum.Grab);
      isGrabbingRef.current = true;
      return;
    }

    if (mode === DrawModeEnum.Select) {
      const obj = findObjectAtPoint(point, objects, cameraRef.current.zoom);
      if (obj) {
        // If object is already selected, just start moving without resetting selection
        if (!selectedIds.includes(obj.id)) {
          // If object is not selected, select it (and deselect others)
          setSelectedIds((prev) => [...prev, obj.id]);
          setObjects((prev) =>
            prev.map((o) => ({ ...o, selected: o.id === obj.id })),
          );
        }
        setIsMoving(true);

        // Store the current mouse position for delta calculation
        lastMousePosRef.current = point;
      } else {
        // Start box selection
        setSelectionBox({ start: point, end: point });
        setSelectedIds([]);
        setObjects((prev) => prev.map((o) => ({ ...o, selected: false })));
      }
    } else {
      setIsDrawing(true);
      setCurrentPath([point]);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getCanvasPoint(e, canvasRef, cameraRef.current);

    if (isGrabbingRef.current) {
      const dx = e.movementX;
      const dy = e.movementY;
      cameraRef.current.offsetX += dx;
      cameraRef.current.offsetY += dy;
      targetCameraRef.current.offsetX += dx;
      targetCameraRef.current.offsetY += dy;
      rendererRef.current?.render(
        objects,
        currentPath,
        cameraRef.current.zoom,
        cameraRef.current.offsetX,
        cameraRef.current.offsetY,
        currentColor,
        currentSize,
      );
      return;
    }

    if (selectionBox) {
      // Update selection box as we drag
      setSelectionBox({ ...selectionBox, end: point });
    } else if (isMoving) {
      // Calculate delta from last mouse position
      const dx = point.x - lastMousePosRef.current.x;
      const dy = point.y - lastMousePosRef.current.y;

      // Move all selected objects by delta
      setObjects((prev) =>
        prev.map((o) =>
          selectedIds.includes(o.id)
            ? {
                ...o,
                points: o.points.map((p: Point) => ({
                  x: p.x + dx,
                  y: p.y + dy,
                })),
              }
            : o,
        ),
      );

      setSelectedBoundingBox((prev) =>
        prev
          ? {
              start: { x: prev.start.x + dx, y: prev.start.y + dy },
              end: { x: prev.end.x + dx, y: prev.end.y + dy },
            }
          : null,
      );

      // Update last mouse position for next frame
      lastMousePosRef.current = point;
    } else if (isDrawing) {
      setCurrentPath((prev) => {
        if (prev.length === 0) return [point];

        const last = prev[prev.length - 1];
        const dx = point.x - last.x;
        const dy = point.y - last.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        const newPoints = [];
        const steps = Math.floor(distance / 0.25); // 1 punkt co 2px
        for (let i = 1; i <= steps; i++) {
          newPoints.push({
            x: last.x + (dx * i) / steps,
            y: last.y + (dy * i) / steps,
          });
        }

        return [...prev, ...newPoints];
      });
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e?.button === 1 || isGrabbingRef.current) {
      setMode(prevModeRef.current);
      isGrabbingRef.current = false;
      return;
    }
    if (selectionBox) {
      // Finalize box selection
      const box = selectionBox;
      const minX = Math.min(box.start.x, box.end.x);
      const maxX = Math.max(box.start.x, box.end.x);
      const minY = Math.min(box.start.y, box.end.y);
      const maxY = Math.max(box.start.y, box.end.y);

      // Find all objects that have any point within the selection box
      const selectedObjects = objects.filter((obj) =>
        obj.points.some(
          (p: Point) =>
            p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY,
        ),
      );

      setSelectedIds(selectedObjects.map((o) => o.id));
      const allSelected = objects.filter((o) =>
        selectedObjects.map((s) => s.id).includes(o.id),
      );
      if (allSelected.length > 0) {
        setSelectedBoundingBox(calcBoundingBox(allSelected));
      } else {
        setSelectedBoundingBox(null);
      }

      setSelectionBox(null);
    } else if (isDrawing && currentPath.length > 0) {
      setObjects((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          type: "path",
          points: currentPath,
          color: currentColor,
          size: currentSize,
          selected: false,
        },
      ]);
      setCurrentPath([]);
    }
    setIsDrawing(false);
    setIsMoving(false);
  };

  // Deselect all objects when mode changes to draw
  useEffect(() => {
    if (mode === DrawModeEnum.Draw) {
      // Odłóż reset na koniec kolejki zadań
      const id = setTimeout(() => setSelectedIds([]), 0);
      return () => clearTimeout(id);
    }
  }, [mode]);

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    selectedIds,
    setSelectedIds,
    selectedBoundingBox,
    selectionBox,
    mode,
    setMode,
  };
}
