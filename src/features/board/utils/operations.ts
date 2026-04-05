import type {
  AddObjectsOp,
  BatchOp,
  DrawObject,
  HistoryOperation,
  RemoveObjectsOp,
  ScaleBoundsOp,
  TranslateOp,
} from '../types/types';
import { roundPoint } from './cameraUtils';
import { mapDrawObjectWithBounds } from './scaleBoundsUtils';

function cloneAddedObject(o: DrawObject): DrawObject {
  const ts = o.positionTimestamp ?? 0;
  if (o.type === 'PATH') {
    return {
      ...o,
      points: o.points.slice(),
      tombstone: false,
      positionTimestamp: ts,
    };
  }
  return {
    ...o,
    tombstone: false,
    positionTimestamp: ts,
  };
}

function getTimestamp(): number {
  return Date.now();
}

/** Ensure op has opId and timestamp; mutate clone. */
// export function stampOp<T extends HistoryOperation>(op: T): T {
//   const o = structuredClone(op) as T;
//   if (o.opId == null) (o as { opId: string }).opId = crypto.randomUUID();
//   if (o.timestamp == null)
//     (o as { timestamp: number }).timestamp = getTimestamp();
//   return o;
// }

/** Flatten batch into single ops with timestamps, sorted by timestamp (for deterministic merge). */
export function flattenBatch(batch: BatchOp): HistoryOperation[] {
  const baseTs = batch.timestamp ?? getTimestamp();
  const out: HistoryOperation[] = [];
  let index = 0;

  function collect(o: HistoryOperation) {
    if (o.type === 'batch') {
      (o.operations as HistoryOperation[]).forEach(collect);
    } else {
      const stamped = {
        ...structuredClone(o),
        timestamp:
          (o as { timestamp?: number }).timestamp ?? baseTs + index++ * 0.001,
      } as HistoryOperation;
      out.push(stamped);
    }
  }
  (batch.operations as HistoryOperation[]).forEach(collect);

  out.sort(
    (a, b) =>
      (a.timestamp ?? 0) - (b.timestamp ?? 0) ||
      (a.opId ?? '').localeCompare(b.opId ?? ''),
  );
  return out;
}

// ─── Apply (tombstone = soft delete, translate = LWW) ───────────────────────────

/** Tombstone: mark objects as deleted instead of removing from array. */
function applyRemove(
  children: DrawObject[],
  op: RemoveObjectsOp,
): DrawObject[] {
  const ids = new Set(op.ids);
  return children.map((c) => (ids.has(c.id) ? { ...c, tombstone: true } : c));
}

function applyAddMany(children: DrawObject[], op: AddObjectsOp): DrawObject[] {
  if (op.objects.length === 0) return children;

  const out = children.slice();
  const idToIndex = new Map<string, number>();
  for (let i = 0; i < out.length; i++) {
    idToIndex.set(out[i].id, i);
  }

  for (const o of op.objects) {
    const obj = cloneAddedObject(o);

    const idx = idToIndex.get(obj.id);
    if (idx !== undefined) {
      out[idx] = obj;
    } else {
      idToIndex.set(obj.id, out.length);
      out.push(obj);
    }
  }

  return out;
}

/** LWW: apply translation only if op timestamp >= object's positionTimestamp. */
function applyTranslate(children: DrawObject[], op: TranslateOp): DrawObject[] {
  const idSet = new Set(op.ids);
  const opTs = op.timestamp ?? 0;
  return children.map((c) => {
    if (!idSet.has(c.id)) return c;
    const objTs = c.positionTimestamp ?? 0;
    if (opTs < objTs) return c;
    if (c.type === 'PATH') {
      return {
        ...c,
        points: c.points.map((p) =>
          roundPoint({ x: p.x + op.dx, y: p.y + op.dy }),
        ),
        positionTimestamp: opTs,
      };
    }
    const p = roundPoint({ x: c.x + op.dx, y: c.y + op.dy });
    return {
      ...c,
      x: p.x,
      y: p.y,
      positionTimestamp: opTs,
    };
  });
}

function applyScaleBounds(
  children: DrawObject[],
  op: ScaleBoundsOp,
): DrawObject[] {
  const idSet = new Set(op.ids);
  const opTs = op.timestamp ?? 0;
  return children.map((c) =>
    mapDrawObjectWithBounds(c, idSet, op.oldBounds, op.newBounds, opTs),
  );
}

export function applyOperation(
  children: DrawObject[],
  op: HistoryOperation,
): DrawObject[] {
  switch (op.type) {
    case 'remove':
      return applyRemove(children, op);
    case 'add':
      return applyAddMany(children, op);
    case 'translate':
      return applyTranslate(children, op);
    case 'scaleBounds':
      return applyScaleBounds(children, op);
    case 'batch': {
      const flat = flattenBatch(op);
      return flat.reduce((acc, o) => applyOperation(acc, o), children);
    }
    default:
      return children;
  }
}

// ─── Inverse (for undo) ──────────────────────────────────────────────────────

export function getInverse(
  op: HistoryOperation,
  children: DrawObject[] = [],
): HistoryOperation {
  const meta = { opId: crypto.randomUUID(), timestamp: getTimestamp() };
  switch (op.type) {
    case 'remove': {
      const idSet = new Set(op.ids);
      return {
        ...meta,
        type: 'add',
        objects: children
          .filter((o) => idSet.has(o.id))
          .map((o) => ({ ...o, tombstone: false })),
      };
    }
    case 'add':
      return { ...meta, type: 'remove', ids: op.objects.map((o) => o.id) };
    case 'translate':
      return {
        ...meta,
        type: 'translate',
        ids: [...op.ids],
        dx: -op.dx,
        dy: -op.dy,
      };
    case 'scaleBounds':
      return {
        ...meta,
        type: 'scaleBounds',
        ids: [...op.ids],
        oldBounds: op.newBounds,
        newBounds: op.oldBounds,
      };
    case 'batch':
      return {
        ...meta,
        type: 'batch',
        operations: op.operations
          .map((batchOp) => getInverse(batchOp, children))
          .reverse(),
      };
    default:
      return op;
  }
}

// ─── Operational transform / merge (concurrent ops) ───────────────────────────

/** Merge two operation streams by timestamp; deterministic order for LWW and tombstones. */
export function mergeOperations(
  local: HistoryOperation[],
  remote: HistoryOperation[],
): HistoryOperation[] {
  const combined = [...local, ...remote].filter(
    (o): o is HistoryOperation & { timestamp: number; opId: string } =>
      o != null &&
      typeof (o as { timestamp?: number }).timestamp === 'number' &&
      typeof (o as { opId?: string }).opId === 'string',
  );
  combined.sort(
    (a, b) =>
      a.timestamp - b.timestamp ||
      (a.opId as string).localeCompare(b.opId as string),
  );
  return combined;
}

/** Apply a list of operations in order (e.g. after merge). */
export function applyOperations(
  children: DrawObject[],
  ops: HistoryOperation[],
): DrawObject[] {
  return ops.reduce((acc, op) => applyOperation(acc, op), children);
}
