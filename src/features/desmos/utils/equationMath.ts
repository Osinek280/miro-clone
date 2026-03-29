/** Parsing / validation helpers for MathQuill latex in the equation list. */

const RESERVED_WORDS = /\b(sin|cos|tan|cot|sec|csc|ln|log|lim|max|min|sqrt|frac|sum|int|pi|infty)\b/gi;

export type EquationValidation = {
  valid: boolean;
  message?: string;
};

function stripLatexCommands(latex: string): string {
  return latex.replace(/\\[a-zA-Z]+/g, ' ');
}

/** Single-letter identifiers treated as variables (after commands removed). */
export function extractMathVariables(latex: string): Set<string> {
  let s = stripLatexCommands(latex);
  s = s.replace(RESERVED_WORDS, ' ');
  s = s.replace(/[^a-zA-Z]/g, '');
  return new Set(s.split('').filter(Boolean));
}

function normalizeParen(lhs: string): string {
  return lhs.replace(/\\left|\\right/g, '').replace(/\s/g, '');
}

export function splitEquation(latex: string): { lhs: string | null; rhs: string } {
  const idx = latex.indexOf('=');
  if (idx === -1) return { lhs: null, rhs: latex };
  return { lhs: latex.slice(0, idx), rhs: latex.slice(idx + 1) };
}

/** LHS is either a single variable `a` or a function head `f(x)`. */
export function parseLhsStructure(lhs: string): { kind: 'var'; name: string } | { kind: 'func'; name: string; param: string } | null {
  const c = normalizeParen(lhs);
  const func = c.match(/^([a-zA-Z])\(([a-zA-Z])\)$/);
  if (func) return { kind: 'func', name: func[1], param: func[2] };
  const v = c.match(/^([a-zA-Z])$/);
  if (v) return { kind: 'var', name: v[1] };
  return null;
}

/** Variables assigned on the LHS anywhere in the list (skip auto-insert if already present). */
export function collectLhsDefinedNames(rows: { latex: string }[]): Set<string> {
  const out = new Set<string>();
  for (const { latex } of rows) {
    const sp = splitEquation(latex);
    if (!sp.lhs) continue;
    const p = parseLhsStructure(sp.lhs);
    if (p?.kind === 'var') out.add(p.name);
    if (p?.kind === 'func') out.add(p.name);
  }
  return out;
}

export function mergeRowDefinitions(latex: string, defined: Set<string>): void {
  const sp = splitEquation(latex);
  if (!sp.lhs) return;
  const p = parseLhsStructure(sp.lhs);
  if (p?.kind === 'var') defined.add(p.name);
  if (p?.kind === 'func') defined.add(p.name);
}

/**
 * Free variables in this row: used on the RHS (or whole line if no `=`), minus locals and already defined symbols.
 */
export function getFreeVariables(latex: string, definedBeforeRow: Set<string>): string[] {
  const sp = splitEquation(latex);
  const bound = new Set<string>();
  let text: string;

  if (!sp.lhs) {
    text = sp.rhs;
  } else {
    const p = parseLhsStructure(sp.lhs);
    if (p?.kind === 'func') {
      bound.add(p.param);
      text = sp.rhs;
    } else if (p?.kind === 'var') {
      text = sp.rhs;
    } else {
      text = latex;
    }
  }

  const vars = extractMathVariables(text);
  const free: string[] = [];
  for (const v of vars) {
    if (!bound.has(v) && !definedBeforeRow.has(v)) free.push(v);
  }
  return [...new Set(free)].sort();
}

function checkDelimitedBalanced(s: string, open: string, close: string): boolean {
  let depth = 0;
  for (const ch of s) {
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth < 0) return false;
    }
  }
  return depth === 0;
}

/** Lightweight sanity check for display-oriented math input. */
export function validateMathEquationLatex(latex: string): EquationValidation {
  const trimmed = latex.trim();
  if (trimmed.length === 0) return { valid: true };

  if (!checkDelimitedBalanced(trimmed, '(', ')')) {
    return { valid: false, message: 'Niepasujące nawiasy ()' };
  }
  if (!checkDelimitedBalanced(trimmed, '[', ']')) {
    return { valid: false, message: 'Niepasujące nawiasy []' };
  }

  const sp = splitEquation(trimmed);
  if (sp.lhs) {
    const p = parseLhsStructure(sp.lhs);
    if (!p) {
      return {
        valid: false,
        message: 'Oczekiwane: f(x)=… lub a=…',
      };
    }
  }

  return { valid: true };
}

export function newEquationId(): string {
  return crypto.randomUUID();
}

export type EquationRow = { id: string; latex: string };

/**
 * Ensures each free variable has a line `name=10` once, if no LHS assignment for that name exists yet.
 */
export function reconcileEquationRows(rows: EquationRow[]): EquationRow[] {
  const lhsDefined = collectLhsDefinedNames(rows);
  const defined = new Set<string>();
  const out: EquationRow[] = [];

  for (const row of rows) {
    out.push(row);
    const free = getFreeVariables(row.latex, defined);
    for (const v of free) {
      if (defined.has(v) || lhsDefined.has(v)) continue;
      out.push({ id: newEquationId(), latex: `${v}=10` });
      defined.add(v);
      lhsDefined.add(v);
    }
    mergeRowDefinitions(row.latex, defined);
  }

  return out;
}
