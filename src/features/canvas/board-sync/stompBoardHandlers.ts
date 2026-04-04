import type { Client } from '@stomp/stompjs';
import { applyOperation } from '../utils/operations';
import { fromWireOperation } from '../utils/wireCodec';
import type { Point, WireHistoryOperation } from '../types/types';
import { useCanvasStore } from '../store/useCanvasStore';

export function attachBoardStompSubscriptions(
  client: Client,
  boardId: string,
  userId: string | undefined,
): void {
  const decoder = new TextDecoder();

  client.subscribe(`/topic/draw/${boardId}`, (msg) => {
    const bodyBytes =
      (msg.binaryBody as { byteLength?: number; length?: number })?.byteLength ??
      (msg.binaryBody as { byteLength?: number; length?: number })?.length ??
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
    useCanvasStore.getState().setObjects(nextObjects);
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
    const data = JSON.parse(decoder.decode(msg.binaryBody)) as {
      userId?: string;
      cursor: Point;
    };
    if (data.userId === userId) return;
    console.log(data);
    useCanvasStore.getState().setCursors([data.cursor]);
  });
}
