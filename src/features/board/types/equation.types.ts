export type EquationItem = {
  id: string;
  latex: string;
  color: string;
};

export type EquationOpMeta = {
  opId: string;
  timestamp: number;
  userId?: string;
};

export type AddEquationOp = EquationOpMeta & {
  type: 'add';
  equation: EquationItem;
};

export type UpdateEquationLatexOp = EquationOpMeta & {
  type: 'update_latex';
  id: string;
  latex: string;
};

export type UpdateEquationColorOp = EquationOpMeta & {
  type: 'update_color';
  id: string;
  color: string;
};

export type RemoveEquationOp = EquationOpMeta & {
  type: 'remove';
  id: string;
};

export type BatchEquationOp = EquationOpMeta & {
  type: 'batch';
  operations: EquationOperation[];
};

export type EquationOperation =
  | AddEquationOp
  | UpdateEquationLatexOp
  | UpdateEquationColorOp
  | RemoveEquationOp
  | BatchEquationOp;
