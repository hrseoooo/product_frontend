import { Link, useNavigate } from "react-router-dom";
import { useForm } from 'react-hook-form';
import { useMutation } from "@tanstack/react-query";
import { useAuthStore } from "../store/useAuthStore";
import Navigation from '../components/Navigation';

interface LoginFormData {
    email: string;
    password:string;
}

const Login = () => {
    const { register, handleSubmit } = useForm();
    const setAccessToken = useAuthStore((state) => state.setAccessToken);

    const navigate = useNavigate();

    // ★ useMutation 작성 시작
        const loginMutation = useMutation({
            mutationFn: async (data: LoginFormData) => {
                const response = await fetch('http://localhost:1111/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(data),
                });
                
                if (!response.ok) {
                    throw new Error('로그인 실패');
                }
                
                return response.json();
            },
            onSuccess: (data) => {
                console.log('로그인 성공:', data.access_token);
                alert('로그인이 완료되었습니다!');
                // 여기서 로그인 페이지로 리다이렉트 등 처리

                //여기서 꺼내온 함수에 토큰을 넣어서 호출해!
                setAccessToken(data.access_token);

                navigate('/'); // 로그인 성공 후 홈으로 이동
            },
            onError: (error: any) => {
                console.error('로그인 에러:', error);
                alert('로그인 실패: ' + error.message);
            },
        });
        // ★ useMutation 작성 끝



     const onSubmit = (data: any) => {
        // alert('로그인 폼이 제출되었습니다!');
         console.log(data);
         loginMutation.mutate(data);
    }

  return (
    <div>

          <Navigation/>
    {/* <nav style={{ padding: '20px', background: '#eee' }}>
      <Link to="/" style={{ marginRight: '10px' }}>홈</Link>
      <Link to="/login" style={{ marginRight: '10px' }}>로그인</Link>
      <Link to="/signup" style={{ marginRight: '10px' }}>회원가입</Link>
    </nav> */}
        
        
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* 3. register로 이름만 지어주면 끝! */}
      <input type="email" {...register('email', { required: true })} placeholder="이메일" />
      <input type="password" {...register('password', { required: true })} placeholder="비밀번호" />
      
      <button type="submit">로그인</button>
    </form>

    







    </div>
  );
}

export default Login;
