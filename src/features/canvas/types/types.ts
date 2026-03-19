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
  /** Soft delete: when true, object is hidden and excluded from hit-test (LWW with remove op timestamp). */
  tombstone: boolean;
  /** Timestamp of last position update (LWW register for move). */
  positionTimestamp: number;
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

// ─── Operation-based history (CRDT-ready: opId + timestamp, LWW, tombstone) ─

/** Base: every operation has unique id and timestamp (assigned by store if omitted). */
export interface OpMeta {
  opId?: string;
  timestamp?: number;
}

export interface RemoveObjectsOp extends OpMeta {
  type: 'remove';
  /** Objects being removed (kept for undo restore). */
  objects: DrawObject[];
}

export interface AddObjectsOp extends OpMeta {
  type: 'add';
  objects: DrawObject[];
}

/** LWW-Register: absolute position + timestamp; last write wins. previousPoints used for undo. */
export interface SetPositionOp extends OpMeta {
  type: 'setPosition';
  positions: {
    id: string;
    points: Point[];
    timestamp: number;
    previousPoints?: Point[];
  }[];
}

/** Logical batch; stored stack flattens to single ops ordered by timestamp. */
export interface BatchOp extends OpMeta {
  type: 'batch';
  operations: HistoryOperation[];
}

export type HistoryOperation =
  // | AddObjectOp
  RemoveObjectsOp | AddObjectsOp | SetPositionOp | BatchOp;
