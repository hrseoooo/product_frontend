import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import Navigation from "../components/Navigation";
import Swal from "sweetalert2";

interface SignUpFormData {
  email: string;
  name: string;
  password: string;
}

const SignUp = () => {
  const { register, handleSubmit } = useForm<SignUpFormData>();
  const navigate = useNavigate();

  const signupMutation = useMutation({
    mutationFn: async (data: SignUpFormData) => {
      const response = await fetch("http://localhost:1111/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("회원가입 실패");
      }

      return response.json();
    },
    onSuccess: () => {
      Swal.fire({
        title: "SIGN UP SUCCESS",
        text: "회원가입이 완료되었습니다.",
        customClass: {
          popup: "minimal-swal",
          confirmButton: "minimal-confirm",
        },
        buttonsStyling: false,
      }).then(() => {
        navigate("/login");
      });
    },
    onError: (error: any) => {
      Swal.fire({
        title: "SIGN UP FAILED",
        text: "회원가입 실패: " + error.message,
        customClass: {
          popup: "minimal-swal",
          confirmButton: "minimal-confirm",
        },
        buttonsStyling: false,
      });
    },
  });

  const onSubmit = (data: SignUpFormData) => {
    signupMutation.mutate(data);
  };

  return (
    <div className="app-container">
      <Navigation />
      
      <div className="auth-container">
        <h2 className="auth-title">Create Account</h2>
        
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
          <input
            type="text"
            {...register("name", { required: true })}
            placeholder="NAME"
          />
          
          <button type="submit">CREATE</button>
        </form>
      </div>
    </div>
  );
};

export default SignUp;
