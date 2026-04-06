import axios from 'axios';
import { clearSession, getSessionActor, getToken } from "../utils/session";
import { API_BASE_URL } from "./apiBaseUrl";

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      const actor = getSessionActor();
      clearSession();
      const redirectPath = actor === "admin" ? "/admin/login" : "/";
      if (window.location.pathname !== redirectPath) {
        window.location.href = redirectPath;
      }
    }
    return Promise.reject(error);
  },
);

export default api;
