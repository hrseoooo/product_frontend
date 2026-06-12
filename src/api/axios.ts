import axios from "axios";
import { useAuthStore } from "../store/useAuthStore";

const api = axios.create({
  baseURL: "http://localhost:1111", // 백엔드 주소
  timeout: 5000,
});

// 요청 인터셉터: 모든 요청 전에 실행됩니다.
api.interceptors.request.use(
  (config) => {
    // zustand store에서 직접 토큰을 가져옵니다.
    const token = useAuthStore.getState().accessToken;

    if (token) {
      // 토큰이 존재하면 Authorization 헤더에 Bearer 토큰을 추가합니다.
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

export default api;
