import { useEffect } from 'react';
import { tokenStorage } from '../utils/TokenStorage';
import { parseJwt } from '../utils/parseJwt';
import { useAuthStore } from '../store/auth.store';

export const useAuthStatus = () => {
  const setAuth = useAuthStore((state) => state.setAuth);
  const setAuthChecked = useAuthStore((state) => state.setAuthChecked);
  useEffect(() => {
    const token = tokenStorage.get();
    if (!token) {
      setAuthChecked();
      return;
    }
    const payload = parseJwt(token);

    if (!payload) {
      tokenStorage.remove();
      setAuthChecked();
      return;
    }

    const now = Math.floor(Date.now() / 1000);

    if (payload.exp < now) {
      tokenStorage.remove();
      setAuthChecked();
      return;
    }

    setAuth({
      id: payload.userId,
      email: payload.sub,
    });
    setAuthChecked();
  }, [setAuth, setAuthChecked]);
};
