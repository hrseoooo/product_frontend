import { createBrowserRouter } from "react-router-dom";
import App from "../App";
import CategoryMapping from "../pages/CategoryMapping";
import Login from "../pages/Login";
import ProductDetail from "../pages/ProductDetail";
import Register from "../pages/Register";
import SignUp from "../pages/SignUp";

/** 애플리케이션의 URL과 화면 컴포넌트 연결을 한 곳에서 관리합니다. */
export const router = createBrowserRouter([
  { path: "/", element: <App /> },
  { path: "/login", element: <Login /> },
  { path: "/signup", element: <SignUp /> },
  { path: "/register", element: <Register /> },
  { path: "/products/:id", element: <ProductDetail /> },
  { path: "/category-mapping", element: <CategoryMapping /> },
]);
