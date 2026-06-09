import { useEffect } from 'react';
import { useAuthStore } from '../store/auth.store';
import { authApi } from '../api/auth.api';

export const useAuthStatus = () => {
  const setAuth = useAuthStore((state) => state.setAuth);
  const setAuthChecked = useAuthStore((state) => state.setAuthChecked);
  const hasCheckedAuth = useAuthStore((state) => state.hasCheckedAuth);
  useEffect(() => {
    if (hasCheckedAuth) return;
    authApi
      .me()
      .then(({ data }) => {
        setAuth({
          id: data.id,
          email: data.email,
          name: data.name,
          profileUrl: data.profileUrl,
        });
      })
      .finally(() => {
        setAuthChecked();
      });
  }, [hasCheckedAuth, setAuth, setAuthChecked]);
};
