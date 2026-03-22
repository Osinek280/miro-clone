import { useCallback, useEffect, useRef } from 'react';
import { canvasApi } from '../api/canvas.api';
import type { HistoryOperation, Point } from '../types/types';
import { useCanvasStore } from './useCanvasStore';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { useHistoryStore } from './useHistoryStore';
import { applyOperation } from '../utils/operations';
import {
  decodeBoardOpFromJson,
  encodeBoardOpToJson,
} from '../utils/boardWireCodec';

export function useBoardSync(
  boardId: string,
  setCenterAtPoint: (point: Point, zoom: number) => void,
) {
  const stompClientRef = useRef<Client | null>(null);
  const { setObjects } = useCanvasStore.getState();

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
      webSocketFactory: () =>
        new SockJS('http://localhost:8080/ws') as unknown as WebSocket,
      reconnectDelay: 3000,
      debug: (str) => {
        console.log('STOMP:', str);
      },

      onConnect: () => {
        console.log('connected');
        client.subscribe('/topic/draw', (msg: { body: string }) => {
          console.log('msg', msg);
          const data = decodeBoardOpFromJson(msg.body);
          const currentObjects = useCanvasStore.getState().objects;
          setObjects(applyOperation(currentObjects, data));
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
  }, []);

  /** Compact JSON on the wire ({@link encodeBoardOpToJson}); deflate needs native WS, not SockJS. */
  const pushSyncedOperation = useCallback((op: HistoryOperation) => {
    const client = stompClientRef.current;
    if (client?.connected) {
      client.publish({
        destination: '/app/draw',
        body: encodeBoardOpToJson(op),
      });
    }
    useHistoryStore.getState().pushOperation(op);
  }, []);

  return { pushSyncedOperation };
}
