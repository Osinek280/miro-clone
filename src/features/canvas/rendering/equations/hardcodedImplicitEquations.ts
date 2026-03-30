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
    expr: 'dot(vec2(x, y), vec2(x, y)) - 180.0 * 180.0',
    color: [0.12, 0.36, 0.93, 0.95],
    thickness: 2.3,
  },
  {
    id: 'eq-line-diagonal',
    expr: 'x - y - 120.0',
    color: [0.9, 0.19, 0.32, 0.95],
    thickness: 1.8,
  },
  {
    id: 'eq-lemniscate',
    expr: 'pow((pow((x - 360.0) / 150.0, 2.0) + pow((y + 100.0) / 150.0, 2.0)), 2.0) - 2.0 * (pow((x - 360.0) / 150.0, 2.0) - pow((y + 100.0) / 150.0, 2.0))',
    color: [0.12, 0.62, 0.35, 0.95],
    thickness: 2.0,
  },
];
