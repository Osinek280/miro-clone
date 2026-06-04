import { ComputeEngine } from '@cortex-js/compute-engine';

const ce = new ComputeEngine();

export function parseEquation(latex: string) {
  const huj = '\left(2,1\right)';
  // const expr = parseTex(huj);
  console.log('expr: ', ce.parse(huj).toJSON());
}

// export type { Expr, BinaryOp, UnaryOp, Delimiter } from './ast';
// export { walkExpr, collectIdentifiers, isExpr } from './ast';
// export type { ParseResult } from './latexParser';
// export { parseLatexToAst } from './latexParser';
// export { tokenizeLatex } from './latexTokenizer';
// export type { Token } from './latexTokenizer';

// import type { ParseResult } from './latexParser';
// import { parseLatexToAst } from './latexParser';

// /** Parsuje LaTeX z MathQuill do własnego AST. */
// export function parseEquation(latex: string): ParseResult {
//   const results = parseLatexToAst(latex);
//   console.log('cipahujcipajci: ', results);
//   console.log('results: ', results);
//   return results;
// }
