import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./App.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Login from "./pages/Login.tsx";
import SignUp from "./pages/SignUp.tsx";
import Register from "./pages/Register.tsx";

// QueryClient 인스턴스 생성
const queryClient = new QueryClient();

// 1. 주소와 컴포넌트 연결 지도(Route) 만들기
const router = createBrowserRouter([
  {
    path: "/", // http://localhost:5173/
    element: <App />,
  },
  {
    path: "/login", // http://localhost:5173/login
    element: <Login />,
  },
  {
    path: "/signup", // http://localhost:5173/signup
    element: <SignUp />,
  },
  {
    path: "/register", // http://localhost:5173/register
    element: <Register />,
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);
