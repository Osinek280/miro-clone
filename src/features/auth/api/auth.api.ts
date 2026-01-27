import { apiClient } from "../../../app/api/apiClient";
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
} from "./auth.types";

export const authApi = {
  login: (data: LoginRequest) =>
    apiClient.post<LoginResponse>("/auth/login", data),

  register: (data: RegisterRequest) =>
    apiClient.post<RegisterResponse>("/auth/register", data),

  // logout: () => apiClient.post("/auth/logout"),

  refresh: () => apiClient.post<{ accessToken: string }>("/auth/refresh"),
};
