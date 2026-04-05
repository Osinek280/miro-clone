import {
  isImageWireObject,
  type DrawObject,
  type DrawObjectWire,
  type HistoryOperation,
  type Point,
  type WireHistoryOperation,
} from '../types/types';
import { POINT_SCALE } from '../constants/pointPrecision';

/** Delta-encoded Int32 pairs in POINT_SCALE space (raw buffer, no prefix). */
function encodePoints(points: Point[]): Uint8Array {
  if (points.length === 0) return new Uint8Array();

  const deltas = new Int32Array(points.length * 2);
  let prevScaledX = 0;
  let prevScaledY = 0;

  for (let i = 0; i < points.length; i++) {
    const sx = Math.round(points[i].x * POINT_SCALE);
    const sy = Math.round(points[i].y * POINT_SCALE);
    deltas[i * 2] = sx - prevScaledX;
    deltas[i * 2 + 1] = sy - prevScaledY;
    prevScaledX = sx;
    prevScaledY = sy;
  }

  return new Uint8Array(deltas.buffer);
}

function decodePoints(pointsEncoded: Uint8Array): Point[] {
  if (pointsEncoded.length === 0 || pointsEncoded.length % 4 !== 0) return [];
  if ((pointsEncoded.length / 4) % 2 !== 0) return [];

  const ints = new Int32Array(
    pointsEncoded.buffer,
    pointsEncoded.byteOffset,
    pointsEncoded.length / 4,
  );

  const points: Point[] = [];
  let x = 0;
  let y = 0;

  for (let i = 0; i + 1 < ints.length; i += 2) {
    x += ints[i];
    y += ints[i + 1];
    points.push({ x: x / POINT_SCALE, y: y / POINT_SCALE });
  }

  return points;
}

function bytesToBase64(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';
  let binary = '';
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  if (!base64) return new Uint8Array();
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function toWireObject(object: DrawObject): DrawObjectWire {
  if (object.type === 'image') {
    return {
      id: object.id,
      type: 'image',
      x: object.x,
      y: object.y,
      width: object.width,
      height: object.height,
      src: object.src,
      tombstone: object.tombstone,
      positionTimestamp: object.positionTimestamp,
    };
  }
  return {
    id: object.id,
    type: 'path',
    pointsEncoded: bytesToBase64(encodePoints(object.points)),
    color: object.color,
    size: object.size,
    tombstone: object.tombstone,
    positionTimestamp: object.positionTimestamp,
  };
}

function fromWireObject(object: DrawObjectWire): DrawObject {
  if (isImageWireObject(object)) {
    return {
      id: object.id,
      type: 'image',
      x: object.x,
      y: object.y,
      width: object.width,
      height: object.height,
      src: typeof object.src === 'string' ? object.src : '',
      tombstone: object.tombstone,
      positionTimestamp: object.positionTimestamp,
    };
  }
  return {
    id: object.id,
    type: 'path',
    points: decodePoints(
      base64ToBytes(normalizeWirePointsEncoded(object.pointsEncoded)),
    ),
    color: object.color,
    size: object.size,
    tombstone: object.tombstone,
    positionTimestamp: object.positionTimestamp,
  };
}

function normalizeWirePointsEncoded(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Uint8Array) return bytesToBase64(value);
  if (Array.isArray(value)) return bytesToBase64(Uint8Array.from(value));

  if (value && typeof value === 'object') {
    const indexed = value as Record<string, number>;
    const values = Object.keys(indexed)
      .filter((k) => /^\d+$/.test(k))
      .map((k) => [Number(k), indexed[k]] as const)
      .sort((a, b) => a[0] - b[0])
      .map(([, v]) => v);
    return bytesToBase64(Uint8Array.from(values));
  }

  return '';
}

export function toWireOperation(op: HistoryOperation): WireHistoryOperation {
  if (op.type === 'add') {
    return {
      ...op,
      objects: op.objects.map(toWireObject),
    };
  }

  if (op.type === 'batch') {
    return {
      ...op,
      operations: op.operations.map(toWireOperation),
    };
  }

  return op;
}

export function fromWireOperation(op: WireHistoryOperation): HistoryOperation {
  if (op.type === 'add') {
    return {
      ...op,
      objects: op.objects.map((object) => fromWireObject(object)),
    };
  }

  if (op.type === 'batch') {
    return {
      ...op,
      operations: op.operations.map(fromWireOperation),
    };
  }

  return op;
}
