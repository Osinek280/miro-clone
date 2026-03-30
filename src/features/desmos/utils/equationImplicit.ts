import type { ImplicitEquation } from '../../canvas/rendering/equations/hardcodedImplicitEquations';
import type { EquationRow } from '../types/types';

const DEFAULT_COLOR: [number, number, number, number] = [
  0.12, 0.36, 0.93, 0.95,
];
const DEFAULT_THICKNESS = 2.0;

function removeWrappers(latex: string): string {
  return latex
    .replace(/\\left/g, '')
    .replace(/\\right/g, '')
    .replace(/\s+/g, '');
}

function normalizeImplicitExpr(expr: string): string | null {
  const out = removeWrappers(expr);
  if (!out) return null;
  return out;
}

function rowToImplicitEquation(row: EquationRow): ImplicitEquation | null {
  const latex = row.latex.trim();
  if (!latex) return null;
  const eqIndex = latex.indexOf('=');
  const left = eqIndex < 0 ? latex : latex.slice(0, eqIndex);
  const right = eqIndex < 0 ? 'y' : latex.slice(eqIndex + 1);
  const leftExpr = normalizeImplicitExpr(left);
  const rightExpr = normalizeImplicitExpr(right);
  if (!leftExpr || !rightExpr) return null;

  return {
    id: row.id,
    expr: `((${leftExpr})-(${rightExpr}))`,
    color: DEFAULT_COLOR,
    thickness: DEFAULT_THICKNESS,
  };
}

export function buildImplicitEquations(
  rows: EquationRow[],
): ImplicitEquation[] {
  const out: ImplicitEquation[] = [];
  for (const row of rows) {
    const parsed = rowToImplicitEquation(row);
    if (parsed) out.push(parsed);
  }
  return out;
}
