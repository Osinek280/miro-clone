import type { HistoryOperation } from '../types/types';
import { toWireOperation } from '../utils/wireCodec';
import { WS_LOG_WIRE_VS_NORMAL_PAYLOAD } from './constants';

export function encodeDrawWirePayload(
  op: HistoryOperation,
  userId: string | undefined,
): Uint8Array {
  const t0 = performance.now();
  const wireOp = toWireOperation({
    ...op,
    userId,
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

  return wirePayload;
}
