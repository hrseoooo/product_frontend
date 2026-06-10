import { useQuery } from '@tanstack/react-query';
import { useUIStore } from './store/useUIStore';
import { Link } from 'react-router-dom';

// 백엔드의 Entity/DTO와 동일한 타입
interface Product {
  id: number;
  title: string;
  price: number;
  description: string;
}

function App() {
  // 1. Zustand 전역 상태 가져오기
  const { viewMode, toggleViewMode } = useUIStore();

  // 2. React Query로 서버 상태 가져오기 (Nest.js 백엔드 호출)
  const { data: products, isLoading, isError } = useQuery<Product[]>({
    queryKey: ['products'], // 이 데이터의 고유 이름 (캐싱에 사용됨)
    queryFn: async () => {
      const res = await fetch('http://localhost:1111/products');
      if (!res.ok) throw new Error('네트워크 응답이 좋지 않습니다.');
      return res.json();
    },
  });

  // React Query가 제공하는 편리한 로딩/에러 처리
  if (isLoading) return <h2>데이터를 불러오는 중입니다...</h2>;
  if (isError) return <h2>에러가 발생했습니다! 서버를 확인해주세요.</h2>;

  return (
    <div style={{ padding: '20px' }}>

    <nav style={{ padding: '20px', background: '#eee' }}>
      {/* href 대신 to를 사용합니다 */}
      <Link to="/" style={{ marginRight: '10px' }}>홈</Link>
      <Link to="/login" style={{ marginRight: '10px' }}>로그인</Link>
      <Link to="/signup" style={{ marginRight: '10px' }}>회원가입</Link>
    </nav>
    
      <h1>중고 마켓 상품 리스트</h1>

      {/* Zustand 전역 상태를 변경하는 버튼 */}
      <button onClick={toggleViewMode} style={{ marginBottom: '20px' }}>
        현재 모드: {viewMode === 'list' ? '목록형' : '격자형'} (클릭해서 변경)
      </button>

      <div style={{
        display: viewMode === 'grid' ? 'grid' : 'block',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: '10px'
      }}>
        {products?.map((product) => (
          <div key={product.id} style={{ border: '1px solid #ccc', padding: '10px' }}>
            <h3>{product.title}</h3>
            <p style={{ fontWeight: 'bold' }}>{product.price}원</p>
            <p>{product.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;



// import type { FormEvent } from 'react';
// import './App.css';
// import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
// import { LocalStateExample } from './components/LocalStateExample';
// import { GlobalStateExample } from './components/GlobalStateExample';
// import { useUIStore } from './store/useUIStore';

// interface Product {
//   id: number;
//   title: string;
//   price: number;
//   description: string;
//   createdAt: string;
// }

// function App() {
//   const { data, isLoading } = useQuery<Product[]>({
//     queryKey: ['products'],
//     queryFn: async () => {
//       const response = await fetch('http://localhost:1111/products');
//       if (!response.ok) {
//         throw new Error('Network response was not ok');
//       }
//       return response.json();
//     },
//   });

//   const queryClient = useQueryClient();
//   const viewMode = useUIStore((state) => state.viewMode);

//   const mutation = useMutation({
//     mutationFn: async (newProduct: Omit<Product, 'id' | 'createdAt'>) => {
//       const response = await fetch('http://localhost:1111/products', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify(newProduct),
//       });
//       if (!response.ok) {
//         throw new Error('Network response was not ok');
//       }
//       return response.json();
//     },
//     onSuccess: () => {
//       queryClient.invalidateQueries({
//         queryKey: ['products'],
//       });
//     },
//   });

//   const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     const formData = new FormData(e.currentTarget);
//     const newProduct = {
//       title: formData.get('title') as string,
//       price: Number(formData.get('price')),
//       description: formData.get('description') as string,
//     };
//     mutation.mutate(newProduct);
//   };

//   return (
//     <main className="app-shell">
//       <h1>제품 목록</h1>

//       <div className="state-examples">
//         <LocalStateExample />
//         <GlobalStateExample />
//       </div>

//       <p className="list-mode-label">현재 메인 목록 뷰 모드: {viewMode}</p>
//       <section className={`product-list ${viewMode}`}>
//         {isLoading || !data ? (
//           <p>로딩중...</p>
//         ) : (
//           data.map((item) => (
//             <article key={item.id} className="product-card">
//               <h2>{item.title}</h2>
//               <p>{item.description}</p>
//               <p>가격: {item.price}원</p>
//             </article>
//           ))
//         )}
//       </section>

//       <form className="product-form" onSubmit={handleSubmit}>
//         <h2>상품 생성</h2>
//         <input name="title" placeholder="상품명" required />
//         <input name="price" type="number" placeholder="가격" required />
//         <textarea name="description" placeholder="설명" required />
//         <button type="submit">상품 생성</button>
//       </form>
//     </main>
//   );
// }

// export default App;
