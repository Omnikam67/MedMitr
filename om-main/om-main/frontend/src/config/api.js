const rawApiBase =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE ||
  "http://127.0.0.1:8000";

export const API_BASE = rawApiBase.replace(/\/+$/, '');

export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_BASE;
