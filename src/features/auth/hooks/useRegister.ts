import { authApi } from "../api/auth.api";
import { useAuthStore } from "../store/auth.store";
import { tokenStorage } from "../utils/TokenStorage";

export const useRegister = () => {
  const setAuth = useAuthStore((s) => s.setAuth);

  const register = async (
    firstname: string,
    lastname: string,
    email: string,
    password: string,
  ) => {
    const { data } = await authApi.register({
      firstname,
      lastname,
      email,
      password,
    });

    if (data.accessToken) {
      tokenStorage.set(data.accessToken);

      const user = {
        id: email,
        email: email,
      };

      setAuth(user);
    }
  };

  return { register };
};
