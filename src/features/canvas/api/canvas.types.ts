import type { Camera, DrawObject } from '../types/types';

export interface Snapshot {
  boardId: string;
  serverTimestamp: string;
  objects: DrawObject[];
  camera: Camera;
}
