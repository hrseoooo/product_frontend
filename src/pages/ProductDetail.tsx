import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Navigation from "../components/Navigation";
import ProductImageSlider from "../components/ProductImageSlider";
import BarcodeInput from "../components/BarcodeInput";
import { loadMockBarcode } from "../utils/barcodeValidation";
import "./ProductDetail.css";

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: product, isLoading, isError } = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      const res = await fetch(`http://localhost:1111/products/${id}`);
      if (!res.ok) throw new Error("상품을 불러올 수 없습니다.");
      return res.json();
    },
    enabled: !!id,
  });

  if (isLoading) return <div className="detail-loading">Loading...</div>;
  if (isError || !product) return <div className="detail-error">상품을 찾을 수 없습니다.</div>;

  // [시나리오 B] 상세조회 화면이 열리면 기존에 등록된 바코드(Mock 저장소)를
  // 불러와 BarcodeInput에 넘겨줍니다. autoValidateOnMount=true 이므로
  // 화면이 로드되자마자 1차→2차 검증이 자동으로 실행되고, 통과하면 체크
  // 표시가 자동으로 나타납니다.
  const savedBarcode = loadMockBarcode(product.id);

  return (
    <div className="app-container" style={{ background: "#f8fafc" }}>
      <Navigation />

      <div className="detail-container">
        <div className="detail-header">
          <div className="detail-image-section">
            <ProductImageSlider images={product.images} />
          </div>

          <div className="detail-info-section">
            <h1 className="detail-title">{product.title}</h1>
            <p className="detail-price">{product.price.toLocaleString()} KRW</p>

            <div className="detail-meta">
              <div className="meta-item">
                <span className="meta-label">바코드(GTIN)</span>
                <span className="meta-value" style={{ maxWidth: "220px" }}>
                  {savedBarcode ? (
                    <BarcodeInput
                      value={savedBarcode}
                      onChange={() => {}}
                      autoValidateOnMount
                      disabled
                    />
                  ) : (
                    "등록된 바코드가 없습니다"
                  )}
                </span>
              </div>
              <div className="meta-item">
                <span className="meta-label">브랜드</span>
                <span className="meta-value">{product.brand || "-"}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">상태</span>
                <span className="meta-value">{product.condition === "NEW" ? "새상품" : "중고상품"}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">원산지</span>
                <span className="meta-value">{product.origin || "-"}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">재고</span>
                <span className="meta-value">{product.stock} 개</span>
              </div>
            </div>

            {product.mallAccounts && product.mallAccounts.length > 0 && (
              <div className="detail-malls">
                <h3>판매 채널</h3>
                <div className="mall-badges">
                  {product.mallAccounts.map((mallId: string) => (
                    <span key={mallId} className="mall-badge">쇼핑몰 ID: {mallId}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="detail-body">
          <div className="detail-description">
            <h2>상세 설명</h2>
            <div className="froala-content" dangerouslySetInnerHTML={{ __html: product.description }} />
          </div>

          {product.noticeData && Object.keys(product.noticeData).length > 0 && (
            <div className="detail-notice">
              <h2>품목고시정보 ({product.noticeCategory || "기타"})</h2>
              <table className="notice-table">
                <tbody>
                  {Object.entries(product.noticeData).map(([key, value]) => (
                    <tr key={key}>
                      <th>{key}</th>
                      <td>{value as string}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
