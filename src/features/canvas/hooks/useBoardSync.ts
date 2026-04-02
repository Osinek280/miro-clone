import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { canvasApi } from '../api/canvas.api';
import type {
  Camera,
  HistoryOperation,
  Point,
  WireHistoryOperation,
} from '../types/types';
import { useCanvasStore } from './useCanvasStore';
import { Client } from '@stomp/stompjs';
import { useHistoryStore } from './useHistoryStore';
import { applyOperation } from '../utils/operations';
import { cameraCanvasToPersistedCamera } from '../utils/cameraUtils';
import { fromWireOperation, toWireOperation } from '../utils/wireCodec';
import throttle from 'lodash.throttle';
import { tokenStorage } from '../../auth/utils/TokenStorage';
import { useAuthStore } from '../../auth/store/auth.store';
import type {
  EquationRow,
  EquationSyncMessage,
} from '../../desmos/types/types';
import { useEquationStore } from '../../desmos/store/useEquationStore';

/**
 * When true, serializes the non-wire op for size comparison (extra CPU on send).
 * Keep false in normal use; enable only when benchmarking wire vs JSON payload size.
 */
const WS_LOG_WIRE_VS_NORMAL_PAYLOAD = false;

export function useBoardSync(
  boardId: string,
  setCenterAtPoint: (point: Point, zoom: number) => void,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  onSnapshotError: () => void,
) {
  const stompClientRef = useRef<Client | null>(null);
  /** Last API-shaped camera; needed on unmount because canvasRef is null before effect cleanup. */
  const lastCameraPayloadRef = useRef<Camera | null>(null);
  /** Snapshot camera for replay after WebGL/canvas is ready (initial load can run before init). */
  const lastSnapshotCameraRef = useRef<{ point: Point; zoom: number } | null>(
    null,
  );
  const userId = useAuthStore((s) => s.user?.id);
  const { setObjects, setCursors } = useCanvasStore.getState();
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
  }, [boardId, onSnapshotError, setCenterAtPoint]);

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
          const bodyBytes =
            (msg.binaryBody as any)?.byteLength ??
            (msg.binaryBody as any)?.length ??
            0;

          const t0 = performance.now();
          const decoded = decoder.decode(msg.binaryBody);
          const t1 = performance.now();
          const parsed = JSON.parse(decoded) as WireHistoryOperation;
          if (parsed.userId === userId) return;
          const t2 = performance.now();
          const op = fromWireOperation(parsed);
          const t3 = performance.now();
          const currentObjects = useCanvasStore.getState().objects;
          const nextObjects = applyOperation(currentObjects, op);
          const t4 = performance.now();
          setObjects(nextObjects);
          const t5 = performance.now();

          console.log(
            `[ws][draw][rx] msgBytes=${bodyBytes}B total=${(t5 - t0).toFixed(
              2,
            )}ms decode=${(t1 - t0).toFixed(2)}ms parse=${(t2 - t1).toFixed(
              2,
            )}ms wireDecode=${(t3 - t2).toFixed(2)}ms apply=${(t4 - t3).toFixed(
              2,
            )}ms`,
          );
        });

        client.subscribe(`/topic/cursor/${boardId}`, (msg) => {
          const data = JSON.parse(decoder.decode(msg.binaryBody));
          if (data.userId === userId) return;
          setCursors([data.cursor]);
        });

        client.subscribe(`/topic/equation/${boardId}`, (msg) => {
          const data = JSON.parse(
            decoder.decode(msg.binaryBody),
          ) as EquationSyncMessage;
          if (data.userId === userId) return;
          useEquationStore.getState().syncRemoteEquation(data, data.action);
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
  }, [boardId, canvasRef]);

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
  }, [boardId, canvasRef]);

  const publishOperation = useCallback(
    (op: HistoryOperation) => {
      const client = stompClientRef.current;
      if (!client?.connected) return;
      const t0 = performance.now();
      const wireOp = toWireOperation({
        ...op,
        userId: userId,
      });
      const t1 = performance.now();
      const encoder = new TextEncoder();
      const wireString = JSON.stringify(wireOp);
      const t2 = performance.now();
      const wirePayload = encoder.encode(wireString);
      const t3 = performance.now();

      if (WS_LOG_WIRE_VS_NORMAL_PAYLOAD) {
        const normalString = JSON.stringify(op);
        const t4 = performance.now();
        const normalPayload = encoder.encode(normalString);
        const t5 = performance.now();
        const savedBytes = normalPayload.byteLength - wirePayload.byteLength;
        const savedPercent =
          normalPayload.byteLength > 0
            ? (savedBytes / normalPayload.byteLength) * 100
            : 0;

        console.log(
          `[ws][draw][tx] opType=${op.type} wire=${wirePayload.byteLength}B normal=${normalPayload.byteLength}B saved=${savedBytes}B (${savedPercent.toFixed(
            1,
          )}%) total=${(t5 - t0).toFixed(2)}ms toWire=${(t1 - t0).toFixed(
            2,
          )}ms stringifyWire=${(t2 - t1).toFixed(2)}ms encodeWire=${(
            t3 - t2
          ).toFixed(2)}ms stringifyNormal=${(t4 - t3).toFixed(
            2,
          )}ms encodeNormal=${(t5 - t4).toFixed(2)}ms`,
        );
      }

      client.publish({
        destination: `/app/draw/${boardId}`,
        binaryBody: wirePayload,
      });
    },
    [boardId],
  );

  const publishEquation = useCallback(
    (equation: EquationRow, action: 'upsert' | 'remove') => {
      const client = stompClientRef.current;
      if (!client?.connected) return;
      client.publish({
        destination: `/app/equation/${boardId}`,
        binaryBody: new TextEncoder().encode(
          JSON.stringify({
            userId,
            action,
            ...equation,
          }),
        ),
      });
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

  const pushSyncedEquation = useCallback(
    (equation: EquationRow, action: 'upsert' | 'remove') => {
      publishEquation(equation, action);
    },
    [boardId],
  );

  const pushSyncedCursorThrottled = useMemo(
    () => throttle(pushSyncedCursor, 50), // 50ms = max 20 fps
    [pushSyncedCursor],
  );

  return {
    pushSyncedOperation,
    publishOperation,
    pushSyncedCursorThrottled,
    boardReady,
    replayInitialCamera,
    pushSyncedEquation,
  };
}
