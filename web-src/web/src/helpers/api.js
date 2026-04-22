import { showError } from './utils';
import axios from 'axios';

export const API = axios.create({
  baseURL: process.env.REACT_APP_SERVER ? process.env.REACT_APP_SERVER : '',
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      return Promise.reject(error);
    }
    // Network error (no backend) — reject silently
    return Promise.reject(error);
  }
);
