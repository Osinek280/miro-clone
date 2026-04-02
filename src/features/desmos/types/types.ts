export type EquationRow = {
  id: string;
  latex: string;
};

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

export type EquationSyncMessage = {
  userId: string;
  action: 'upsert' | 'remove';
} & EquationRow;
