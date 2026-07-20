import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "./store/useAuthStore";
import Navigation from "./components/Navigation";
import ProductTable, { type Product } from "./components/ProductTable";
export type { Product } from "./components/ProductTable";
import { Search } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import api from "./api/axios";

function App() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const [searchParams, setSearchParams] = useSearchParams();
  const searchTerm = searchParams.get("search") || "";
  const [searchInput, setSearchInput] = useState(searchTerm);

  // Sync input when URL changes (e.g. clicking Products nav link)
  useEffect(() => {
    setSearchInput(searchTerm);
  }, [searchTerm]);

  const handleSearch = (term: string) => {
    if (term) {
      setSearchParams({ search: term });
    } else {
      setSearchParams({});
    }
  };

  const {
    data: productsResponse,
    isLoading,
    isError,
  } = useQuery<{ items: Product[]; total: number; page: number; limit: number }>({
    queryKey: ["products", searchTerm],
    // api 인스턴스의 요청 인터셉터가 Zustand accessToken을 Bearer 헤더로
    // 자동 첨부합니다. 직접 fetch()를 쓰면 로그인 상태여도 헤더가 빠져
    // ProductsController(AuthGuard)에서 401이 발생합니다.
    queryFn: async () => {
      const { data } = await api.get<{ items: Product[]; total: number; page: number; limit: number }>(
        "/products",
        { params: searchTerm ? { search: searchTerm } : undefined },
      );
      return data;
    },
    // 로그인했을 때만 요청합니다.
    enabled: !!accessToken,
  });
  const products = productsResponse?.items;

  const { data: mallAccounts } = useQuery({
    queryKey: ["mallAccounts"],
    queryFn: async () => {
      const res = await api.get("/mall-account");
      return res.data;
    },
    enabled: !!accessToken,
  });

  return (
    <div className="app-container">
      <Navigation />

      {!accessToken ? (
        <div className="splash-container">
          <div className="splash-text-wrapper">
            <h1 className="splash-headline">SELL YOUR ITEMS.</h1>
            <p className="splash-subline">Find new owners for your beloved pieces.<br/>Experience the most minimal marketplace, <strong>rin</strong>.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="home-header">
            <h1 className="products-header">New in</h1>
            <div className="search-bar-container">
              <input 
                type="text" 
                className="search-input" 
                placeholder="어떤 상품을 찾으시나요?" 
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchInput)}
              />
              <button className="search-btn" onClick={() => handleSearch(searchInput)}>
                <Search size={20} color="#94a3b8" />
              </button>
            </div>
          </div>

          {isLoading && <p style={{ textAlign: "center", marginTop: "40px" }}>Loading...</p>}
          {isError && <p style={{ textAlign: "center", marginTop: "40px" }}>Failed to load products.</p>}

          {!isLoading && !isError && (
            <ProductTable products={products || []} mallAccounts={mallAccounts || []} />
          )}
        </>
      )}
    </div>
  );
}

export default App;
