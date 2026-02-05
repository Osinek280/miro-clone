import { useState } from "react";
import { dashboardApi } from "../api/dashboard.api";

export const useBoardActions = () => {
  const [isCreating, setIsCreating] = useState(false);

  const createBoard = async (data: { name: string }): Promise<void> => {
    try {
      setIsCreating(true);

      await dashboardApi.createWhiteboard(data);
    } catch (err: any) {
      throw err;
    } finally {
      setIsCreating(false);
    }
  };

  return {
    createBoard,
    isCreating,
  };
};
