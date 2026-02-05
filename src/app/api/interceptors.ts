// app/api/interceptors.ts
import { authApi } from "../../features/auth/api/auth.api";
import { useAuthStore } from "../../features/auth/store/auth.store";
import { tokenStorage } from "../../features/auth/utils/TokenStorage";
import { apiClient } from "./apiClient";

let isRefreshing = false;
let queue: ((value?: unknown) => void)[] = [];

apiClient.interceptors.request.use((config) => {
  console.log("[Request Interceptor] Wywołany dla URL:", config.url);

  const token = tokenStorage.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        await new Promise((resolve) => queue.push(resolve));
        return apiClient(originalRequest);
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await authApi.refresh();
        tokenStorage.set(data.accessToken);

        queue.forEach((cb) => cb());
        queue = [];

        return apiClient(originalRequest);
      } catch {
        console.log(
          "[Response Interceptor] Odświeżanie tokena nie powiodło się. Wylogowywanie użytkownika.",
        );
        tokenStorage.remove();
        useAuthStore.getState().clearAuth();
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);
