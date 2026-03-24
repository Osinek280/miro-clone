import { create } from 'zustand';
import type { DrawObject, HistoryOperation } from '../types/types';
import type { BatchOp } from '../types/types';
import {
  applyOperation,
  flattenBatch,
  getInverse,
  stampOp,
  mergeOperations,
} from '../utils/operations';

const MAX_HISTORY = 300;

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
