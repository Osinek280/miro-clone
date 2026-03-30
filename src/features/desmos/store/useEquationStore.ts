import { create } from 'zustand';
import type { MathField } from 'react-mathquill';
import type { EquationRow } from '../types/types';
import { newEquationId } from '../utils/equationMath';
import { buildImplicitEquations } from '../utils/equationImplicit';
import type { ImplicitEquation } from '../../canvas/rendering/equations/hardcodedImplicitEquations';

const mathFields = new Map<string, MathField>();

interface EquationStoreState {
  // state
  equations: EquationRow[];
  implicitEquations: ImplicitEquation[];
  equationInputFocused: boolean;
  activeEquationId: string | null;

  // setters
  addEquation: (equation: EquationRow) => void;
  removeEquation: (equation: EquationRow) => void;
  updateEquation: (equation: EquationRow) => void;

  setEquationInputFocused: (v: boolean) => void;
  setActiveEquationId: (id: string | null) => void;
  registerMathField: (id: string, mf: MathField | null) => void;

  // getters
  getMathField: (id: string) => MathField | null;
  getMathTarget: () => MathField | null;

  clear: () => void;
}

export const useEquationStore = create<EquationStoreState>((set, get) => ({
  equations: [{ id: newEquationId(), latex: '' }],
  implicitEquations: [],
  equationInputFocused: false,
  activeEquationId: null,

  addEquation: (equation) =>
    set((state) => {
      const equations = [...state.equations, equation];
      const implicitEquations = buildImplicitEquations(equations);
      console.log('[EquationStore] addEquation', {
        equation,
        equations,
        implicitEquations,
      });
      return {
        equations,
        implicitEquations,
      };
    }),

  removeEquation: (equation) =>
    set((state) => {
      const equations = state.equations.filter((e) => e.id !== equation.id);
      const implicitEquations = buildImplicitEquations(equations);
      console.log('[EquationStore] removeEquation', {
        equation,
        equations,
        implicitEquations,
      });
      return { equations, implicitEquations };
    }),

  updateEquation: (equation) =>
    set((state) => {
      const equations = state.equations.map((e) =>
        e.id === equation.id ? equation : e,
      );
      const implicitEquations = buildImplicitEquations(equations);
      console.log(equation);
      console.log(equations);
      console.log(implicitEquations);
      return {
        equations,
        implicitEquations,
      };
    }),

  clear: () => {
    mathFields.clear();
    set({
      equations: [],
      implicitEquations: [],
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
