import { authApi } from "../api/auth.api";
import { useAuthStore } from "../store/auth.store";
import { tokenStorage } from "../utils/TokenStorage";

export const useLogin = () => {
  const setAuth = useAuthStore((s) => s.setAuth);

  const login = async (email: string, password: string) => {
    const { data } = await authApi.login({ email, password });

    tokenStorage.set(data.accessToken);

    const user = {
      id: email,
      email: email,
    };

    setAuth(user);
  };

  return { login };
};
