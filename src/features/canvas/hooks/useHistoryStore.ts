import { create } from 'zustand';
import type {
  DrawObject,
  HistoryOperation,
  Point,
} from '../types/types';
import type {
  AddObjectOp,
  AddObjectsOp,
  BatchOp,
  MoveObjectsOp,
  RemoveObjectsOp,
} from '../types/types';



const MAX_HISTORY = 300;

// ─── Apply operation to children array (immutable) ───────────────────────────

function applyAdd(children: DrawObject[], op: AddObjectOp): DrawObject[] {
  return [...children, structuredClone(op.object)];
}

function applyRemove(children: DrawObject[], op: RemoveObjectsOp): DrawObject[] {
  const ids = new Set(op.objects.map((o) => o.id));
  return children.filter((c) => !ids.has(c.id));
}

function applyAddMany(children: DrawObject[], op: AddObjectsOp): DrawObject[] {
  return [...children, ...op.objects.map((o) => structuredClone(o))];
}

function applyMove(children: DrawObject[], op: MoveObjectsOp): DrawObject[] {
  const deltaById = new Map(op.deltas.map((d) => [d.id, d.delta]));
  return children.map((c) => {
    const delta = deltaById.get(c.id);
    if (!delta) return c;
    return {
      ...c,
      points: c.points.map((p) => ({
        x: p.x + delta.x,
        y: p.y + delta.y,
      })),
    };
  });
}

function applyBatch(children: DrawObject[], op: BatchOp): DrawObject[] {
  return op.operations.reduce((acc, o) => applyOperation(acc, o), children);
}

export function applyOperation(
  children: DrawObject[],
  op: HistoryOperation
): DrawObject[] {
  switch (op.type) {
    case 'add':
      return applyAdd(children, op);
    case 'remove':
      return applyRemove(children, op);
    case 'addMany':
      return applyAddMany(children, op);
    case 'move':
      return applyMove(children, op);
    case 'batch':
      return applyBatch(children, op);
    default:
      return children;
  }
}

// ─── Inverse operation (for undo) ──────────────────────────────────────────

function getInverse(op: HistoryOperation): HistoryOperation {
  switch (op.type) {
    case 'add':
      return { type: 'remove', objects: [op.object] };
    case 'remove':
      return { type: 'addMany', objects: op.objects };
    case 'addMany':
      return { type: 'remove', objects: op.objects };
    case 'move':
      return {
        type: 'move',
        deltas: op.deltas.map((d) => ({
          id: d.id,
          delta: { x: -d.delta.x, y: -d.delta.y } as Point,
        })),
      };
    case 'batch':
      return {
        type: 'batch',
        operations: op.operations.map(getInverse).reverse(),
      };
    default:
      return op;
  }
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
}


export const useHistoryStore = create<HistoryStoreState>((set, get) => ({
  undoStack: [],
  redoStack: [],
  batchDepth: 0,
  batchOps: [],

  pushOperation: (op) => {
    const { batchDepth, batchOps } = get();
    if (batchDepth > 0) {
      set({ batchOps: [...batchOps, op] });
      return;
    }
    console.log(get().undoStack)
    set((s) => ({
      undoStack: [
        ...s.undoStack.slice(-(MAX_HISTORY - 1)),
        structuredClone(op),
      ],
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

  cancelBatch: () => {
    set({ batchDepth: 0, batchOps: [] });
  },
}));
