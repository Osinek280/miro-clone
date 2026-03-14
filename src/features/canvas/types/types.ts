export interface Point {
  x: number;
  y: number;
}

export interface DrawObject {
  id: string;
  type: 'path';
  points: Point[];
  color: string;
  size: number;
}

export interface Camera {
  zoom: number;
  offsetX: number;
  offsetY: number;
}

export enum DrawModeEnum {
  Draw = 'draw',
  Select = 'select',
  Grab = 'grab',
}

export type ToolState = {
  color: string;
  size: number;
};

export type SelectionBox = { start: Point; end: Point } | null;

/** API of the state object returned by useRender (getters + setters). */
export interface RenderStateAPI {
  objects: DrawObject[];
  setObjects: React.Dispatch<React.SetStateAction<DrawObject[]>>;
  currentPath: Point[];
  setCurrentPath: React.Dispatch<React.SetStateAction<Point[]>>;
  color: string;
  setColor: React.Dispatch<React.SetStateAction<string>>;
  size: number;
  setSize: React.Dispatch<React.SetStateAction<number>>;
  selectionBox: SelectionBox;
  setSelectionBox: React.Dispatch<React.SetStateAction<SelectionBox>>;
  selectedBoundingBox: SelectionBox;
  setSelectedBoundingBox: React.Dispatch<React.SetStateAction<SelectionBox>>;
}

export interface RenderState {
  objects: DrawObject[];
  currentPath: Point[];
  // camera
  zoom: number;
  offsetX: number;
  offsetY: number;
  // tool
  color: string;
  size: number;
  // overlays
  selectionBox: SelectionBox;
  selectedBoundingBox: SelectionBox;
}

// ─── Operation-based history (no snapshots; CRDT-ready) ─────────────────────

export interface AddObjectOp {
  type: 'add';
  object: DrawObject;
}

export interface RemoveObjectsOp {
  type: 'remove';
  objects: DrawObject[];
}

export interface AddObjectsOp {
  type: 'addMany';
  objects: DrawObject[];
}

export interface MoveObjectsOp {
  type: 'move';
  deltas: { id: string; delta: Point }[];
}

export interface BatchOp {
  type: 'batch';
  operations: HistoryOperation[];
}

export type HistoryOperation =
  | AddObjectOp
  | RemoveObjectsOp
  | AddObjectsOp
  | MoveObjectsOp
  | BatchOp;