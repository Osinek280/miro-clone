import type { EquationItem, EquationOperation } from '../types/equation.types';

function applyAdd(
  current: EquationItem[],
  operation: EquationOperation,
): EquationItem[] {
  if (operation.type !== 'add') return current;

  const index = current.findIndex(
    (equation) => equation.id === operation.equation.id,
  );
  if (index === -1) {
    return [...current, operation.equation];
  }

  const next = current.slice();
  next[index] = operation.equation;
  return next;
}

export const applyEquationOperation = (
  current: EquationItem[],
  operation: EquationOperation,
): EquationItem[] => {
  switch (operation.type) {
    case 'add':
      return applyAdd(current, operation);
    case 'update_latex':
      return current.map((equation) =>
        equation.id === operation.id
          ? { ...equation, latex: operation.latex }
          : equation,
      );
    case 'update_color':
      return current.map((equation) =>
        equation.id === operation.id
          ? { ...equation, colorIndex: operation.colorIndex }
          : equation,
      );
    case 'remove':
      return current.filter((equation) => equation.id !== operation.id);
    default:
      return current;
  }
};
