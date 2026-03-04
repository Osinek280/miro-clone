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
