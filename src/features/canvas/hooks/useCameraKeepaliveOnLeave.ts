import { useEffect, type MutableRefObject, type RefObject } from 'react';
import { canvasApi } from '../api/canvas.api';
import type { Camera } from '../types/types';
import { cameraCanvasToPersistedCamera } from '../utils/cameraUtils';
import { useCanvasStore } from '../store/useCanvasStore';

export function useCameraKeepaliveOnLeave(
  boardId: string,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  lastCameraPayloadRef: MutableRefObject<Camera | null>,
) {
  useEffect(() => {
    let sentCamera = false;
    const sendCameraOnLeave = () => {
      if (sentCamera) return;
      const cam = useCanvasStore.getState().cameraRef?.current;
      if (!cam) return;
      const canvas = canvasRef.current;
      let payload =
        canvas != null ? cameraCanvasToPersistedCamera(cam, canvas) : null;
      if (!payload) payload = lastCameraPayloadRef.current;
      if (!payload) return;

      sentCamera = true;
      canvasApi.sendCameraKeepalive(boardId, payload);
    };

    const onPageHide = () => {
      sendCameraOnLeave();
    };

    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('unload', sendCameraOnLeave);

    return () => {
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('unload', sendCameraOnLeave);
      // SPA: route change / unmount — pagehide often does not run for in-app navigation.
      sendCameraOnLeave();
    };
  }, [boardId, canvasRef, lastCameraPayloadRef]);
}
