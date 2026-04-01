import type { ImplicitEquation } from '../types/types';
import type { EquationRow } from '../types/types';
import { latexExprToGlsl, latexExprToGlslWithError } from './latexToGlsl';

const DEFAULT_COLOR: [number, number, number, number] = [
  0.12, 0.36, 0.93, 0.95,
];
const DEFAULT_THICKNESS = 2.0;

function rowToImplicitEquation(row: EquationRow): ImplicitEquation | null {
  const latex = row.latex.trim();
  if (!latex) return null;
  const eqIndex = latex.indexOf('=');
  const left = eqIndex < 0 ? latex : latex.slice(0, eqIndex);
  const right = eqIndex < 0 ? 'y' : latex.slice(eqIndex + 1);
  const leftGlsl = latexExprToGlsl(left);
  const rightGlsl = latexExprToGlsl(right);
  if (!leftGlsl || !rightGlsl) return null;

  return {
    id: row.id,
    expr: `((${leftGlsl})-(${rightGlsl}))`,
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

/** LaTeX→GLSL error text, or null when the field is empty or valid. */
export function getEquationGlslError(row: EquationRow): string | null {
  const latex = row.latex.trim();
  if (!latex) return null;

  const eqIndex = latex.indexOf('=');
  const left = eqIndex < 0 ? latex : latex.slice(0, eqIndex);
  const right = eqIndex < 0 ? 'y' : latex.slice(eqIndex + 1);

  const leftRes = latexExprToGlslWithError(left);
  if (!leftRes.ok) return `Left side: ${leftRes.error}`;

  const rightRes = latexExprToGlslWithError(right);
  if (!rightRes.ok) return `Right side: ${rightRes.error}`;

  return null;
}
