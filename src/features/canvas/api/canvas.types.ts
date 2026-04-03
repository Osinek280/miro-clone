import type { EquationRow } from '../../desmos/types/types';
import type { Camera, DrawObject } from '../types/types';

export interface Snapshot {
  boardId: string;
  serverTimestamp: string;
  objects: DrawObject[];
  camera: Camera;
  equations: EquationRow[];
}
