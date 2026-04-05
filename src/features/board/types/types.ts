export interface Point {
  x: number;
  y: number;
}

/** Backend + wire use uppercase discriminators (e.g. Java enum name). */
export type DrawObjectTypePath = 'PATH';
export type DrawObjectTypeImage = 'IMAGE';

/** Stroke / freehand path drawn with the brush. */
export interface PathDrawObject {
  id: string;
  type: DrawObjectTypePath;
  points: Point[];
  color: string;
  size: number;
  /** Soft delete: when true, object is hidden and excluded from hit-test (LWW with remove op timestamp). */
  tombstone: boolean;
  /** Timestamp of last position update (LWW register for move). */
  positionTimestamp: number;
}

/** Raster image placed on the board (e.g. pasted from clipboard). */
export interface ImageDrawObject {
  id: string;
  type: DrawObjectTypeImage;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Data URL or HTTP(S) URL of the image. */
  src: string;
  tombstone: boolean;
  positionTimestamp: number;
}

export type DrawObject = PathDrawObject | ImageDrawObject;

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

/** Axis-aligned bounds in world space (selection / scale). */
export interface BoundsRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Which edge of the selection box is being dragged for resize. */
export type BoxEdge = 'n' | 's' | 'e' | 'w';

/** Live resize session (refs only during drag; not stored in React state). */
export interface SelectionResizeSession {
  edge: BoxEdge;
  initialBounds: BoundsRect;
  lastPoint: Point;
}

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
  opId: string;
  timestamp: number;
  userId?: string;
}

export interface RemoveObjectsOp extends OpMeta {
  type: 'remove';
  /** Objects being removed (kept for undo restore). */
  ids: string[];
}

export interface AddObjectsOp extends OpMeta {
  type: 'add';
  objects: DrawObject[];
}

/** LWW: apply translation only if op.timestamp >= object's positionTimestamp. */
export interface TranslateOp extends OpMeta {
  type: 'translate';
  ids: string[];
  dx: number;
  dy: number;
}

/**
 * Scale selected objects so their combined bounds map from oldBounds → newBounds.
 * LWW: same as translate via positionTimestamp.
 */
export interface ScaleBoundsOp extends OpMeta {
  type: 'scaleBounds';
  ids: string[];
  oldBounds: BoundsRect;
  newBounds: BoundsRect;
}

/** Logical batch; stored stack flattens to single ops ordered by timestamp. */
export interface BatchOp extends OpMeta {
  type: 'batch';
  operations: HistoryOperation[];
}

export type HistoryOperation =
  // | AddObjectOp
  RemoveObjectsOp | AddObjectsOp | TranslateOp | ScaleBoundsOp | BatchOp;

export interface PathDrawObjectWire {
  id: string;
  type: DrawObjectTypePath;
  pointsEncoded: string; // base64 of Int32 delta pairs in POINT_SCALE space
  color: string;
  size: number;
  tombstone: boolean;
  positionTimestamp: number;
}

export interface ImageDrawObjectWire {
  id: string;
  type: DrawObjectTypeImage;
  x: number;
  y: number;
  width: number;
  height: number;
  src: string;
  tombstone: boolean;
  positionTimestamp: number;
}

export type DrawObjectWire = PathDrawObjectWire | ImageDrawObjectWire;

export function isPathWireObject(o: DrawObjectWire): o is PathDrawObjectWire {
  return String(o.type).toUpperCase() === 'PATH';
}

export function isImageWireObject(o: DrawObjectWire): o is ImageDrawObjectWire {
  return String(o.type).toUpperCase() === 'IMAGE';
}

export interface AddObjectsWireOp extends OpMeta {
  type: 'add';
  objects: DrawObjectWire[];
}

export interface BatchWireOp extends OpMeta {
  type: 'batch';
  operations: WireHistoryOperation[];
}

export type WireHistoryOperation =
  | RemoveObjectsOp
  | AddObjectsWireOp
  | TranslateOp
  | ScaleBoundsOp
  | BatchWireOp;
