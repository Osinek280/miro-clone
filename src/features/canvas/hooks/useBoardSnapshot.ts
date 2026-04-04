import { useCallback, useEffect, useRef, useState } from 'react';
import { canvasApi } from '../api/canvas.api';
import type { Point } from '../types/types';
import { useCanvasStore } from '../store/useCanvasStore';
import { useHistoryStore } from '../store/useHistoryStore';

export function useBoardSnapshot(
  boardId: string,
  onSnapshotError: () => void,
  setCenterAtPoint: (point: Point, zoom: number) => void,
) {
  const lastSnapshotCameraRef = useRef<{ point: Point; zoom: number } | null>(
    null,
  );
  const [boardReady, setBoardReady] = useState(false);

  const replayInitialCamera = useCallback(() => {
    const cam = lastSnapshotCameraRef.current;
    if (cam) setCenterAtPoint(cam.point, cam.zoom);
  }, [setCenterAtPoint]);

  useEffect(() => {
    setBoardReady(false);
    lastSnapshotCameraRef.current = null;
    useCanvasStore.getState().setObjects([]);
    useHistoryStore.getState().clear();
    let cancelled = false;

    async function loadInitialState() {
      try {
        const { data } = await canvasApi.getSnapshot(boardId);
        if (cancelled) return;

        lastSnapshotCameraRef.current = {
          point: {
            x: data.camera.offsetX,
            y: data.camera.offsetY,
          },
          zoom: data.camera.zoom,
        };

        useCanvasStore.getState().setObjects(data.objects);
        setBoardReady(true);
      } catch {
        if (cancelled) return;
        onSnapshotError();
      }
    }

    void loadInitialState();
    return () => {
      cancelled = true;
    };
  }, [boardId, onSnapshotError]);

  return { boardReady, replayInitialCamera };
}
