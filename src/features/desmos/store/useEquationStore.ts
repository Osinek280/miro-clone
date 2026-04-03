import { create } from 'zustand';
import type { MathField } from 'react-mathquill';
import type { EquationRow } from '../types/types';
import { newId } from '../utils/id';
import { buildImplicitEquations } from '../utils/equationImplicit';

const mathFields = new Map<string, MathField>();

interface EquationStoreState {
  // state
  equations: EquationRow[];
  equationInputFocused: boolean;
  activeEquationId: string | null;

  // setters
  addEquation: (equation: EquationRow) => void;
  removeEquation: (equation: EquationRow) => void;
  updateEquation: (equation: EquationRow) => void;
  syncRemoteEquation: (
    equation: EquationRow,
    action: 'upsert' | 'remove',
  ) => void;

  setEquations: (equations: EquationRow[]) => void;
  setEquationInputFocused: (v: boolean) => void;
  setActiveEquationId: (id: string | null) => void;
  registerMathField: (id: string, mf: MathField | null) => void;

  // getters
  getMathField: (id: string) => MathField | null;
  getMathTarget: () => MathField | null;

  clear: () => void;
}

export const useEquationStore = create<EquationStoreState>((set, get) => ({
  equations: [{ id: newId(), latex: '' }],
  equationInputFocused: false,
  activeEquationId: null,

  addEquation: (equation) =>
    set((state) => {
      const equations = [...state.equations, equation];
      const implicitEquations = buildImplicitEquations(equations);
      return {
        equations,
        implicitEquations,
      };
    }),

  removeEquation: (equation) =>
    set((state) => {
      const equations = state.equations.filter((e) => e.id !== equation.id);
      const implicitEquations = buildImplicitEquations(equations);
      return { equations, implicitEquations };
    }),

  updateEquation: (equation) =>
    set((state) => {
      const equations = state.equations.map((e) =>
        e.id === equation.id ? equation : e,
      );
      const implicitEquations = buildImplicitEquations(equations);
      return {
        equations,
        implicitEquations,
      };
    }),

  setEquations: (equations: EquationRow[]) => set({ equations }),

  syncRemoteEquation: (equation: EquationRow, action: 'upsert' | 'remove') =>
    set((state) => {
      if (action === 'remove') {
        const equations = state.equations.filter((e) => e.id !== equation.id);
        return {
          equations,
          implicitEquations: buildImplicitEquations(equations),
        };
      }

      // upsert
      const exists = state.equations.some((e) => e.id === equation.id);
      if (exists) {
        const equations = state.equations.map((e) =>
          e.id === equation.id ? equation : e,
        );
        return {
          equations,
          implicitEquations: buildImplicitEquations(equations),
        };
      }

      const trimmed =
        state.equations.at(-1)?.latex.trim() === ''
          ? state.equations.slice(0, -1)
          : state.equations;

      const equations = [...trimmed, equation];
      return {
        equations,
        implicitEquations: buildImplicitEquations(equations),
      };
    }),

  clear: () => {
    mathFields.clear();
    set({
      equations: [],
      activeEquationId: null,
      equationInputFocused: false,
    });
  },

  setEquationInputFocused: (v) => set({ equationInputFocused: v }),

  setActiveEquationId: (id) => set({ activeEquationId: id }),

  registerMathField: (id, mf) => {
    if (mf) mathFields.set(id, mf);
    else mathFields.delete(id);
  },

  getMathField: (id) => mathFields.get(id) ?? null,

  getMathTarget: () => {
    const state = get();
    const aid = state.activeEquationId;
    if (aid) {
      const mf = mathFields.get(aid);
      if (mf) return mf;
    }
    const first = state.equations[0]?.id;
    return first ? (mathFields.get(first) ?? null) : null;
  },
}));
