import { useState, useEffect } from "react";
import type { Whiteboard } from "../api/dashboard.types";
import { dashboardApi } from "../api/dashboard.api";

export const useDashboard = () => {
  const [boards, setBoards] = useState<Whiteboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBoards = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await dashboardApi.getWhiteboards();
      setBoards(data);
    } catch (err) {
      console.error("Failed to fetch boards:", err);
      setError("Nie udało się pobrać tablic");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBoards();
  }, []);

  return { boards, loading, error, fetchBoards, setBoards };
};
