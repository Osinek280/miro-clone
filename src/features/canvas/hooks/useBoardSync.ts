import {
  useCallback,
  useMemo,
  useRef,
  type RefObject,
} from 'react';
import type { Camera, HistoryOperation, Point } from '../types/types';
import { Client } from '@stomp/stompjs';
import throttle from 'lodash.throttle';
import { useAuthStore } from '../../auth/store/auth.store';
import { useHistoryStore } from '../store/useHistoryStore';
import { encodeDrawWirePayload } from '../board-sync/wirePublish';
import { useBoardSnapshot } from './useBoardSnapshot';
import { useBoardStomp } from './useBoardStomp';
import { useCameraPayloadCache } from './useCameraPayloadCache';
import { useCameraKeepaliveOnLeave } from './useCameraKeepaliveOnLeave';

export function useBoardSync(
  boardId: string,
  setCenterAtPoint: (point: Point, zoom: number) => void,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  onSnapshotError: () => void,
) {
  const stompClientRef = useRef<Client | null>(null);
  const lastCameraPayloadRef = useRef<Camera | null>(null);
  const userId = useAuthStore((s) => s.user?.id);

  const { boardReady, replayInitialCamera } = useBoardSnapshot(
    boardId,
    onSnapshotError,
    setCenterAtPoint,
  );

  useBoardStomp(boardId, userId, stompClientRef);
  useCameraPayloadCache(boardId, canvasRef, lastCameraPayloadRef);
  useCameraKeepaliveOnLeave(boardId, canvasRef, lastCameraPayloadRef);

  const publishOperation = useCallback(
    (op: HistoryOperation) => {
      const client = stompClientRef.current;
      if (client?.connected) {
        const wirePayload = encodeDrawWirePayload(op, userId);
        client.publish({
          destination: `/app/draw/${boardId}`,
          binaryBody: wirePayload,
        });
      }
    },
    [boardId, userId],
  );

  const pushSyncedOperation = useCallback(
    (op: HistoryOperation) => {
      publishOperation(op);
      useHistoryStore.getState().pushOperation(op);
    },
    [publishOperation],
  );

  const pushSyncedCursor = useCallback(
    (cursor: Point) => {
      const client = stompClientRef.current;
      if (client?.connected) {
        const CursorMessage = {
          userId,
          cursor,
        };
        client.publish({
          destination: `/app/cursor/${boardId}`,
          binaryBody: new TextEncoder().encode(JSON.stringify(CursorMessage)),
        });
      }
    },
    [boardId, userId],
  );

  const pushSyncedCursorThrottled = useMemo(
    () => throttle(pushSyncedCursor, 50),
    [pushSyncedCursor],
  );

  return {
    pushSyncedOperation,
    publishOperation,
    pushSyncedCursorThrottled,
    boardReady,
    replayInitialCamera,
  };
}
