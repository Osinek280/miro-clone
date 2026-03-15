// features/auth/store/auth.store.ts
import { create } from 'zustand';

type User = {
  id: string;
  email: string;
};

type AuthState = {
  user: User | null;
  isAuthenticated: boolean;
  hasCheckedAuth: boolean;
  setAuth: (user: User) => void;
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
