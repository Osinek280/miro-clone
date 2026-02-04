import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLogout } from "../features/auth/hooks/useLogout";
import { useAuthStore } from "../features/auth/store/auth.store";
import { useDashboard } from "../features/dashboard/hooks/useDashboard";
import { DashboardHeader } from "../features/dashboard/components/DashboardHeader";
import { DashboardToolbar } from "../features/dashboard/components/DashboardToolbar";
import { EmptyState } from "../features/dashboard/components/EmptyState";
import { BoardsGrid } from "../features/dashboard/components/BoardsGrid";
import { BoardsList } from "../features/dashboard/components/BoardList";

export const DashboardPage = () => {
  const navigate = useNavigate();
  const { logout } = useLogout();
  const user = useAuthStore((s) => s.user);
  const { boards, loading, error } = useDashboard();

  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const filtered = boards.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <DashboardHeader
        email={user?.email}
        onCreate={() => console.log("create")}
        onLogout={async () => {
          await logout();
          navigate("/");
        }}
      />

      <div className="max-w-7xl mx-auto p-6">
        <DashboardToolbar
          search={search}
          onSearch={setSearch}
          viewMode={viewMode}
          setViewMode={setViewMode}
        />

        {loading && <p>Ładowanie...</p>}
        {error && <p>{error}</p>}

        {!loading && filtered.length === 0 && (
          <EmptyState searching={!!search} onCreate={() => {}} />
        )}

        {!loading &&
          filtered.length > 0 &&
          (viewMode === "grid" ? (
            <BoardsGrid
              boards={filtered}
              onOpen={(id) => navigate(`/board/${id}`)}
            />
          ) : (
            <BoardsList
              boards={filtered}
              onOpen={(id) => navigate(`/board/${id}`)}
            />
          ))}
      </div>
    </div>
  );
};
