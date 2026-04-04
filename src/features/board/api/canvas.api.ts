import { apiClient } from '../../../app/api/apiClient';
import type { Camera, DrawObject } from '../types/types';
import type { Snapshot } from './canvas.types';
import { tokenStorage } from '../../auth/utils/TokenStorage';

/**
 * Persists camera on tab close/navigation. Uses fetch + keepalive (not axios) so the
 * request can outlive the page; sendBeacon cannot set Authorization.
 */
function sendCameraKeepalive(boardId: string, payload: Camera): void {
  const baseURL = apiClient.defaults.baseURL ?? '';
  const url = `${String(baseURL).replace(/\/$/, '')}/api/boards/${boardId}/camera`;
  const token = tokenStorage.get();
  void fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
    keepalive: true,
  });
}

export const canvasApi = {
  getSnapshot: (id: string) =>
    apiClient.get<Snapshot>(`/api/boards/${id}/snapshot`),
  sendSnapshot: (boardId: string, objects: DrawObject[]) =>
    apiClient.post(`/api/boards/${boardId}/snapshot`, { objects }),
  sendCameraKeepalive,
};
