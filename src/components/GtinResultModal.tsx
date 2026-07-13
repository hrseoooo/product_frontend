import { CheckCircle2, ImageOff, X, ZoomIn } from "lucide-react";
import { useState } from "react";
import type { GtinResultData } from "../utils/gtinApi";
import "./GtinResultModal.css";

/* ------------------------------------------------------------------ */
/* GTIN 조회 성공 결과 모달                                             */
/*                                                                      */
/* 코리안넷(GS1) 상품정보 조회 화면의 "이미지 + 정보 테이블" 구성을      */
/* 참고해, SweetAlert의 텍스트 나열 대신 카드형 레이아웃으로 정리했습니다.*/
/* ------------------------------------------------------------------ */

interface GtinResultModalProps {
  data: GtinResultData;
  onClose: () => void;
}

export default function GtinResultModal({ data, onClose }: GtinResultModalProps) {
  const [imageZoomed, setImageZoomed] = useState(false);
  const [imageError, setImageError] = useState(false);
  const hasImage = !!data.productImageUrl && !imageError;
  const isActive = data.licenceStatus === "ACTIVE";

  return (
    <div className="gtin-modal-overlay" onClick={onClose}>
      <div className="gtin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gtin-modal-header">
          <div className="gtin-modal-header-title">
            <CheckCircle2 size={18} className="gtin-modal-success-icon" />
            바코드 조회 결과
          </div>
          <button
            type="button"
            className="gtin-modal-close-btn"
            onClick={onClose}
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </div>

        <div className="gtin-modal-body">
          {/* 좌측: 상품 이미지 */}
          <div className="gtin-modal-image-col">
            <div
              className="gtin-modal-image-box"
              onClick={() => hasImage && setImageZoomed(true)}
            >
              {hasImage ? (
                <img
                  src={data.productImageUrl}
                  alt={data.productDescription}
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="gtin-modal-image-placeholder">
                  <ImageOff size={28} />
                  <span>등록된 이미지 없음</span>
                </div>
              )}
              {hasImage && (
                <span className="gtin-modal-zoom-badge">
                  <ZoomIn size={12} /> 확대
                </span>
              )}
            </div>
            <span
              className={`gtin-modal-status-badge ${isActive ? "active" : "inactive"}`}
            >
              {isActive ? "정상 유통" : data.licenceStatus}
            </span>
          </div>

          {/* 우측: 상품 정보 테이블 */}
          <div className="gtin-modal-info-col">
            <h3 className="gtin-modal-product-name">{data.productDescription}</h3>

            <dl className="gtin-modal-info-list">
              <div className="gtin-modal-info-row">
                <dt>바코드(GTIN)</dt>
                <dd className="gtin-modal-mono">{data.gtin}</dd>
              </div>
              <div className="gtin-modal-info-row">
                <dt>상품분류</dt>
                <dd>{data.gpcCategoryCode || "-"}</dd>
              </div>
              <div className="gtin-modal-info-row">
                <dt>브랜드</dt>
                <dd>{data.brandName || "-"}</dd>
              </div>
              <div className="gtin-modal-info-row">
                <dt>제조/유통사</dt>
                <dd>{data.licenseeName || "-"}</dd>
              </div>
              <div className="gtin-modal-info-row">
                <dt>판매국가</dt>
                <dd>{data.countryOfSaleCode || "-"}</dd>
              </div>
              <div className="gtin-modal-info-row">
                <dt>규격/중량</dt>
                <dd>{data.netContent || "-"}</dd>
              </div>
              <div className="gtin-modal-info-row">
                <dt>최종수정일</dt>
                <dd>{data.dateUpdated || "-"}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="gtin-modal-footer">
          <button type="button" className="gtin-modal-confirm-btn" onClick={onClose}>
            확인
          </button>
        </div>
      </div>

      {/* 이미지 확대 뷰 */}
      {imageZoomed && hasImage && (
        <div
          className="gtin-modal-zoom-overlay"
          onClick={(e) => {
            e.stopPropagation();
            setImageZoomed(false);
          }}
        >
          <img src={data.productImageUrl} alt={data.productDescription} />
        </div>
      )}
    </div>
  );
}
