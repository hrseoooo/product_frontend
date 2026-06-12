import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "./store/useAuthStore";
import Navigation from "./components/Navigation";
import ProductTable, { type Product } from "./components/ProductTable";
import { Search } from "lucide-react";
import { useSearchParams, useNavigate } from "react-router-dom";
import api from "./api/axios";

function App() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const [searchParams, setSearchParams] = useSearchParams();
  const searchTerm = searchParams.get("search") || "";
  const [searchInput, setSearchInput] = useState(searchTerm);
  const navigate = useNavigate();

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
    data: products,
    isLoading,
    isError,
  } = useQuery<Product[]>({
    queryKey: ["products", searchTerm],
    queryFn: async () => {
      const url = searchTerm ? `http://localhost:1111/products?search=${encodeURIComponent(searchTerm)}` : "http://localhost:1111/products";
      const res = await fetch(url);
      if (!res.ok) throw new Error("네트워크 응답이 좋지 않습니다.");
      return res.json();
    },
    // 로그인 했을 때만 페치할 수도 있지만, 공개 API라면 상관없음
    enabled: !!accessToken,
  });

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
