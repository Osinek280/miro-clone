import type { DrawObject, HistoryOperation, Point } from '../types/types';

type WirePoint = [number, number];

function toWirePoints(pts: Point[]): WirePoint[] {
  const out: WirePoint[] = new Array(pts.length);
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    out[i] = [p.x, p.y];
  }
  return out;
}

function fromWirePoints(pts: unknown): Point[] {
  if (!Array.isArray(pts)) return [];
  const out: Point[] = [];
  for (const row of pts) {
    if (
      Array.isArray(row) &&
      row.length >= 2 &&
      typeof row[0] === 'number' &&
      typeof row[1] === 'number'
    ) {
      out.push({ x: row[0], y: row[1] });
    }
  }
  return out;
}

function drawObjectToWire(o: DrawObject): Record<string, unknown> {
  return {
    id: o.id,
    type: o.type,
    pts: toWirePoints(o.points),
    color: o.color,
    size: o.size,
    tombstone: o.tombstone,
    positionTimestamp: o.positionTimestamp,
  };
}

function drawObjectFromWire(raw: Record<string, unknown>): DrawObject | null {
  const id = raw.id;
  const type = raw.type;
  if (typeof id !== 'string' || type !== 'path') return null;
  const points = 'pts' in raw ? fromWirePoints(raw.pts) : [];
  const color = typeof raw.color === 'string' ? raw.color : '#000000';
  const size = typeof raw.size === 'number' ? raw.size : 1;
  const tombstone = Boolean(raw.tombstone);
  const positionTimestamp =
    typeof raw.positionTimestamp === 'number' ? raw.positionTimestamp : 0;
  return {
    id,
    type: 'path',
    points,
    color,
    size,
    tombstone,
    positionTimestamp,
  };
}

/** Plain object for JSON or MessagePack (same tree). */
export function boardOpToWireRecord(
  op: HistoryOperation,
): Record<string, unknown> {
  const meta: Record<string, unknown> = {};
  if (op.opId != null) meta.opId = op.opId;
  if (op.timestamp != null) meta.timestamp = op.timestamp;

  switch (op.type) {
    case 'add':
    case 'remove':
      return {
        type: op.type,
        objects: op.objects.map(drawObjectToWire),
        ...meta,
      };
    case 'setPosition': {
      return {
        type: 'setPosition',
        positions: op.positions.map((p) => ({
          id: p.id,
          pts: toWirePoints(p.points),
          timestamp: p.timestamp,
          ...(p.previousPoints != null
            ? { pp: toWirePoints(p.previousPoints) }
            : {}),
        })),
        ...meta,
      };
    }
    case 'batch':
      return {
        type: 'batch',
        operations: op.operations.map((inner) => boardOpToWireRecord(inner)),
        ...meta,
      };
    default:
      return { ...meta, ...(op as object as Record<string, unknown>) };
  }
}

function positionEntryFromWire(raw: Record<string, unknown>): {
  id: string;
  points: Point[];
  timestamp: number;
  previousPoints?: Point[];
} | null {
  const id = raw.id;
  if (typeof id !== 'string') return null;
  const timestamp =
    typeof raw.timestamp === 'number' ? raw.timestamp : Date.now();
  const points = 'pts' in raw ? fromWirePoints(raw.pts) : [];
  const previousPoints = 'pp' in raw ? fromWirePoints(raw.pp) : undefined;
  return { id, points, timestamp, previousPoints };
}

export function boardOpFromWireRecord(
  data: Record<string, unknown>,
): HistoryOperation {
  const type = data.type;
  const opId = typeof data.opId === 'string' ? data.opId : undefined;
  const timestamp =
    typeof data.timestamp === 'number' ? data.timestamp : undefined;
  const meta = {
    ...(opId != null ? { opId } : {}),
    ...(timestamp != null ? { timestamp } : {}),
  };

  if (type === 'add' || type === 'remove') {
    const objectsRaw = data.objects;
    const objects: DrawObject[] = [];
    if (Array.isArray(objectsRaw)) {
      for (const item of objectsRaw) {
        if (item && typeof item === 'object') {
          const o = drawObjectFromWire(item as Record<string, unknown>);
          if (o) objects.push(o);
        }
      }
    }
    return { ...meta, type, objects } as HistoryOperation;
  }

  if (type === 'setPosition') {
    const positionsRaw = data.positions;
    const positions: SetPositionFromWire[] = [];
    if (Array.isArray(positionsRaw)) {
      for (const item of positionsRaw) {
        if (item && typeof item === 'object') {
          const p = positionEntryFromWire(item as Record<string, unknown>);
          if (p) {
            positions.push({
              id: p.id,
              points: p.points,
              timestamp: p.timestamp,
              ...(p.previousPoints != null
                ? { previousPoints: p.previousPoints }
                : {}),
            });
          }
        }
      }
    }
    return { ...meta, type: 'setPosition', positions } as HistoryOperation;
  }

  if (type === 'batch') {
    const opsRaw = data.operations;
    const operations: HistoryOperation[] = [];
    if (Array.isArray(opsRaw)) {
      for (const item of opsRaw) {
        if (item && typeof item === 'object') {
          operations.push(
            boardOpFromWireRecord(item as Record<string, unknown>),
          );
        }
      }
    }
    return { ...meta, type: 'batch', operations } as HistoryOperation;
  }

  return data as unknown as HistoryOperation;
}

type SetPositionFromWire = {
  id: string;
  points: Point[];
  timestamp: number;
  previousPoints?: Point[];
};

export function normalizeDecodedWireRecord(
  data: Record<string, unknown>,
): HistoryOperation {
  return boardOpFromWireRecord(data);
}

export function encodeBoardOpToJson(op: HistoryOperation): string {
  return JSON.stringify(boardOpToWireRecord(op));
}

export function decodeBoardOpFromJson(body: string): HistoryOperation {
  const data = JSON.parse(body) as Record<string, unknown>;
  return normalizeDecodedWireRecord(data);
}
