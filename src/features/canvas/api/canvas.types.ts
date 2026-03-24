import type { DrawObject } from '../types/types';

export interface Snapshot {
  boardId: string;
  serverTimestamp: string;
  objects: DrawObject[];
  camera: {
    x: number;
    y: number;
    zoom: number;
  };
}
