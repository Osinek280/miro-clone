import { authApi } from '../api/auth.api';
import { useAuthStore } from '../store/auth.store';

export const useRegister = () => {
  const setAuth = useAuthStore((s) => s.setAuth);

  const register = async (name: string, email: string, password: string) => {
    await authApi.register({
      name,
      email,
      password,
    });

    await authApi.me().then((response) => {
      const user = response.data;
      setAuth({
        id: user.id,
        email: user.email,
        name: user.name,
        profileUrl: user.profileUrl,
      });
    });
  };

  return { register };
};
