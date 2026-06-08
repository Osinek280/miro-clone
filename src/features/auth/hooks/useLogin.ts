import { authApi } from '../api/auth.api';
import { useAuthStore } from '../store/auth.store';

export const useLogin = () => {
  const setAuth = useAuthStore((s) => s.setAuth);

  const login = async (email: string, password: string) => {
    await authApi.login({ email, password });
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

  return { login };
};
