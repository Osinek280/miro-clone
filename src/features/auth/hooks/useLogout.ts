import { useAuthStore } from '../store/auth.store';
import { authApi } from '../api/auth.api';

export const useLogout = () => {
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const logout = async () => {
    await authApi.logout();
    clearAuth();
  };

  return { logout };
};
