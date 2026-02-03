import { apiClient } from "../../../app/api/apiClient";
import type { Whiteboard } from "./dashboard.types";

export const dashboardApi = {
  getWhiteboards: () => apiClient.get<Whiteboard[]>("/boards"),
};
