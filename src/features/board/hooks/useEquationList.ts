import { useEffect, useRef, useState } from 'react';
import { addStyles } from 'react-mathquill';
import type {
  AddEquationOp,
  EquationItem,
  EquationOperation,
  EquationOpMeta,
} from '../types/equation.types';
import { equationColorOptions } from '../constants/equationColors';
import { applyEquationOperation } from '../utils/EquationOperations';
import createUUID from '../../../utils/id';

const createOpMeta = (): EquationOpMeta => ({
  opId: createUUID(),
  timestamp: Date.now(),
});

const defaultEquations = (): EquationItem[] => [
  { id: createUUID(), latex: 'a^2 + b^2 = c^2', colorIndex: 0 },
  {
    id: createUUID(),
    latex: 'x = (-b ± √(b^2 - 4ac)) / 2a',
    colorIndex: 1,
  },
];

export function useEquationList() {
  const [equations, setEquations] = useState<EquationItem[]>(defaultEquations);
  const [openedColorPickerId, setOpenedColorPickerId] = useState<string | null>(
    null,
  );
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const equationFieldRefs = useRef<Record<string, any>>({});
  const draftFieldRef = useRef<any>(null);

  useEffect(() => {
    addStyles();
  }, []);

  useEffect(() => {
    if (!openedColorPickerId) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpenedColorPickerId(null);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [openedColorPickerId]);

  const dispatchEquationOperation = (operation: EquationOperation) => {
    setEquations((current) => applyEquationOperation(current, operation));
  };

  const addEquationFromDraft = (latex: string) => {
    const trimmedLatex = latex.trim();
    if (!trimmedLatex) {
      return;
    }

    const newEquationId = createUUID();

    setEquations((current) => {
      const addOperation: AddEquationOp = {
        ...createOpMeta(),
        type: 'add',
        equation: {
          id: newEquationId,
          latex: trimmedLatex,
          colorIndex: current.length % equationColorOptions.length,
        },
      };
      return applyEquationOperation(current, addOperation);
    });
    setPendingFocusId(newEquationId);
  };

  const focusEquationByIndex = (targetIndex: number) => {
    if (targetIndex < equations.length) {
      const nextEquationId = equations[targetIndex]?.id;
      if (!nextEquationId) {
        return;
      }

      const nextEquationField = equationFieldRefs.current[nextEquationId];
      nextEquationField?.focus?.();
      nextEquationField?.moveToRightEnd?.();
      return;
    }

    draftFieldRef.current?.focus?.();
    draftFieldRef.current?.moveToRightEnd?.();
  };

  useEffect(() => {
    console.log('equations: ', equations);
  }, [equations]);

  useEffect(() => {
    if (!pendingFocusId) {
      return;
    }

    const nextField = equationFieldRefs.current[pendingFocusId];
    if (!nextField) {
      return;
    }

    nextField.focus?.();
    nextField.moveToRightEnd?.();
    setPendingFocusId(null);
  }, [equations, pendingFocusId]);

  return {
    equations,
    openedColorPickerId,
    setOpenedColorPickerId,
    rootRef,
    equationFieldRefs,
    draftFieldRef,
    dispatchEquationOperation,
    addEquationFromDraft,
    focusEquationByIndex,
    createOpMeta,
  };
}
