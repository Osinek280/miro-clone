import { apiClient } from "../../../app/api/apiClient";
import type { Whiteboard } from "./dashboard.types";
import "../../../app/api/interceptors";

export const dashboardApi = {
  getWhiteboards: () => apiClient.get<Whiteboard[]>("/api/boards"),
};
