import type {
  DrawObject,
  DrawObjectWire,
  HistoryOperation,
  Point,
  WireHistoryOperation,
} from '../types/types';

function encodePoints(points: Point[]): Uint8Array {
  if (points.length === 0) return new Uint8Array();
  const out = new Int16Array(points.length * 2);
  let prevX = 0;
  let prevY = 0;

  for (let i = 0; i < points.length; i++) {
    const px = Math.round(points[i].x);
    const py = Math.round(points[i].y);
    out[i * 2] = px - prevX;
    out[i * 2 + 1] = py - prevY;
    prevX = px;
    prevY = py;
  }

  return new Uint8Array(out.buffer);
}

function decodePoints(pointsEncoded: Uint8Array): Point[] {
  if (pointsEncoded.length === 0) return [];
  const ints = new Int16Array(
    pointsEncoded.buffer,
    pointsEncoded.byteOffset,
    Math.floor(pointsEncoded.byteLength / 2),
  );

  const points: Point[] = [];
  let x = 0;
  let y = 0;

  for (let i = 0; i + 1 < ints.length; i += 2) {
    x += ints[i];
    y += ints[i + 1];
    points.push({ x, y });
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
  return {
    id: object.id,
    type: object.type,
    pointsEncoded: bytesToBase64(encodePoints(object.points)),
    color: object.color,
    size: object.size,
    tombstone: object.tombstone,
    positionTimestamp: object.positionTimestamp,
  };
}

function fromWireObject(object: DrawObjectWire): DrawObject {
  return {
    id: object.id,
    type: object.type,
    points: decodePoints(base64ToBytes(object.pointsEncoded)),
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
      objects: op.objects.map((object) =>
        fromWireObject({
          ...object,
          pointsEncoded: normalizeWirePointsEncoded(object.pointsEncoded),
        }),
      ),
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

