import { useAuthStore } from "../store/auth.store";
import { tokenStorage } from "../utils/TokenStorage";

export const useLogout = () => {
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const logout = async () => {
    tokenStorage.remove();
    clearAuth();
  };

  return { logout };
};
