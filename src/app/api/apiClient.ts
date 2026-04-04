import axios from 'axios';
import { env } from '../../utils/env';

export const apiClient = axios.create({
  baseURL: env.VITE_BASE_URL,
  withCredentials: true, // 👈 needed for refresh cookie
});
