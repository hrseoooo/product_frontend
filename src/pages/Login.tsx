import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { useAuthStore } from "../store/useAuthStore";
import Navigation from "../components/Navigation";
import Swal from "sweetalert2";
import { useEffect } from "react";

interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

const Login = () => {
  const { register, handleSubmit, setValue } = useForm<LoginFormData>();
  const setAccessToken = useAuthStore((state) => state.setAccessToken);
  const navigate = useNavigate();

  // 이전에 로그인 성공했던 이메일/비밀번호 불러오기
  useEffect(() => {
    const savedEmail = localStorage.getItem("savedEmail");
    const savedPassword = localStorage.getItem("savedPassword");
    if (savedEmail) {
      setValue("email", savedEmail);
      // setValue("rememberMe", true);
    }
    if (savedPassword) setValue("password", savedPassword);
  }, [setValue]);

  const loginMutation = useMutation({
    mutationFn: async (data: LoginFormData) => {
      // 서버에서 허용하지 않는 rememberMe 속성을 제외하고 전송합니다.
      const { rememberMe, ...apiData } = data;

      const response = await fetch("http://localhost:1111/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(apiData),
      });

      if (!response.ok) {
        throw new Error("로그인 실패");
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      // 로그인 성공 시 기억하기 체크 여부에 따라 처리
      if (variables.rememberMe) {
        localStorage.setItem("savedEmail", variables.email);
        localStorage.setItem("savedPassword", variables.password);
      } else {
        localStorage.removeItem("savedEmail");
        localStorage.removeItem("savedPassword");
      }

      setAccessToken(data.access_token);
      Swal.fire({
        title: "LOGIN SUCCESS",
        text: "로그인이 완료되었습니다.",
        customClass: {
          popup: "minimal-swal",
          confirmButton: "minimal-confirm",
        },
        buttonsStyling: false,
      }).then(() => {
        navigate("/");
      });
    },
    onError: (error: any) => {
      Swal.fire({
        title: "LOGIN FAILED",
        text: "로그인 실패: " + error.message,
        customClass: {
          popup: "minimal-swal",
          confirmButton: "minimal-confirm",
        },
        buttonsStyling: false,
      });
    },
  });

  const onSubmit = (data: LoginFormData) => {
    loginMutation.mutate(data);
  };

  return (
    <div className="app-container">
      <Navigation />

      <div className="auth-container">
        <h2 className="auth-title">Login</h2>

        <form className="auth-form" onSubmit={handleSubmit(onSubmit)}>
          <input
            type="email"
            {...register("email", { required: true })}
            placeholder="EMAIL"
          />
          <input
            type="password"
            {...register("password", { required: true })}
            placeholder="PASSWORD"
          />

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginTop: "8px",
              marginBottom: "16px",
            }}
          >
            <input
              type="checkbox"
              id="rememberMe"
              {...register("rememberMe")}
              style={{ width: "auto" }}
            />
            <label
              htmlFor="rememberMe"
              style={{ fontSize: "14px", color: "#666", cursor: "pointer" }}
            >
              마지막 선택값 기억하기
            </label>
          </div>

          <button type="submit">SIGN IN</button>
        </form>
      </div>
    </div>
  );
};

export default Login;
