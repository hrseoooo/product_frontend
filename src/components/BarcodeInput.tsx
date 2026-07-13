import { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import Swal from "sweetalert2";
import {
  isValidGtinFormat,
  checkBarcodeExistsMock,
} from "../utils/barcodeValidation";
import "./BarcodeInput.css";

export type BarcodeStatus = "idle" | "checking" | "valid" | "invalid";

interface BarcodeInputProps {
  value: string;
  onChange: (value: string) => void;
  /** 검증 결과가 바뀔 때마다 호출됩니다. 부모(Register 등)가 통과 여부를 알아야
   *  다음 단계로 넘어가는 것을 막을 수 있습니다. */
  onValidationChange?: (isValid: boolean) => void;
  /** 시나리오 B(상세조회)처럼 마운트 시 자동으로 검증을 돌려야 하는 경우 true */
  autoValidateOnMount?: boolean;
  disabled?: boolean;
}

/* ------------------------------------------------------------------ */
/* 바코드(GTIN) 입력 컴포넌트                                           */
/*                                                                      */
/* 흐름:                                                                */
/*  1) onBlur 시 1차 검증(13자리 숫자 포맷) 수행                         */
/*  2) 1차 통과 시 2차 검증(Mock "등록된 바코드" 존재 여부) 수행           */
/*  3) 둘 다 통과하면 입력창에 체크 표시를 보여줍니다                     */
/*                                                                      */
/* autoValidateOnMount=true 이면 마운트 시점에 곧바로 1차→2차 검증을      */
/* 실행합니다 (상세조회 팝업이 열렸을 때 기존 값으로 자동 검증하는 시나리오).*/
/* ------------------------------------------------------------------ */
export default function BarcodeInput({
  value,
  onChange,
  onValidationChange,
  autoValidateOnMount = false,
  disabled = false,
}: BarcodeInputProps) {
  const [status, setStatus] = useState<BarcodeStatus>("idle");

  const runValidation = async (raw: string) => {
    const trimmed = raw.trim();

    if (!trimmed) {
      setStatus("idle");
      onValidationChange?.(false);
      return;
    }

    // 1차 검증: 포맷 (13자리 숫자)
    if (!isValidGtinFormat(trimmed)) {
      setStatus("invalid");
      onValidationChange?.(false);
      Swal.fire({
        icon: "warning",
        title: "바코드 형식 오류",
        text: "유효한 바코드(13자리 숫자, GTIN 형식)를 입력해주세요.",
        confirmButtonColor: "#3b82f6",
      });
      return;
    }

    // 2차 검증: Mock DB 존재 여부 (실제 API 호출 시뮬레이션)
    setStatus("checking");
    const exists = await checkBarcodeExistsMock(trimmed);

    if (!exists) {
      setStatus("invalid");
      onValidationChange?.(false);
      Swal.fire({
        icon: "error",
        title: "바코드 확인 실패",
        text: "존재하지 않거나 유효하지 않은 바코드입니다.",
        confirmButtonColor: "#3b82f6",
      });
      return;
    }

    setStatus("valid");
    onValidationChange?.(true);
  };

  // 시나리오 B: 상세조회 화면이 열리면서 기존 바코드 값을 자동 검증
  useEffect(() => {
    if (autoValidateOnMount && value.trim()) {
      runValidation(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBlur = () => {
    runValidation(value);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    // 값이 바뀌면 이전 검증 결과(체크 표시 등)는 무효화합니다.
    if (status !== "idle") {
      setStatus("idle");
      onValidationChange?.(false);
    }
  };

  return (
    <div className="barcode-input-wrap">
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        placeholder="13자리 바코드(GTIN)를 입력하세요"
        className={`barcode-input ${status === "invalid" ? "invalid" : ""} ${status === "valid" ? "valid" : ""}`}
        maxLength={13}
      />
      <span className="barcode-input-icon">
        {status === "checking" && (
          <Loader2 size={18} className="barcode-spin" />
        )}
        {status === "valid" && (
          <CheckCircle2 size={18} className="barcode-check" />
        )}
      </span>
    </div>
  );
}
