export interface Point {
  x: number;
  y: number;
}

export interface DrawObject {
  id: string;
  type: "path";
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
  Draw = "draw",
  Select = "select",
  Grab = "grab",
}

export type ToolState = {
  color: string;
  size: number;
};

export type SelectionBox = { start: Point; end: Point } | null;