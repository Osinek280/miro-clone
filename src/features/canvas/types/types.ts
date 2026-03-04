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

export type DrawMode = "draw" | "select";
