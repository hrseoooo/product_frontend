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

// 응답 인터셉터: 401 에러 발생 시 로그아웃 및 리다이렉트 처리
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
