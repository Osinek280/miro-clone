// app/api/interceptors.ts
import { authApi } from '../../features/auth/api/auth.api';
import { useAuthStore } from '../../features/auth/store/auth.store';
import { apiClient } from './apiClient';

let isRefreshing = false;
let queue: ((value?: unknown) => void)[] = [];

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;

    const isRefreshRequest = originalRequest.url?.includes('/auth/refresh');

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isRefreshRequest
    ) {
      if (isRefreshing) {
        await new Promise((resolve) => queue.push(resolve));
        return apiClient(originalRequest);
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await authApi.refresh();
        queue.forEach((cb) => cb());
        queue = [];

        return apiClient(originalRequest);
      } catch {
        console.log(
          '[Response Interceptor] Token refresh failed. Logging out user.',
        );
        useAuthStore.getState().clearAuth();
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);
