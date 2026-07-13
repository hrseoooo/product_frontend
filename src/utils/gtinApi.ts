/* ------------------------------------------------------------------ */
/* GTIN(바코드) 식별정보 조회 API - Mock 구현                           */
/*                                                                      */
/* 실제 스펙 (3.2.1 GTIN을 이용한 식별정보 호출 URL):                   */
/*   GET https://api.koreannet.or.kr/mobileweb/verify/gtin/{gtin}       */
/*   - apiKey: 헤더에 포함 (필수)                                       */
/*   - gtin: 최대 14자, 14자 미만이면 앞에 0을 채워 14자리로 패딩 (필수)  */
/*                                                                      */
/* 백엔드에 이 API를 직접 호출할 프록시가 아직 없어서, 옵션 행의         */
/* "유효성 검사" 버튼은 이 Mock 함수를 호출합니다. 실제 연동 시에는      */
/* verifyGtinMock의 내부 구현만 실제 fetch(koreannet API)로 교체하면    */
/* 됩니다 (함수 시그니처/반환 타입은 스펙 그대로 유지).                  */
/* ------------------------------------------------------------------ */

export interface GtinResultData {
  productImageUrl: string;
  licenceStatus: string;
  gtin: string;
  brandName: string;
  gpcCategoryCode: string;
  netContent: string;
  productDescription: string;
  licenseeName: string;
  countryOfSaleCode: string;
  dateUpdated: string;
}

export interface GtinVerifySuccess {
  resultData: GtinResultData;
  resultCode: "200";
  message: string;
}

export interface GtinVerifyNotFound {
  resultCode: "105";
  message: string;
}

export type GtinVerifyResponse = GtinVerifySuccess | GtinVerifyNotFound;

// [Mock DB] 실제로 존재하는 것으로 취급할 GTIN 목록 (스펙 예시 데이터 포함)
const MOCK_GTIN_DB: Record<string, GtinResultData> = {
  "8803217000601": {
    productImageUrl:
      "https://gs1.koreannet.or.kr/product/info/detail/photoView.do?fileNm=8803217000014_8803217000601_1.jpg&filePath=8803217000014/8803217000601",
    licenceStatus: "ACTIVE",
    gtin: "08803217000601",
    brandName: "꽃샘",
    gpcCategoryCode: "10000119 과실차 - 티백/잎차",
    netContent: "120 GRM",
    productDescription: "(주)꽃샘식품 꽃샘 THE 생강차 플러스 120g (15g x 8개입)",
    licenseeName: "KKOCH SHAEM FOOD CO., LTD.",
    countryOfSaleCode: "대한민국",
    dateUpdated: "2022-12-02",
  },
  "8801234567890": {
    productImageUrl: "",
    licenceStatus: "ACTIVE",
    gtin: "08801234567890",
    brandName: "테스트브랜드",
    gpcCategoryCode: "10000200 의류 - 상의",
    netContent: "1 EA",
    productDescription: "테스트용 정상 등록 상품 (Mock)",
    licenseeName: "TEST CO., LTD.",
    countryOfSaleCode: "대한민국",
    dateUpdated: "2025-01-01",
  },
};

/** 14자리 미만이면 앞에 0을 채워 14자리로 패딩 (스펙 명세 그대로) */
export function padGtinTo14(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.padStart(14, "0").slice(-14);
}

/** GTIN 식별정보 조회 (Mock, API 호출 시뮬레이션 - 지연 포함) */
export function verifyGtinMock(rawGtin: string): Promise<GtinVerifyResponse> {
  const padded = padGtinTo14(rawGtin);

  return new Promise((resolve) => {
    setTimeout(() => {
      const found = MOCK_GTIN_DB[padded];
      if (found) {
        resolve({
          resultData: found,
          resultCode: "200",
          message: "정상 처리되었습니다.",
        });
      } else {
        resolve({
          resultCode: "105",
          message: "해당하는 데이터가 없습니다.",
        });
      }
    }, 500);
  });
}
