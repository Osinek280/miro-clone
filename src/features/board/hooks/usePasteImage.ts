import { useEffect, type RefObject } from 'react';
import type { Camera, HistoryOperation, ImageDrawObject } from '../types/types';
import { clientToWorldPoint, roundPoint } from '../utils/cameraUtils';
import { calcBoundingBox } from '../utils/objectUtils';
import { useCanvasStore } from '../store/useCanvasStore';

const MAX_PASTE_IMAGE_EDGE = 1600;
const MULTI_PASTE_OFFSET = 28;

function readBlobAsDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(blob);
  });
}

function loadNaturalSize(src: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
    img.onerror = () => reject(new Error('image decode failed'));
    img.src = src;
  });
}

function fitMaxEdge(
  w: number,
  h: number,
  maxEdge: number,
): { width: number; height: number } {
  if (w <= 0 || h <= 0) return { width: 1, height: 1 };
  if (w <= maxEdge && h <= maxEdge) {
    return { width: w, height: h };
  }
  const scale = maxEdge / Math.max(w, h);
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  };
}

export function usePasteImage(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  cameraRef: RefObject<Camera>,
  boardReady: boolean,
  pushSyncedOperation: (op: HistoryOperation) => void,
) {
  useEffect(() => {
    if (!boardReady) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items?.length) return;

      const imageItems = Array.from(items).filter(
        (it) => it.kind === 'file' && it.type.startsWith('image/'),
      );
      if (imageItems.length === 0) return;

      e.preventDefault();

      void (async () => {
        const canvas = canvasRef.current;
        const camera = cameraRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const centerWorld = clientToWorldPoint(cx, cy, canvasRef, camera);

        const newObjects: ImageDrawObject[] = [];
        let index = 0;

        for (const item of imageItems) {
          const file = item.getAsFile();
          if (!file) continue;

          let dataUrl: string;
          try {
            dataUrl = await readBlobAsDataURL(file);
          } catch {
            continue;
          }

          let naturalW: number;
          let naturalH: number;
          try {
            const dim = await loadNaturalSize(dataUrl);
            naturalW = dim.w;
            naturalH = dim.h;
          } catch {
            continue;
          }

          const { width, height } = fitMaxEdge(
            naturalW,
            naturalH,
            MAX_PASTE_IMAGE_EDGE,
          );
          const ox = index * MULTI_PASTE_OFFSET;
          const oy = index * MULTI_PASTE_OFFSET;
          index += 1;

          const { x, y } = roundPoint({
            x: centerWorld.x - width / 2 + ox,
            y: centerWorld.y - height / 2 + oy,
          });

          newObjects.push({
            id: crypto.randomUUID(),
            type: 'IMAGE',
            x,
            y,
            width,
            height,
            src: dataUrl,
            tombstone: false,
            positionTimestamp: Date.now(),
          });
        }

        if (newObjects.length === 0) return;

        const ts = Date.now();
        pushSyncedOperation({
          opId: crypto.randomUUID(),
          timestamp: ts,
          type: 'add',
          objects: newObjects,
        });

        const store = useCanvasStore.getState();
        store.setObjects((prev) => [...prev, ...newObjects]);
        store.setSelectedIds(newObjects.map((o) => o.id));
        store.setSelectedBoundingBox(calcBoundingBox(newObjects));
      })();
    };

    canvas.addEventListener('paste', onPaste);
    return () => canvas.removeEventListener('paste', onPaste);
  }, [boardReady, canvasRef, cameraRef, pushSyncedOperation]);
}
