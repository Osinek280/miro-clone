import { apiClient } from '../../../app/api/apiClient';
import type { LoginRequest, RegisterRequest, UserDto } from './auth.types';

export const authApi = {
  login: (data: LoginRequest) => apiClient.post<void>('/auth/login', data),

  register: (data: RegisterRequest) =>
    apiClient.post<void>('/auth/register', data),

  refresh: () => apiClient.post<void>('/auth/refresh'),

  logout: () => apiClient.post<void>('/auth/logout'),
  me: () => apiClient.get<UserDto>('/user/me'),
};
