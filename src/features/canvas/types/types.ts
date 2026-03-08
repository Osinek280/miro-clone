export interface Point {
  x: number;
  y: number;
}

export interface DrawObject {
  id: string;
  type: "path";
  points: Point[];
  color: string;
  selected: boolean;
  size: number;

  _cachedPositions?: Float32Array;
  _cachedAlphas?: Float32Array;
}

export interface Camera {
  zoom: number;
  offsetX: number;
  offsetY: number;
}

export enum DrawModeEnum {
  Draw = "draw",
  Select = "select",
}

export type ToolState = {
  color: string;
  size: number;
};
