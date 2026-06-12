import React, { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import "./ProductTable.css";

export interface Product {
  id: number;
  title: string;
  price: number;
  description: string;
  stock: number;
  brand: string;
  origin: string;
  condition: string;
  noticeCategory: string;
  noticeData: Record<string, string>;
  mallAccounts: number[];
  images?: string[];
  createdAt: string;
}

interface MallAccount {
  id: number;
  mallType: string;
  accountName: string;
}

interface ProductTableProps {
  products: Product[];
  mallAccounts: MallAccount[];
}

export default function ProductTable({ products, mallAccounts }: ProductTableProps) {
  const navigate = useNavigate();
  // 마스터 행의 열림/닫힘 상태 관리
  const [expandedRows, setExpandedRows] = useState<number[]>([]);

  const toggleRow = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedRows((prev) =>
      prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id]
    );
  };

  const getMallInfo = (mallId: number | string) => {
    return mallAccounts.find((m) => m.id.toString() === mallId.toString());
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };

  if (!products || products.length === 0) {
    return <div className="empty-table">등록된 상품이 없습니다.</div>;
  }

  return (
    <div className="product-table-container">
      <table className="product-table">
        <thead>
          <tr>
            <th style={{ width: '40px' }}></th>
            <th style={{ width: '150px' }}>판매자관리코드</th>
            <th>상품명</th>
            <th style={{ width: '120px' }}>연동 채널</th>
            <th style={{ width: '120px' }}>판매가</th>
            <th style={{ width: '100px' }}>상품 상태</th>
            <th style={{ width: '150px' }}>표준 카테고리</th>
            <th style={{ width: '80px' }}>판매수량</th>
            <th style={{ width: '80px' }}>배송비</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => {
            const isExpanded = expandedRows.includes(product.id);
            const linkedMalls = product.mallAccounts || [];

            return (
              <React.Fragment key={product.id}>
                {/* 마스터 행 */}
                <tr className="master-row" onClick={() => navigate(`/products/${product.id}`)}>
                  <td className="expand-cell" onClick={(e) => toggleRow(product.id, e)}>
                    {linkedMalls.length > 0 && (
                      <button className="expand-btn">
                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </button>
                    )}
                  </td>
                  <td className="code-cell">
                    <div className="product-code">M00{product.id}</div>
                  </td>
                  <td className="title-cell">
                    <div className="title-wrapper">
                      {product.images && product.images.length > 0 ? (
                        <img src={product.images[0]} alt="thumb" className="table-thumb" />
                      ) : (
                        <div className="table-thumb-placeholder">No Img</div>
                      )}
                      <div className="title-info">
                        <div className="title-text">{product.title}</div>
                        <div className="title-meta">
                          <span className="brand-badge">{product.brand || "브랜드없음"}</span>
                          <span className="date-text">{formatDate(product.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    {linkedMalls.length > 0 ? (
                      <span className="link-count-badge">연동 {linkedMalls.length}</span>
                    ) : (
                      <span className="link-none-badge">연동 안됨</span>
                    )}
                  </td>
                  <td className="price-cell">{product.price.toLocaleString()} 원</td>
                  <td>-</td>
                  <td className="category-cell">{product.noticeCategory || "기타"}</td>
                  <td className="stock-cell">{product.stock}</td>
                  <td>-</td>
                </tr>

                {/* 슬레이브 행 (연동된 쇼핑몰) */}
                {isExpanded &&
                  linkedMalls.map((mallId, idx) => {
                    const mallInfo = getMallInfo(mallId);
                    return (
                      <tr key={`${product.id}-slave-${idx}`} className="slave-row">
                        <td></td>
                        <td className="slave-code-cell">C-M00{product.id}</td>
                        <td className="slave-title-cell">
                          <div className="slave-title-wrapper">
                            <span className="slave-branch-icon">└</span>
                            <span className="slave-title-text">{product.title}</span>
                          </div>
                        </td>
                        <td>
                          {mallInfo ? (
                            <div className="mall-info-cell">
                              <span className="mall-type">{mallInfo.mallType}</span>
                              <span className="mall-name">{mallInfo.accountName}</span>
                            </div>
                          ) : (
                            <span className="mall-unknown">알수없음</span>
                          )}
                        </td>
                        <td className="slave-price-cell">{product.price.toLocaleString()} 원</td>
                        <td>
                          <span className="status-badge selling">판매중</span>
                        </td>
                        <td className="slave-category-cell">{product.noticeCategory || "기타"}</td>
                        <td className="slave-stock-cell">{product.stock}</td>
                        <td className="slave-shipping-cell">무료</td>
                      </tr>
                    );
                  })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
