import axios from "axios";

const TOKEN_STORAGE_KEY = "pharma_auth_token";

export function setAuthToken(token) {
  const value = String(token || "").trim();
  if (value) {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, value);
    axios.defaults.headers.common.Authorization = `Bearer ${value}`;
    return;
  }
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  delete axios.defaults.headers.common.Authorization;
}

export function initializeAuthToken() {
  const token = sessionStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    axios.defaults.headers.common.Authorization = `Bearer ${token}`;
  }
  return token;
}

export function clearAuthToken() {
  setAuthToken("");
}
