import { useEffect, type MutableRefObject, type RefObject } from 'react';
import type { Camera } from '../types/types';
import { cameraCanvasToPersistedCamera } from '../utils/cameraUtils';
import { useCanvasStore } from '../store/useCanvasStore';

export function useCameraPayloadCache(
  boardId: string,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  lastCameraPayloadRef: MutableRefObject<Camera | null>,
) {
  useEffect(() => {
    lastCameraPayloadRef.current = null;
    let rafId = 0;
    const tick = () => {
      const cam = useCanvasStore.getState().cameraRef?.current;
      const canvas = canvasRef.current;
      if (cam && canvas) {
        const p = cameraCanvasToPersistedCamera(cam, canvas);
        if (p) lastCameraPayloadRef.current = p;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [boardId, canvasRef, lastCameraPayloadRef]);
}
