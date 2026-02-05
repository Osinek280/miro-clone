import { apiClient } from "../../../app/api/apiClient";
import type { Whiteboard } from "./dashboard.types";
import "../../../app/api/interceptors";

export const dashboardApi = {
  getWhiteboards: () => apiClient.get<Whiteboard[]>("/api/boards"),

  createWhiteboard: (data: { name: string }) =>
    apiClient.post<Whiteboard>("/api/boards", data),

  deleteWhiteboard: (id: string) => apiClient.delete(`/api/boards/${id}`),
};
