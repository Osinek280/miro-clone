import { apiClient } from '../../../app/api/apiClient';
import type { DrawObject } from '../types/types';
import type { Snapshot } from './canvas.types';

export const canvasApi = {
  getSnapshot: (id: string) =>
    apiClient.get<Snapshot>(`/api/boards/${id}/snapshot`),
  sendSnapshot: (boardId: string, objects: DrawObject[]) =>
    apiClient.post(`/api/boards/${boardId}/snapshot`, { objects }),
};
