import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import Navigation from '../components/Navigation';
import { useAuthStore } from '../store/useAuthStore';
import api from '../api/axios';
import type { Product } from '../App';

const formatPrice = (price: number) =>
  new Intl.NumberFormat('ko-KR').format(price);

type Tab = 'browse' | 'new';

const Products = () => {
  const accessToken = useAuthStore((s) => s.accessToken);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<Tab>('browse');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ title: '', price: '', description: '' });
  const [formError, setFormError] = useState('');

  // ─── 비로그인 리다이렉트 (hooks 이후에 처리) ──────────
  useEffect(() => {
    if (!accessToken) {
      navigate('/login');
    }
  }, [accessToken, navigate]);

  // ─── 상품 조회 (서버 사이드 검색) ───────────────────────
  // 이전에는 상품 전체를 클라이언트로 내려받은 뒤 브라우저에서 filter()로
  // 걸러냈습니다. 데이터가 누적될수록 대역폭/메모리 낭비가 커지므로,
  // 검색어를 서버에 위임하고 결과만 받아오도록 변경했습니다.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: productsResponse, isLoading, isError } = useQuery<{
    items: Product[];
    total: number;
  }>({
    queryKey: ['products', debouncedSearch],
    queryFn: async () => {
      const { data } = await api.get<{ items: Product[]; total: number }>(
        '/products',
        { params: debouncedSearch ? { search: debouncedSearch } : undefined },
      );
      return data;
    },
    enabled: !!accessToken,
  });

  const filtered = productsResponse?.items;

  // ─── 상품 등록 ────────────────────────────────────────
  const registerMutation = useMutation({
    mutationFn: async (payload: { title: string; price: number; description: string }) => {
      const { data } = await api.post('/products', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setForm({ title: '', price: '', description: '' });
      setFormError('');
      setTab('browse');
    },
    onError: (e: any) => setFormError(e.message),
  });

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const priceNum = Number(form.price);
    if (!form.title.trim() || !form.description.trim()) {
      setFormError('모든 항목을 입력해주세요.');
      return;
    }
    if (isNaN(priceNum) || priceNum < 0) {
      setFormError('올바른 가격을 입력해주세요.');
      return;
    }

    registerMutation.mutate({
      title: form.title.trim(),
      price: priceNum,
      description: form.description.trim(),
    });
  };

  // 비로그인 상태이면 아무것도 렌더링하지 않음
  if (!accessToken) return null;

  // ─── 렌더링 ──────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white flex">
      <Navigation />

      <main className="flex-1 md:ml-[180px] pt-14 md:pt-0">
        <div className="max-w-5xl mx-auto px-6 md:px-12 lg:px-20 py-16 md:py-20">

          {/* 페이지 헤더 */}
          <div className="flex items-end justify-between mb-12">
            <h1 className="text-2xl font-light tracking-[-0.01em] text-black">
              Products
            </h1>

            <div className="flex items-center gap-6">
              <button
                onClick={() => setTab('browse')}
                className={`text-xs tracking-[0.1em] uppercase transition-colors ${
                  tab === 'browse' ? 'text-black font-semibold' : 'text-gray-400 hover:text-black'
                }`}
              >
                Browse
              </button>
              <button
                onClick={() => setTab('new')}
                className={`text-xs tracking-[0.1em] uppercase transition-colors ${
                  tab === 'new' ? 'text-black font-semibold' : 'text-gray-400 hover:text-black'
                }`}
              >
                + New
              </button>
            </div>
          </div>

          {/* ── Browse 탭 ───────────────────────────────── */}
          {tab === 'browse' && (
            <div>
              {/* 검색 */}
              <div className="mb-10">
                <input
                  type="text"
                  placeholder="상품명 또는 설명으로 검색"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full md:w-[360px] h-11 border-b border-gray-200 focus:border-black outline-none text-sm text-black placeholder-gray-300 bg-transparent transition-colors pb-2"
                />
              </div>

              {/* 로딩 스켈레톤 */}
              {isLoading && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-gray-100">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="bg-white p-8 animate-pulse">
                      <div className="h-4 bg-gray-100 rounded mb-3 w-3/4" />
                      <div className="h-5 bg-gray-100 rounded mb-4 w-1/3" />
                      <div className="h-3 bg-gray-100 rounded w-full mb-2" />
                      <div className="h-3 bg-gray-100 rounded w-2/3" />
                    </div>
                  ))}
                </div>
              )}

              {/* 에러 */}
              {isError && (
                <div className="py-20 text-center">
                  <p className="text-sm text-gray-400">서버에 연결할 수 없습니다.</p>
                  <p className="text-xs text-gray-300 mt-1">localhost:1111을 확인해주세요.</p>
                </div>
              )}

              {/* 결과 없음 */}
              {!isLoading && !isError && filtered?.length === 0 && (
                <div className="py-20 text-center">
                  <p className="text-sm text-gray-400">
                    {search ? `"${search}"에 해당하는 상품이 없습니다.` : '등록된 상품이 없습니다.'}
                  </p>
                </div>
              )}

              {/* 상품 그리드 */}
              {!isLoading && !isError && filtered && filtered.length > 0 && (
                <>
                  <p className="text-xs text-gray-300 mb-6 tracking-wide">
                    {filtered.length}개
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-gray-100">
                    {filtered.map((product) => (
                      <div
                        key={product.id}
                        className="relative bg-white p-8 hover:bg-gray-50 transition-colors group"
                      >
                        <p className="text-sm font-medium text-black mb-3 leading-snug">
                          {product.title}
                        </p>
                        <p className="text-base font-light text-black mb-4 tracking-[-0.01em]">
                          {formatPrice(product.price)}원
                        </p>
                        <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">
                          {product.description}
                        </p>

                        {/* 호버 시 Edit 버튼 */}
                        <Link
                          to={`/products/${product.id}/edit`}
                          className="absolute bottom-8 right-8 text-[10px] tracking-[0.12em] uppercase text-black border-b border-black pb-px opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                        >
                          Edit →
                        </Link>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── New 탭 ──────────────────────────────────── */}
          {tab === 'new' && (
            <div className="max-w-md">
              <form onSubmit={handleRegister} className="flex flex-col gap-10">

                <div>
                  <label className="block text-[10px] tracking-[0.15em] uppercase text-gray-400 mb-3">
                    Product Name
                  </label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="상품명을 입력하세요"
                    className="w-full h-11 border-b border-gray-200 focus:border-black outline-none text-sm text-black placeholder-gray-300 bg-transparent transition-colors"
                    required
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
                    placeholder="0"
                    min="0"
                    className="w-full h-11 border-b border-gray-200 focus:border-black outline-none text-sm text-black placeholder-gray-300 bg-transparent transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] tracking-[0.15em] uppercase text-gray-400 mb-3">
                    Description
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="상품 설명을 입력하세요"
                    rows={4}
                    className="w-full border-b border-gray-200 focus:border-black outline-none text-sm text-black placeholder-gray-300 bg-transparent transition-colors resize-none leading-relaxed pt-1"
                    required
                  />
                </div>

                {formError && (
                  <p className="text-xs text-red-500 -mt-4">{formError}</p>
                )}

                <div className="flex items-center gap-8 pt-2">
                  <button
                    type="submit"
                    disabled={registerMutation.isPending}
                    className="text-xs tracking-[0.12em] uppercase text-white bg-black px-8 py-3 hover:bg-gray-800 transition-colors disabled:bg-gray-300"
                  >
                    {registerMutation.isPending ? 'Registering...' : 'Register'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTab('browse');
                      setForm({ title: '', price: '', description: '' });
                      setFormError('');
                    }}
                    className="text-xs tracking-[0.12em] uppercase text-gray-400 hover:text-black transition-colors"
                  >
                    Cancel
                  </button>
                </div>

              </form>
            </div>
          )}

        </div>
      </main>
    </div>
  );
};

export default Products;
