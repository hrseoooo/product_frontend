import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from 'react-hook-form';
import { useMutation } from "@tanstack/react-query";
import Navigation from '../components/Navigation';


interface SignUpFormData {
    email: string;
    name: string;
    password:string;
}


const SignUp = () => {

    const { register, handleSubmit } = useForm();

     // ★ useMutation 작성 시작
    const signupMutation = useMutation({
        mutationFn: async (data: SignUpFormData) => {
            const response = await fetch('http://localhost:1111/auth/signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });
            
            if (!response.ok) {
                throw new Error('회원가입 실패');
            }
            
            return response.json();
        },
        onSuccess: (data) => {
            console.log('회원가입 성공:', data);
            alert('회원가입이 완료되었습니다!');
            // 여기서 로그인 페이지로 리다이렉트 등 처리
        },
        onError: (error: any) => {
            console.error('회원가입 에러:', error);
            alert('회원가입 실패: ' + error.message);
        },
    });
    // ★ useMutation 작성 끝

// const [email, setEmail] = useState('');
// const [password, setPassword] = useState('');
// const [name, setName] = useState('');

  const onSubmit = (data: any) => {
        // alert('회원가입 폼이 제출되었습니다!');
        // console.log(data);
        
        signupMutation.mutate(data);
    }

  return (
    <div>

          <Navigation/>
    {/* <nav style={{ padding: '20px', background: '#eee' }}>
      <Link to="/" style={{ marginRight: '10px' }}>홈</Link>
      <Link to="/login" style={{ marginRight: '10px' }}>로그인</Link>
      <Link to="/signup" style={{ marginRight: '10px' }}>회원가입</Link>
    </nav> */}
        
        {/* 폼~~ */}

{/* <form onSubmit={(e) => {
    alert('회원가입 폼이 제출되었습니다!');
    console.log('이메일:', email);
    console.log('비밀번호:', password);
    console.log('이름:', name);
    e.preventDefault(); // 페이지 새로고침 방지
}}>

            <label htmlFor="email">이메일</label>
            <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <label htmlFor="password">비밀번호</label>
            <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <label htmlFor="name">이름</label>
            <input type="text" id="name" value={name} onChange={(e) => setName(e.target.value)} />
            <button type="submit">회원가입</button>
</form> */}


    <form onSubmit={handleSubmit(onSubmit)}>
      {/* 3. register로 이름만 지어주면 끝! */}
      <input type="email" {...register('email', { required: true })} placeholder="이메일" />
      <input type="password" {...register('password', { required: true })} placeholder="비밀번호" />
      <input type="text" {...register('name', { required: true })} placeholder="이름" />
      
      <button type="submit">회원가입</button>
    </form>
        
    </div>
  );
}

export default SignUp;
