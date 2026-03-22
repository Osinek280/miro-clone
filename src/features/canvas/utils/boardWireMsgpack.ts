import { decode, encode } from '@msgpack/msgpack';
import type { HistoryOperation } from '../types/types';
import {
  boardOpToWireRecord,
  normalizeDecodedWireRecord,
} from './boardWireCodec';

/**
 * MessagePack over the same v2 wire tree as {@link encodeBoardOpToJson}.
 * Intended for native WebSocket + STOMP binary body; SockJS is text-only.
 */
export function encodeBoardOpToMsgPack(op: HistoryOperation): Uint8Array {
  return encode(boardOpToWireRecord(op)) as Uint8Array;
}

export function decodeBoardOpFromMsgPack(data: Uint8Array): HistoryOperation {
  const record = decode(data) as Record<string, unknown>;
  return normalizeDecodedWireRecord(record);
}
