import { useCallback, useEffect, useMemo, useRef } from 'react';
import { canvasApi } from '../api/canvas.api';
import type {
  HistoryOperation,
  Point,
  WireHistoryOperation,
} from '../types/types';
import { useCanvasStore } from './useCanvasStore';
import { Client } from '@stomp/stompjs';
import { useHistoryStore } from './useHistoryStore';
import { applyOperation } from '../utils/operations';
import { fromWireOperation, toWireOperation } from '../utils/wireCodec';
import throttle from 'lodash.throttle';
import { tokenStorage } from '../../auth/utils/TokenStorage';
import { useAuthStore } from '../../auth/store/auth.store';

export function useBoardSync(
  boardId: string,
  setCenterAtPoint: (point: Point, zoom: number) => void,
) {
  const stompClientRef = useRef<Client | null>(null);
  const userId = useAuthStore((s) => s.user?.id);
  const { setObjects, setCursors } = useCanvasStore.getState();

  useEffect(() => {
    async function loadIntialState() {
      const snapshot = await canvasApi.getSnapshot(boardId);

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

  useEffect(() => {
    const client = new Client({
      brokerURL: 'ws://localhost:8080/ws',
      reconnectDelay: 3000,
      // debug: (str) => {
      //   console.log('STOMP:', str);
      // },
      connectHeaders: {
        Authorization: `Bearer ${tokenStorage.get()}`,
      },

      onConnect: () => {
        console.log('connected');
        const decoder = new TextDecoder();
        client.subscribe(`/topic/draw/${boardId}`, (msg) => {
          const op = fromWireOperation(
            JSON.parse(decoder.decode(msg.binaryBody)) as WireHistoryOperation,
          );
          console.log(op);
          const currentObjects = useCanvasStore.getState().objects;
          setObjects(applyOperation(currentObjects, op));
        });

        client.subscribe(`/topic/cursor/${boardId}`, (msg) => {
          const data = JSON.parse(decoder.decode(msg.binaryBody));
          if (data.userId === userId) return;
          console.log(data);
          setCursors([data.cursor]);
        });
      },

      onWebSocketError: (error) => console.error('WebSocket error', error),
      onDisconnect: () => console.log('disconnected'),
      onStompError: (frame) => {
        console.error('STOMP error', frame);
        console.log('error code', frame.headers['message-type']);
        console.log('error body', frame.body);
      },
    });

    client.activate();
    stompClientRef.current = client;

    return () => {
      client.deactivate();
    };
  }, [boardId]);

  const publishOperation = useCallback(
    (op: HistoryOperation) => {
      const client = stompClientRef.current;
      if (client?.connected) {
        const wireOp = toWireOperation(op);
        const encoder = new TextEncoder();
        const wirePayload = encoder.encode(JSON.stringify(wireOp));
        const normalPayload = encoder.encode(JSON.stringify(op));
        const savedBytes = normalPayload.byteLength - wirePayload.byteLength;
        const savedPercent =
          normalPayload.byteLength > 0
            ? (savedBytes / normalPayload.byteLength) * 100
            : 0;

        console.log(
          `[ws][draw] payload size: wire=${wirePayload.byteLength}B, normal=${normalPayload.byteLength}B, saved=${savedBytes}B (${savedPercent.toFixed(1)}%)`,
        );
        client.publish({
          destination: `/app/draw/${boardId}`,
          binaryBody: wirePayload,
        });
      }
    },
    [boardId],
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
    [boardId],
  );

  const pushSyncedCursorThrottled = useMemo(
    () => throttle(pushSyncedCursor, 50), // 50ms = max 20 fps
    [pushSyncedCursor],
  );

  return { pushSyncedOperation, publishOperation, pushSyncedCursorThrottled };
}
