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
  /** Counter-clockwise rotation in radians around image center (x+w/2, y+h/2). */
  rotation: number;
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

/** Oriented selection outline (nw, ne, se, sw). Persists after rotate until selection changes. */
export type SelectionOrientedQuad = readonly [Point, Point, Point, Point];

/** Axis-aligned bounds in world space (selection / scale). */
export interface BoundsRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Edge of the selection box (one-axis resize). */
export type BoxEdge = 'n' | 's' | 'e' | 'w';

/** Corner of the selection box (two-axis resize). */
export type BoxCorner = 'nw' | 'ne' | 'sw' | 'se';

export type BoxResizeHandle = BoxEdge | BoxCorner;

/** Live resize session (refs only during drag; not stored in React state). */
export interface SelectionResizeSession {
  handle: BoxResizeHandle;
  initialBounds: BoundsRect;
  lastPoint: Point;
  /** Shift = proportional scale (same factor on X and Y). */
  uniformScale: boolean;
}

/** Which corner’s rotation handle (offset outward from selection box). */
export type BoxRotateCorner = BoxCorner;

/** Live rotate session: group rotation around selection bounds center. */
export interface SelectionRotateSession {
  center: Point;
  /** Frame at rotate start (axis-aligned rect or persisted oriented quad). */
  initialRotateCorners: [Point, Point, Point, Point];
  /** Pointer-integrated angle since mousedown (before cardinal snap / hysteresis). */
  rawAccumulatedRadians: number;
  /** Locked cardinal index (×90°) while cursor stays within exit tolerance. */
  rotateSnapLockedK: number | null;
  /** Total rotation since mousedown (incremental; stable when cursor passes near pivot). */
  accumulatedRadians: number;
  /** Previous pointer sample for incremental angle (paired with `lastPoint` updates). */
  prevPointerForRotate: Point;
  lastPoint: Point;
  /** Path id → point array copy at drag start. */
  pathSnapshots: Record<string, Point[]>;
  /** Image id → pose at drag start. */
  imageSnapshots: Record<
    string,
    { x: number; y: number; width: number; height: number; rotation: number }
  >;
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

/** Rotate selection around `center` by `deltaRadians` (paths: transform points; images: x,y + rotation). */
export interface RotateOp extends OpMeta {
  type: 'rotate';
  ids: string[];
  center: Point;
  deltaRadians: number;
}

/** Logical batch; stored stack flattens to single ops ordered by timestamp. */
export interface BatchOp extends OpMeta {
  type: 'batch';
  operations: HistoryOperation[];
}

export type HistoryOperation =
  // | AddObjectOp
  | RemoveObjectsOp
  | AddObjectsOp
  | TranslateOp
  | ScaleBoundsOp
  | RotateOp
  | BatchOp;

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
  rotation: number;
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
  | RotateOp
  | BatchWireOp;
