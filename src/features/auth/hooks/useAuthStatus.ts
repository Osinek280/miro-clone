import { useEffect } from "react";
import { tokenStorage } from "../utils/TokenStorage";
import { parseJwt } from "../utils/parseJwt";
import { useAuthStore } from "../store/auth.store";

export const useAuthStatus = () => {
  const setAuth = useAuthStore((state) => state.setAuth);
  useEffect(() => {
    const token = tokenStorage.get();
    console.log("Retrieved token:", token);
    if (!token) {
      return;
    }
    const payload = parseJwt(token);

    if (!payload) {
      tokenStorage.remove();
      return;
    }

    const now = Math.floor(Date.now() / 1000);

    if (payload.exp < now) {
      tokenStorage.remove();
      return;
    }

    setAuth({
      id: payload.sub,
      email: payload.sub,
    });
  }, []);
};
