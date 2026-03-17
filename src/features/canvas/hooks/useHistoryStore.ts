import { create } from 'zustand';
import type { DrawObject, HistoryOperation } from '../types/types';
import type {
  AddObjectOp,
  AddObjectsOp,
  BatchOp,
  RemoveObjectsOp,
  SetPositionOp,
} from '../types/types';

const MAX_HISTORY = 300;

function getTimestamp(): number {
  return Date.now();
}

/** Ensure op has opId and timestamp; mutate clone. */
function stampOp<T extends HistoryOperation>(op: T): T {
  const o = structuredClone(op) as T;
  if (o.opId == null) (o as { opId: string }).opId = crypto.randomUUID();
  if (o.timestamp == null)
    (o as { timestamp: number }).timestamp = getTimestamp();
  return o;
}

/** Flatten batch into single ops with timestamps, sorted by timestamp (for deterministic merge). */
export function flattenBatch(batch: BatchOp): HistoryOperation[] {
  const baseTs = batch.timestamp ?? getTimestamp();
  const out: HistoryOperation[] = [];
  let index = 0;

  function collect(o: HistoryOperation) {
    if (o.type === 'batch') {
      (o.operations as HistoryOperation[]).forEach(collect);
    } else {
      const stamped = stampOp({
        ...structuredClone(o),
        timestamp:
          (o as { timestamp?: number }).timestamp ?? baseTs + index++ * 0.001,
      } as HistoryOperation);
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

// ─── Apply (tombstone = soft delete, setPosition = LWW) ────────────────────────

function applyAdd(children: DrawObject[], op: AddObjectOp): DrawObject[] {
  const obj = structuredClone(op.object);
  obj.tombstone = false;
  obj.positionTimestamp = obj.positionTimestamp ?? 0;
  const idx = children.findIndex((c) => c.id === obj.id);
  if (idx >= 0) {
    const out = [...children];
    out[idx] = obj;
    return out;
  }
  return [...children, obj];
}

/** Tombstone: mark objects as deleted instead of removing from array. */
function applyRemove(
  children: DrawObject[],
  op: RemoveObjectsOp,
): DrawObject[] {
  const ids = new Set(op.objects.map((o) => o.id));
  return children.map((c) => (ids.has(c.id) ? { ...c, tombstone: true } : c));
}

function applyAddMany(children: DrawObject[], op: AddObjectsOp): DrawObject[] {
  let result = children;
  for (const o of op.objects) {
    const obj = structuredClone(o);
    obj.tombstone = false;
    result = applyAdd(result, {
      type: 'add',
      object: obj,
      opId: op.opId,
      timestamp: op.timestamp,
    });
  }
  return result;
}

/** LWW-Register: apply position only if op timestamp >= object's positionTimestamp. */
function applySetPosition(
  children: DrawObject[],
  op: SetPositionOp,
): DrawObject[] {
  return children.map((c) => {
    const entry = op.positions.find((p) => p.id === c.id);
    if (!entry) return c;
    const objTs = c.positionTimestamp ?? 0;
    if (entry.timestamp < objTs) return c;
    return {
      ...c,
      points: entry.points.map((p) => ({ ...p })),
      positionTimestamp: entry.timestamp,
    };
  });
}

export function applyOperation(
  children: DrawObject[],
  op: HistoryOperation,
): DrawObject[] {
  switch (op.type) {
    case 'add':
      return applyAdd(children, op);
    case 'remove':
      return applyRemove(children, op);
    case 'addMany':
      return applyAddMany(children, op);
    case 'setPosition':
      return applySetPosition(children, op);
    case 'batch': {
      const flat = flattenBatch(op);
      return flat.reduce((acc, o) => applyOperation(acc, o), children);
    }
    default:
      return children;
  }
}

// ─── Inverse (for undo) ──────────────────────────────────────────────────────

function getInverse(op: HistoryOperation): HistoryOperation {
  const meta = { opId: crypto.randomUUID(), timestamp: getTimestamp() };
  switch (op.type) {
    case 'add':
      return { ...meta, type: 'remove', objects: [op.object] };
    case 'remove':
      return {
        ...meta,
        type: 'addMany',
        objects: op.objects.map((o) => ({ ...o, tombstone: false })),
      };
    case 'addMany':
      return { ...meta, type: 'remove', objects: op.objects };
    case 'setPosition':
      return {
        ...meta,
        type: 'setPosition',
        positions: op.positions.map((p) => ({
          id: p.id,
          points: p.previousPoints ?? p.points,
          timestamp: meta.timestamp,
          previousPoints: p.points,
        })),
      };
    case 'batch':
      return {
        ...meta,
        type: 'batch',
        operations: op.operations.map(getInverse).reverse(),
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

// ─── Store state ────────────────────────────────────────────────────────────

interface HistoryStoreState {
  undoStack: HistoryOperation[];
  redoStack: HistoryOperation[];
  batchDepth: number;
  batchOps: HistoryOperation[];

  pushOperation: (op: HistoryOperation) => void;
  undo: (currentChildren: DrawObject[]) => DrawObject[] | null;
  redo: (currentChildren: DrawObject[]) => DrawObject[] | null;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clear: () => void;
  mergeOperations: (
    local: HistoryOperation[],
    remote: HistoryOperation[],
  ) => HistoryOperation[];
}

export const useHistoryStore = create<HistoryStoreState>((set, get) => ({
  undoStack: [],
  redoStack: [],
  batchDepth: 0,
  batchOps: [],

  pushOperation: (op) => {
    const { batchDepth, batchOps, undoStack } = get();
    if (batchDepth > 0) {
      set({ batchOps: [...batchOps, op] });
      return;
    }

    const normalized = stampOp(structuredClone(op) as HistoryOperation);

    if (normalized.type === 'batch') {
      const flat = flattenBatch(normalized as BatchOp);
      const nextStack = [...undoStack, ...flat].slice(-MAX_HISTORY);
      set({ undoStack: nextStack, redoStack: [] });
      return;
    }

    set((s) => ({
      undoStack: [...s.undoStack.slice(-(MAX_HISTORY - 1)), normalized],
      redoStack: [],
    }));
  },

  undo: (currentChildren) => {
    const { undoStack } = get();
    if (undoStack.length === 0) return null;

    const op = undoStack[undoStack.length - 1];
    const inverse = getInverse(op);
    const nextChildren = applyOperation([...currentChildren], inverse);

    set((s) => ({
      undoStack: s.undoStack.slice(0, -1),
      redoStack: [...s.redoStack, op],
    }));
    return nextChildren;
  },

  redo: (currentChildren) => {
    const { redoStack } = get();
    if (redoStack.length === 0) return null;

    const op = redoStack[redoStack.length - 1];
    const nextChildren = applyOperation([...currentChildren], op);

    set((s) => ({
      redoStack: s.redoStack.slice(0, -1),
      undoStack: [...s.undoStack, op],
    }));
    return nextChildren;
  },

  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0,

  clear: () =>
    set({
      undoStack: [],
      redoStack: [],
      batchDepth: 0,
      batchOps: [],
    }),

  mergeOperations,
}));
