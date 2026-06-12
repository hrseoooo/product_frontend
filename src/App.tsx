import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "./store/useAuthStore";
import Navigation from "./components/Navigation";

export interface Product {
  id: number;
  title: string;
  price: number;
  description: string;
}

function App() {
  const accessToken = useAuthStore((state) => state.accessToken);

  const {
    data: products,
    isLoading,
    isError,
  } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: async () => {
      const res = await fetch("http://localhost:1111/products");
      if (!res.ok) throw new Error("네트워크 응답이 좋지 않습니다.");
      return res.json();
    },
    // 로그인 했을 때만 페치할 수도 있지만, 공개 API라면 상관없음
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
          <div style={{ textAlign: "center" }}>
            <h1 className="products-header">New in</h1>
          </div>

          {isLoading && <p style={{ textAlign: "center", marginTop: "40px" }}>Loading...</p>}
          {isError && <p style={{ textAlign: "center", marginTop: "40px" }}>Failed to load products.</p>}

          {!isLoading && !isError && (
            <div className="products-grid">
              {products?.map((product) => (
                <div key={product.id} className="product-card">
                  <div className="product-image-placeholder">
                    No Image
                  </div>
                  <div className="product-info">
                    <h3 className="product-title">{product.title}</h3>
                    <p className="product-price">
                      {product.price.toLocaleString()} KRW
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;
