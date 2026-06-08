// features/auth/store/auth.store.ts
import { create } from 'zustand';
import type { UserDto } from '../api/auth.types';

type AuthState = {
  user: UserDto | null;
  isAuthenticated: boolean;
  hasCheckedAuth: boolean;
  setAuth: (user: UserDto) => void;
  clearAuth: () => void;
  setAuthChecked: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  hasCheckedAuth: false,
  setAuth: (user) =>
    set({
      user,
      isAuthenticated: true,
    }),
  clearAuth: () =>
    set({
      user: null,
      isAuthenticated: false,
    }),
  setAuthChecked: () => set({ hasCheckedAuth: true }),
}));
