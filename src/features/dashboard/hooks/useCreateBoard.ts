import { useState } from "react";
import { dashboardApi } from "../api/dashboard.api";

export const useCreateBoard = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const createBoard = async (data: { name: string }): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      await dashboardApi.createWhiteboard(data);
    } catch (err) {
      setError(err);
      return;
    } finally {
      setLoading(false);
    }
  };

  return { createBoard, loading, error };
};
