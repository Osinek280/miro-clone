import { useRef, useState } from "react";
import {
  DrawModeEnum,
  type Camera,
  type DrawObject,
  type Point,
} from "../types/types";
import { findObjectAtPoint, getCanvasPoint } from "../utils/cameraUtils";

export function useMouseHandlers(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  cameraRef: React.RefObject<Camera>,
  objects: DrawObject[],
  setObjects: React.Dispatch<React.SetStateAction<DrawObject[]>>,
  setCurrentPath: React.Dispatch<React.SetStateAction<Point[]>>,
  currentPath: Point[],
  currentColor: string,
  currentSize: number,
  mode: DrawModeEnum,
) {
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const lastMousePosRef = useRef<Point>({ x: 0, y: 0 });
  const [isDrawing, setIsDrawing] = useState(false);

  const [selectionBox, setSelectionBox] = useState<{
    start: Point;
    end: Point;
  } | null>(null);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getCanvasPoint(e, canvasRef, cameraRef.current);

    if (mode === DrawModeEnum.Select) {
      const obj = findObjectAtPoint(point, objects);
      if (obj) {
        // If object is already selected, just start moving without resetting selection
        if (!obj.selected) {
          // If object is not selected, select it (and deselect others)
          setSelectedObjectId(obj.id);
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
        setSelectedObjectId(null);
        setObjects((prev) => prev.map((o) => ({ ...o, selected: false })));
      }
    } else {
      setIsDrawing(true);
      setCurrentPath([point]);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getCanvasPoint(e, canvasRef, cameraRef.current);

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
          o.selected
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
        const steps = Math.floor(distance / 2); // 1 punkt co 2px
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

  const handleMouseUp = () => {
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

      // Update objects with selection state
      setObjects((prev) =>
        prev.map((o) => ({
          ...o,
          selected: selectedObjects.some((s) => s.id === o.id),
        })),
      );

      if (selectedObjects.length > 0) {
        setSelectedObjectId(selectedObjects[0].id);
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

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    selectedObjectId,
    setSelectedObjectId,
    selectionBox,
  };
}
