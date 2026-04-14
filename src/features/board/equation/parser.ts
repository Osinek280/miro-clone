import { ComputeEngine } from '@cortex-js/compute-engine';

const ce = new ComputeEngine();

export function parseEquation(latex: string) {
  const huj = '\left(2,1\right)';
  // const expr = parseTex(huj);
  console.log('expr: ', ce.parse(huj).toJSON());
}
