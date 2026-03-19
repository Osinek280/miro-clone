import { useEffect } from 'react';
import { canvasApi } from '../api/canvas.api';
import type { Point } from '../types/types';
import { useCanvasStore } from './useCanvasStore';

export function useBoardSync(
  boardId: string,
  setCenterAtPoint: (point: Point, zoom: number) => void,
) {
  useEffect(() => {
    async function loadIntialState() {
      const snapshot = await canvasApi.getSnapshot(boardId);
      const { setObjects } = useCanvasStore.getState();

      console.log(snapshot.data);

      setCenterAtPoint(
        {
          x: snapshot.data.camera.x,
          y: snapshot.data.camera.y,
        },
        snapshot.data.camera.zoom,
      );

      setObjects(snapshot.data.objects);
    }

    loadIntialState();
  }, [boardId]);
}
