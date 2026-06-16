import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Navigation from '../components/Navigation';
import { useAuthStore } from '../store/useAuthStore';
import type { Product } from '../App';

const ProductEdit = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);

  const [form, setForm] = useState({ title: '', price: '', description: '' });

  // ─── 비로그인 리다이렉트 ──────────────────────────────
  useEffect(() => {
    if (!accessToken) {
      navigate('/login');
    }
  }, [accessToken, navigate]);

  // ─── 상품 단건 조회 ───────────────────────────────────
  const { data: product, isLoading, isError } = useQuery<Product>({
    queryKey: ['product', id],
    queryFn: async () => {
      const res = await fetch(`http://localhost:1111/products/${id}`);
      if (!res.ok) throw new Error('상품을 불러올 수 없습니다.');
      return res.json();
    },
    enabled: !!id && !!accessToken,
  });

  // 조회된 데이터를 폼에 채우기
  useEffect(() => {
    if (product) {
      setForm({
        title: product.title,
        price: String(product.price),
        description: product.description,
      });
    }
  }, [product]);

  // ─── 상품 수정 (PATCH /products/:id) ─────────────────
  const updateMutation = useMutation({
    mutationFn: async (payload: { title: string; price: number; description: string }) => {
      const res = await fetch(`http://localhost:1111/products/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('수정에 실패했습니다.');
      // 백엔드 update()는 반환값 없음 → res 그대로 반환
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      navigate('/products');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const priceNum = Number(form.price);
    if (isNaN(priceNum) || priceNum < 0) return;

    updateMutation.mutate({
      title: form.title.trim(),
      price: priceNum,
      description: form.description.trim(),
    });
  };

  // 비로그인 상태면 렌더링 생략
  if (!accessToken) return null;

  // ─── 로딩 ────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex">
        <Navigation />
        <main className="flex-1 md:ml-[180px] pt-14 md:pt-0 flex items-center justify-center">
          <p className="text-xs text-gray-300 tracking-widest uppercase animate-pulse">
            Loading...
          </p>
        </main>
      </div>
    );
  }

  // ─── 에러 ────────────────────────────────────────────
  if (isError || !product) {
    return (
      <div className="min-h-screen bg-white flex">
        <Navigation />
        <main className="flex-1 md:ml-[180px] pt-14 md:pt-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-sm text-gray-400 mb-4">상품을 찾을 수 없습니다.</p>
            <Link
              to="/products"
              className="text-xs tracking-[0.12em] uppercase text-black border-b border-black pb-px"
            >
              ← Back
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // ─── 렌더링 ──────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white flex">
      <Navigation />

      <main className="flex-1 md:ml-[180px] pt-14 md:pt-0">
        <div className="max-w-md mx-auto px-6 md:px-12 lg:px-20 py-16 md:py-20">

          {/* 뒤로가기 */}
          <Link
            to="/products"
            className="inline-block text-[10px] tracking-[0.15em] uppercase text-gray-400 hover:text-black transition-colors mb-12"
          >
            ← Products
          </Link>

          <h1 className="text-2xl font-light tracking-[-0.01em] text-black mb-12">
            Edit Product
          </h1>

          <form onSubmit={handleSubmit} className="flex flex-col gap-10">

            <div>
              <label className="block text-[10px] tracking-[0.15em] uppercase text-gray-400 mb-3">
                Product Name
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                className="w-full h-11 border-b border-gray-200 focus:border-black outline-none text-sm text-black bg-transparent transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] tracking-[0.15em] uppercase text-gray-400 mb-3">
                Price (원)
              </label>
              <input
                type="number"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                required
                min="0"
                className="w-full h-11 border-b border-gray-200 focus:border-black outline-none text-sm text-black bg-transparent transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] tracking-[0.15em] uppercase text-gray-400 mb-3">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                required
                rows={4}
                className="w-full border-b border-gray-200 focus:border-black outline-none text-sm text-black bg-transparent transition-colors resize-none leading-relaxed pt-1"
              />
            </div>

            {updateMutation.isError && (
              <p className="text-xs text-red-500 -mt-4">
                수정에 실패했습니다. 다시 시도해주세요.
              </p>
            )}

            <div className="flex items-center gap-8 pt-2">
              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="text-xs tracking-[0.12em] uppercase text-white bg-black px-8 py-3 hover:bg-gray-800 transition-colors disabled:bg-gray-300"
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
              <Link
                to="/products"
                className="text-xs tracking-[0.12em] uppercase text-gray-400 hover:text-black transition-colors"
              >
                Cancel
              </Link>
            </div>

          </form>

        </div>
      </main>
    </div>
  );
};

export default ProductEdit;
