import { authApi } from "../api/auth.api";
import { useAuthStore } from "../store/auth.store";
import { parseJwt } from "../utils/parseJwt";
import { tokenStorage } from "../utils/TokenStorage";

export const useLogin = () => {
  const setAuth = useAuthStore((s) => s.setAuth);

  const login = async (email: string, password: string) => {
    const { data } = await authApi.login({ email, password });

    tokenStorage.set(data.accessToken);

    const payload = parseJwt(data.accessToken);

    if (!payload) {
      throw new Error("Token parsing failed");
    }

    const user = {
      id: payload.userId,
      email: payload.sub,
    };

    setAuth(user);
  };

  return { login };
};
