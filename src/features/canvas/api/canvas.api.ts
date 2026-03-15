import { apiClient } from '../../../app/api/apiClient';
import type { Snapshot } from './canvas.types';

export const canvasApi = {
  getSnapshot: (id: string) =>
    apiClient.get<Snapshot>(`/api/boards/${id}/snapshot`),
};
