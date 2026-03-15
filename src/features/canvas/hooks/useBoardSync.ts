import { useEffect } from 'react';
import { canvasApi } from '../api/canvas.api';

export function useBoardSync(boardId: string) {
  useEffect(() => {
    async function loadIntialState() {
      const snapshot = await canvasApi.getSnapshot(boardId);
      console.log('Snapshot:', snapshot.data);
    }

    loadIntialState();
  }, [boardId]);
}
