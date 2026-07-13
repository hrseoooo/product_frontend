/* ------------------------------------------------------------------ */
/* 바코드(GTIN) 검증 - Mock 구현                                       */
/*                                                                      */
/* 백엔드에 바코드 등록/조회 API가 아직 없으므로, 프론트엔드 단에서     */
/* 아래 두 단계를 시뮬레이션합니다.                                     */
/*   1차: 포맷 검증 (정확히 13자리 숫자)                                 */
/*   2차: Mock "등록된 바코드 DB"에 실제로 존재하는지 확인               */
/*        (실제 API 호출을 흉내내기 위해 약간의 지연을 둡니다)           */
/*                                                                      */
/* 실제 백엔드 API가 준비되면 checkBarcodeExistsMock의 구현만           */
/* fetch/axios 호출로 교체하면 됩니다. (인터페이스는 그대로 유지)        */
/* ------------------------------------------------------------------ */

// [QA용] 아래 목록에 있는 바코드만 2차 검증을 통과합니다.
export const MOCK_EXISTING_BARCODES: string[] = [
  "8801234567890",
  "8809876543210",
  "4801011010101",
  "8800000000015",
  "1234567890128",
  "9788983920775",
  "8803217000601",
  
];

/** 1차 검증: 정확히 13자리 숫자인지 확인 */
export function isValidGtinFormat(raw: string): boolean {
  return /^\d{13}$/.test(raw.trim());
}

/** 2차 검증: Mock DB(등록된 바코드 목록)에 존재하는지 확인 (API 호출 시뮬레이션) */
export function checkBarcodeExistsMock(raw: string): Promise<boolean> {
  const trimmed = raw.trim();
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(MOCK_EXISTING_BARCODES.includes(trimmed));
    }, 400); // 네트워크 왕복을 흉내내기 위한 인위적 지연
  });
}

/** 상품(productId)별로 입력된 바코드를 프론트엔드에만 임시 저장합니다.
 *  (백엔드 products 테이블에 barcode 컬럼/API가 아직 없어서 사용하는 임시 방편입니다.
 *   실제 API가 추가되면 이 저장 로직은 제거하고 서버 응답값을 그대로 쓰면 됩니다.) */
const STORAGE_PREFIX = "mock_product_barcode_";

export function saveMockBarcode(productId: string | number, barcode: string) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${productId}`, barcode.trim());
  } catch {
    // localStorage 접근 실패는 조용히 무시 (사파리 프라이빗 모드 등)
  }
}

export function loadMockBarcode(productId: string | number): string {
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}${productId}`) ?? "";
  } catch {
    return "";
  }
}
