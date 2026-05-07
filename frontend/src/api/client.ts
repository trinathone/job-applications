import axios, { AxiosError } from "axios";
import { useAuthStore } from "../store/authStore";

const client = axios.create({
  baseURL: (import.meta.env.VITE_API_URL as string | undefined) ?? "/api",
  headers: { "Content-Type": "application/json" },
  timeout: 15_000,
});

// Attach Bearer token from auth store on every request
client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, clear auth state and redirect to /login
client.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clearAuth();
      // Only redirect if not already on the login page to avoid redirect loops
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default client;
