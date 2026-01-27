import { useNavigate } from "react-router-dom";
import { useLogout } from "../features/auth/hooks/useLogout";

export const DashboardPage = () => {
  const navigate = useNavigate();
  const { logout } = useLogout();
  // const logout = useAuthStore((state) => state.clearAuth); // dostosuj do nazwy funkcji w twoim store

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header z przyciskiem wylogowania */}
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
    </div>
  );
};
