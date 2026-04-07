import type { EquationItem, EquationOperation } from '../types/equation.types';

export const applyEquationOperation = (
  current: EquationItem[],
  operation: EquationOperation,
): EquationItem[] => {
  switch (operation.type) {
    case 'add':
      return [...current, operation.equation];
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
    case 'batch':
      return operation.operations.reduce(
        (next, nestedOperation) =>
          applyEquationOperation(next, nestedOperation),
        current,
      );
    default:
      return current;
  }
};
