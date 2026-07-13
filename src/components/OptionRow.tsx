import { useState } from "react";
import { Trash2, ShieldCheck, Loader2 } from "lucide-react";
import Swal from "sweetalert2";
import { verifyGtinMock, type GtinResultData } from "../utils/gtinApi";
import GtinResultModal from "./GtinResultModal";
import "./OptionRow.css";

/* ------------------------------------------------------------------ */
/* 옵션(색상/사이즈) 1행                                                */
/*                                                                      */
/* 바코드는 "메인 상품" 기준이 아니라 이 옵션 row 기준입니다.            */
/* - 13자리 숫자 포맷 검증은 입력할 때마다(onChange) 실시간으로 표시됩니다.*/
/* - "유효성 검사" 버튼은 GTIN 식별정보 조회 API(Mock)를 호출해서        */
/*   결과 코드(200/105)에 따라 다른 알림을 띄웁니다.                     */
/* ------------------------------------------------------------------ */

export interface ProductOption {
  id: string;
  color: string;
  size: string;
  stock: string;
  barcode: string;
  // GTIN API 조회까지 통과했는지 여부 (등록 최종 제출 시 검증에 사용)
  gtinVerified: boolean;
}

export function createEmptyOption(): ProductOption {
  return {
    id: crypto.randomUUID?.() ?? `opt_${Date.now()}_${Math.random()}`,
    color: "",
    size: "",
    stock: "0",
    barcode: "",
    gtinVerified: false,
  };
}

/** 13자리 숫자 포맷 검증 (기본 validation) */
function isValidBarcodeFormat(raw: string): boolean {
  return /^\d{13}$/.test(raw.trim());
}

interface OptionRowProps {
  index: number;
  option: ProductOption;
  onChange: (patch: Partial<ProductOption>) => void;
  onRemove: () => void;
  removable: boolean;
}

export default function OptionRow({
  index,
  option,
  onChange,
  onRemove,
  removable,
}: OptionRowProps) {
  const [checking, setChecking] = useState(false);
  const [gtinResult, setGtinResult] = useState<GtinResultData | null>(null);

  const trimmed = option.barcode.trim();
  const formatValid = trimmed.length === 0 ? null : isValidBarcodeFormat(trimmed);

  const handleBarcodeChange = (value: string) => {
    // 바코드 값이 바뀌면 이전 GTIN 검증 결과는 무효화합니다.
    onChange({ barcode: value, gtinVerified: false });
  };

  // 옆의 "유효성 검사" 버튼: GTIN 식별정보 조회 API(Mock) 호출을 가정합니다.
  const handleVerifyClick = async () => {
    if (!isValidBarcodeFormat(trimmed)) {
      Swal.fire({
        icon: "warning",
        title: "바코드 형식 오류",
        text: "먼저 13자리 숫자 바코드를 입력해주세요.",
        confirmButtonColor: "#3b82f6",
      });
      return;
    }

    setChecking(true);
    try {
      const result = await verifyGtinMock(trimmed);

      if (result.resultCode === "200") {
        onChange({ gtinVerified: true });
        // SweetAlert 텍스트 나열 대신, 코리안넷 상품정보 화면 스타일의
        // 이미지+정보 테이블 모달로 결과를 보여줍니다.
        setGtinResult(result.resultData);
      } else {
        onChange({ gtinVerified: false });
        Swal.fire({
          icon: "error",
          title: "조회 결과 없음",
          text: result.message || "해당하는 데이터가 없습니다.",
          confirmButtonColor: "#3b82f6",
        });
      }
    } catch (err) {
      onChange({ gtinVerified: false });
      Swal.fire({
        icon: "error",
        title: "조회 실패",
        text: "GTIN 조회 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
        confirmButtonColor: "#3b82f6",
      });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="option-row">
      <div className="option-row-index">{index + 1}</div>

      <div className="option-field">
        <label>색상</label>
        <input
          type="text"
          value={option.color}
          onChange={(e) => onChange({ color: e.target.value })}
          placeholder="예: 블랙"
        />
      </div>

      <div className="option-field">
        <label>사이즈</label>
        <input
          type="text"
          value={option.size}
          onChange={(e) => onChange({ size: e.target.value })}
          placeholder="예: L"
        />
      </div>

      <div className="option-field">
        <label>재고</label>
        <input
          type="number"
          min={0}
          value={option.stock}
          onChange={(e) => onChange({ stock: e.target.value })}
        />
      </div>

      <div className="option-field option-field-barcode">
        <label>
          바코드(GTIN) <span className="req">*</span>
        </label>
        <div className="option-barcode-inline">
          <input
            type="text"
            inputMode="numeric"
            maxLength={13}
            value={option.barcode}
            onChange={(e) => handleBarcodeChange(e.target.value)}
            placeholder="13자리 숫자"
            className={
              formatValid === false
                ? "invalid"
                : option.gtinVerified
                  ? "valid"
                  : ""
            }
          />
          <button
            type="button"
            className="option-verify-btn"
            onClick={handleVerifyClick}
            disabled={checking}
            title="GTIN 식별정보 조회 (API 통신 가정)"
          >
            {checking ? (
              <Loader2 size={14} className="option-verify-spin" />
            ) : (
              <ShieldCheck size={14} />
            )}
            유효성 검사
          </button>
        </div>
        {/* 기본 자릿수(포맷) validation 메시지 - 입력할 때마다 즉시 표시 */}
        {formatValid === false && (
          <p className="option-barcode-msg error">
            바코드는 숫자 13자리여야 합니다. (현재 {trimmed.length}자리)
          </p>
        )}
        {formatValid === true && !option.gtinVerified && (
          <p className="option-barcode-msg muted">
            형식은 올바릅니다. "유효성 검사"로 실제 등록된 바코드인지
            확인하세요.
          </p>
        )}
        {option.gtinVerified && (
          <p className="option-barcode-msg success">
            GTIN 조회를 통과한 유효한 바코드입니다.
          </p>
        )}
      </div>

      <button
        type="button"
        className="option-remove-btn"
        onClick={onRemove}
        disabled={!removable}
        title="옵션 삭제"
      >
        <Trash2 size={16} />
      </button>

      {gtinResult && (
        <GtinResultModal data={gtinResult} onClose={() => setGtinResult(null)} />
      )}
    </div>
  );
}
