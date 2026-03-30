export type ImplicitEquation = {
  id: string;
  /** GLSL expression for implicit form f(x,y) = 0. */
  expr: string;
  color: [number, number, number, number];
  /**
   * Approx contour thickness in screen pixels.
   */
  thickness: number;
};

export const HARDCODED_IMPLICIT_EQUATIONS: readonly ImplicitEquation[] = [
  {
    id: 'eq-circle-center',
    expr: 'dot(vec2(x, y), vec2(x, y)) - 1.8 * 1.8',
    color: [0.12, 0.36, 0.93, 0.95],
    thickness: 2.3,
  },
  {
    id: 'eq-line-diagonal',
    expr: 'x - y - 1.2',
    color: [0.9, 0.19, 0.32, 0.95],
    thickness: 1.8,
  },
  {
    id: 'eq-lemniscate',
    expr: 'pow((pow((x - 3.6) / 1.5, 2.0) + pow((y + 1.0) / 1.5, 2.0)), 2.0) - 2.0 * (pow((x - 3.6) / 1.5, 2.0) - pow((y + 1.0) / 1.5, 2.0))',
    color: [0.12, 0.62, 0.35, 0.95],
    thickness: 2.0,
  },
  {
    id: '0e259772-ee1c-4c49-9a76-20a17676d904',
    expr: 'y - pow(x, 2.0)',
    color: [0.12, 0.62, 0.35, 0.95],
    thickness: 2.0,
  },
  {
    id: 'eq-circle-small-offset',
    expr: '(x - 0.2) * (x - 0.2) + (y - 0.2) * (y - 0.2) - 0.015',
    color: [0.12, 0.62, 0.35, 0.95],
    thickness: 2.0,
  },
  {
    id: 'eq-circle-small-offset',
    expr: '((y)-(pow((x), (pow((2.0), (2.0))))))',
    color: [0.12, 0.62, 0.35, 0.95],
    thickness: 2.0,
  },
];
