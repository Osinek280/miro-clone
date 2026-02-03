import { useNavigate } from "react-router-dom";
import { useLogout } from "../features/auth/hooks/useLogout";
import { useAuthStore } from "../features/auth/store/auth.store";
import { useEffect } from "react";
import { useDashboard } from "../features/dashboard/hooks/useDashboard";

export const DashboardPage = () => {
  const navigate = useNavigate();
  const { logout } = useLogout();
  const user = useAuthStore((state) => state.user);
  const { boards, loading, error } = useDashboard();

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  useEffect(() => {}, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold"
          >
            Wyloguj się
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-xl font-semibold text-gray-800">
          Witaj, {user?.email}!
        </h2>
        <p className="mt-2 text-gray-600">Twoje ID: {user?.id}</p>

        <section className="mt-8">
          <h3 className="text-lg font-semibold text-gray-700">Twoje tablice</h3>
          {loading && <p>Ładowanie tablic...</p>}
          {error && <p className="text-red-500">{error}</p>}
          {!loading && !error && boards.length === 0 && (
            <p>Nie masz żadnych tablic</p>
          )}
          <ul className="mt-4 space-y-2">
            {boards.map((board) => (
              <li key={board.id} className="p-4 bg-white shadow rounded">
                {board.name}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
};
