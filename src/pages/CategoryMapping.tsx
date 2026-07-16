import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  ChevronRight,
  ChevronLeft,
  X,
  Loader2,
  Layers,
  Check,
  Pencil,
  ListTree,
} from "lucide-react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import Swal from "sweetalert2";
import Navigation from "../components/Navigation";
import api from "../api/axios";
import "./CategoryMapping.css";

/* ------------------------------------------------------------------ */
/* Master-Slave 구조:                                                  */
/* 표준 카테고리(playauto_cate, Master) 기준으로 사이트 카테고리         */
/* (playauto_site_cate, Slave) 1개를 매핑한다.                          */
/* [1:1 원칙] 표준 카테고리 1건은 "같은 쇼핑몰 내에서" 사이트 카테고리를   */
/* 최대 1개만 가질 수 있다. 백엔드는 삭제(delete) API를 제공하지 않으므로  */
/* 매핑을 없애려면 다른 ccode로 교체해야 한다.                           */
/*                                                                      */
/* [완전 매핑 원칙] 표준 카테고리 1건은 이 화면에 등록된 모든 쇼핑몰       */
/* (MALLS) 각각에 최소 1개(state='정상' + ccode 존재)의 매핑이 있어야     */
/* "완전히 매핑됨"으로 간주한다. 아래 세 가지 경우 모두 "미매핑"이다:      */
/*   1) 그 쇼핑몰에 대한 매핑 행이 아예 없음 (playauto_cate_map에 없음)   */
/*   2) 매핑 행은 있는데 ccode가 비어있음                                */
/*   3) 매핑 행은 있는데 state='삭제'라 실질적으로 유효하지 않음          */
/* (실제 검증 결과, 기존 getUnmappedStandardCategories/                  */
/*  getMappedStandardCategories가 이미 이 세 경우를 모두 정확히           */
/*  걸러내고 있음을 DB로 확인했다.)                                       */
/*                                                                      */
/* [쇼핑몰 선택] 단일 선택(라디오 방식) + "전체".                         */
/* - 특정 쇼핑몰 선택 시: 그 쇼핑몰(acode) 기준으로 미매핑/매핑완료 두      */
/*   탭으로 나누어 조회한다 (acodes=해당 acode 1개). 한 몰만 보므로       */
/*   매핑/미매핑 구분이 명확하다.                                         */
/* - "전체" 선택 시: 표준 카테고리 1건 안에 몰별로 매핑/미매핑이 섞여      */
/*   있을 수 있어 매핑완료/미매핑 탭 구분이 의미가 없다. 그래서 탭을       */
/*   없애고 "표준 카테고리 매핑 현황" 단일 목록(GET .../mapping-status)   */
/*   으로 전체 표준 카테고리 + 몰별 매핑 상태 칩을 한 번에 보여준다.       */
/*                                                                      */
/* [미매핑 매핑 방식] 특정 쇼핑몰 탭의 미매핑 목록에서는, "사이트           */
/* 카테고리를 먼저 고르고 표준 카테고리를 복수 선택해서 일괄 적용"하는     */
/* 방식을 사용한다 (검색/트리로 사이트 카테고리 1개 선택 -> 미매핑         */
/* 표준 카테고리 여러 개 체크 -> 일괄 적용 버튼으로 한 번에 저장).         */
/* 체크만 해둔 상태에서는 DB에 아무것도 쓰지 않고, 일괄 적용을 눌러야      */
/* 실제 저장(POST /products/category-mapping/bulk)이 호출된다.           */
/* ------------------------------------------------------------------ */

type Mall = {
  id: string; // acode
  name: string;
  short: string;
  color: string;
};

const MALLS: Mall[] = [
  { id: "B378", name: "쿠팡", short: "C", color: "#ff5a4a" },
  { id: "A077", name: "스마트스토어", short: "N", color: "#03c75a" },
  { id: "B616", name: "카페24", short: "24", color: "#1e293b" },
  { id: "A112", name: "11번가", short: "11", color: "#ff0038" },
];

// "전체" 조회 시 사용할 acode 목록. 이 화면에 등록된 모든 쇼핑몰을 뜻한다.
const ALL_MALL_IDS = MALLS.map((m) => m.id);

const GLOBAL_KEY = "GLOBAL";

// [매핑완료 탭을 먼저 보여주기 위해 순서 변경] 매핑완료 -> 미매핑
type Tab = "mapped" | "unmapped";

type Tag = { ccode: string; label: string };

// 백엔드(StandardCategoryRow)가 실제로 내려주는 모양: 몰(acode)별 매핑 1건.
// [1:1 원칙] 같은 pcode는 같은 acode 내에서 매핑을 최대 1개만 가진다.
// "전체" 선택 시에는 화면에 등록되지 않은 몰(옥션/지마켓 등)의 매핑도
// 함께 내려오며, 이때 mallName이 채워진다(하드코딩된 몰이면 이름, 아니면 acode).
type MallCategoryMapping = { acode: string; mallName?: string; ccode: string; label: string };
type StandardCategoryRow = { pcode: string; label: string; mappings: MallCategoryMapping[] };

// 사이트 카테고리 트리 노드 (GET /products/site-category/:acode)
type SiteCategoryTreeNode = {
  id: string;
  label: string;
  children: SiteCategoryTreeNode[];
  ccode?: string;
};

type SiteSearchResult = { ccode: string; label: string };

const PAGE_SIZE = 30;

type ListResponse<T> = {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  limit: number;
};

function listEndpoint(tab: Tab) {
  return tab === "unmapped"
    ? `/products/standard-category/unmapped`
    : `/products/standard-category/mapped`;
}

const MAPPING_STATUS_ENDPOINT = `/products/standard-category/mapping-status`;

async function fetchList(
  tab: Tab,
  acodesKey: string,
  keyword: string,
  page: number,
  signal?: AbortSignal,
): Promise<ListResponse<StandardCategoryRow>> {
  const { data } = await api.get<ListResponse<StandardCategoryRow>>(listEndpoint(tab), {
    params: { acodes: acodesKey, keyword, page, limit: PAGE_SIZE },
    signal,
  });
  return data;
}

// [전체] 선택 시 사용하는 통합 조회 (매핑완료/미매핑 구분 없음)
async function fetchMappingStatus(
  acodesKey: string,
  keyword: string,
  page: number,
  signal?: AbortSignal,
): Promise<ListResponse<StandardCategoryRow>> {
  const { data } = await api.get<ListResponse<StandardCategoryRow>>(MAPPING_STATUS_ENDPOINT, {
    params: { acodes: acodesKey, keyword, page, limit: PAGE_SIZE },
    signal,
  });
  return data;
}

// 매핑을 추가/수정할 때 열리는 모달 상태 (mapped 탭, 그리고 "전체" 탭에서
// 특정 몰 하나를 골라 개별로 추가/수정할 때 사용).
type EditingState = {
  pcode: string;
  pcodeLabel: string;
  acode: string;
  mallName: string;
  mallColor: string;
  current?: Tag;
};

export default function CategoryMapping() {
  // [단일 선택] GLOBAL_KEY = "전체".
  const [selectedMall, setSelectedMall] = useState<string>(MALLS[0].id);
  const isGlobal = selectedMall === GLOBAL_KEY;

  // [매핑완료 탭을 먼저 보여줌]
  const [tab, setTab] = useState<Tab>("mapped");
  const [keyword, setKeyword] = useState("");
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  const [page, setPage] = useState(1);

  const queryClient = useQueryClient();

  const acodesKey = isGlobal ? ALL_MALL_IDS.join(",") : selectedMall;

  // 검색어 디바운스 (300ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKeyword(keyword), 300);
    return () => clearTimeout(timer);
  }, [keyword]);

  // 쇼핑몰/탭/검색어가 바뀌면 1페이지로 리셋
  useEffect(() => {
    setPage(1);
  }, [acodesKey, tab, debouncedKeyword, isGlobal]);

  /* ---------------- 목록 로드 (react-query 캐싱) ----------------
   * "전체" 선택 시에는 매핑완료/미매핑 탭 구분 없이 mapping-status 통합
   * API를 사용하고, 특정 몰 선택 시에는 기존처럼 tab에 따라 unmapped/mapped
   * API를 사용한다.
   */
  const listQuery = useQuery({
    queryKey: isGlobal
      ? ["standard-category-status", acodesKey, debouncedKeyword, page]
      : ["standard-category", tab, acodesKey, debouncedKeyword, page],
    queryFn: ({ signal }) =>
      isGlobal
        ? fetchMappingStatus(acodesKey, debouncedKeyword, page, signal)
        : fetchList(tab, acodesKey, debouncedKeyword, page, signal),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });

  // [로딩 속도 개선] 다음 페이지를 백그라운드에서 미리 캐싱해둡니다.
  // 특정 몰 선택 시엔 반대 탭(1페이지)도 함께 미리 캐싱해서, 탭 전환과
  // 탭별 개수 표시가 즉시 반영되도록 한다.
  useEffect(() => {
    const totalKnown = listQuery.data?.total ?? 0;
    const hasNextPage = totalKnown > page * PAGE_SIZE;
    if (hasNextPage) {
      queryClient.prefetchQuery({
        queryKey: isGlobal
          ? ["standard-category-status", acodesKey, debouncedKeyword, page + 1]
          : ["standard-category", tab, acodesKey, debouncedKeyword, page + 1],
        queryFn: ({ signal }) =>
          isGlobal
            ? fetchMappingStatus(acodesKey, debouncedKeyword, page + 1, signal)
            : fetchList(tab, acodesKey, debouncedKeyword, page + 1, signal),
        staleTime: 30_000,
      });
    }
  }, [acodesKey, tab, debouncedKeyword, page, isGlobal, listQuery.data?.total, queryClient]);

  const loading = listQuery.isLoading;
  const rows = listQuery.data?.data ?? [];
  const total = listQuery.data?.total ?? 0;

  useEffect(() => {
    if (listQuery.error) {
      console.error("표준 카테고리 목록 로드 실패", listQuery.error);
    }
  }, [listQuery.error]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /* ---------------- 탭별 데이터 개수 표시 (특정 몰 선택 시에만) ----------------
   * "전체" 선택 시에는 탭 구분이 없으므로 개수 표시도 필요 없다. 특정
   * 쇼핑몰을 선택했을 때만 매핑완료/미매핑 각각의 전체 개수를 보여준다.
   * 현재 보고 있는 탭은 listQuery의 total을 그대로 쓰고, 반대 탭은
   * 항상 활성 쿼리로 1페이지를 로드해두므로(같은 쿼리 키) 탭을 눌렀을 때
   * 추가 네트워크 요청 없이 즉시 표시된다.
   */
  const otherTab: Tab = tab === "unmapped" ? "mapped" : "unmapped";
  const otherTabQuery = useQuery({
    queryKey: ["standard-category", otherTab, acodesKey, debouncedKeyword, 1],
    queryFn: ({ signal }) => fetchList(otherTab, acodesKey, debouncedKeyword, 1, signal),
    enabled: !isGlobal,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
  const mappedCount = tab === "mapped" ? total : (otherTabQuery.data?.total ?? null);
  const unmappedCount = tab === "unmapped" ? total : (otherTabQuery.data?.total ?? null);
  const formatCount = (n: number | null) => (n === null ? "…" : n.toLocaleString());

  // 매핑을 추가/수정할 때 열리는 모달 상태 (mapped 탭 개별 수정, "전체" 탭 개별 추가/수정)
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [pickerSaving, setPickerSaving] = useState(false);

  /* ---------------- 매핑 설정/교체 (모달을 통한 개별 저장) ----------------
   * [1:1 원칙] 백엔드(POST /products/category-mapping)는 같은 (pcode, acode)에
   * 대해 항상 "덮어쓰기(수정)"로 동작하며, 별도의 삭제 API는 제공하지 않는다.
   */
  const savePickerSelection = async (tag: Tag) => {
    if (!editing) return;
    setPickerSaving(true);
    try {
      await api.post("/products/category-mapping", {
        pcode: editing.pcode,
        acode: editing.acode,
        ccode: tag.ccode,
      });
      await queryClient.invalidateQueries({ queryKey: ["standard-category"] });
      setEditing(null);
    } catch (err) {
      console.error("카테고리 매핑 저장 실패", err);
      Swal.fire({ icon: "error", text: "카테고리 매핑 저장에 실패했습니다." });
    } finally {
      setPickerSaving(false);
    }
  };

  /* ---------------- 사이트 카테고리 우선 매핑 (특정 쇼핑몰 + 미매핑 탭 전용) ----------------
   * 1) 이 쇼핑몰의 사이트 카테고리를 검색/트리로 먼저 1개 선택한다.
   * 2) 그 아래 목록에서 매핑하고 싶은 미매핑 표준 카테고리를 여러 개 체크한다.
   *    체크 시점에는 DB에 아무것도 쓰지 않고, 화면에 "적용 예정" 미리보기만 보여준다.
   * 3) "일괄 적용" 버튼을 눌러야 실제로 저장(POST bulk)된다.
   * "전체" 탭은 표준 카테고리별로 빠져있는 몰이 서로 다를 수 있어(예: 어떤 pcode는
   * 쿠팡만 미매핑, 어떤 pcode는 11번가만 미매핑) 하나의 사이트 카테고리를 일괄
   * 적용할 대상 몰을 특정할 수 없으므로, 이 기능은 특정 몰을 선택했을 때만 제공한다.
   */
  const [siteMode, setSiteMode] = useState<"search" | "tree">("search");
  const [selectedSiteTag, setSelectedSiteTag] = useState<Tag | null>(null);
  const [selectedPcodes, setSelectedPcodes] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    // 쇼핑몰/탭이 바뀌면 선택 상태를 초기화
    setSelectedSiteTag(null);
    setSelectedPcodes(new Set());
    setSiteMode("search");
  }, [selectedMall, tab]);

  const togglePcodeSelect = (pcode: string) => {
    setSelectedPcodes((prev) => {
      const next = new Set(prev);
      if (next.has(pcode)) next.delete(pcode);
      else next.add(pcode);
      return next;
    });
  };

  const applyBulkMapping = async () => {
    if (isGlobal || !selectedSiteTag || selectedPcodes.size === 0) return;
    setApplying(true);
    try {
      await api.post("/products/category-mapping/bulk", {
        acode: selectedMall,
        pcodes: [...selectedPcodes],
        ccode: selectedSiteTag.ccode,
      });
      await queryClient.invalidateQueries({ queryKey: ["standard-category"] });
      setSelectedPcodes(new Set());
      setSelectedSiteTag(null);
    } catch (err) {
      console.error("일괄 매핑 실패", err);
      Swal.fire({ icon: "error", text: "일괄 매핑에 실패했습니다." });
    } finally {
      setApplying(false);
    }
  };

  const activeMall = MALLS.find((m) => m.id === selectedMall);

  return (
    <div className="app-container cm-page">
      <Navigation />

      <header className="cm-header">
        <div className="cm-header-titles">
          <span className="cm-eyebrow">
            <Layers size={14} /> Category Mapping
          </span>
          <h1 className="cm-title">카테고리 매핑</h1>
          <p className="cm-subtitle">
            표준 카테고리를 기준으로, 각 쇼핑몰의 사이트 카테고리를 매핑하세요.
          </p>
        </div>
      </header>

      <section className="cm-mall-section">
        <div className="cm-mall-section-head">
          <span className="cm-mall-section-label">쇼핑몰 선택</span>
        </div>
        <div className="cm-mall-bar">
          <button
            type="button"
            className={`cm-mall-pill cm-mall-pill-all ${isGlobal ? "active" : ""}`}
            onClick={() => setSelectedMall(GLOBAL_KEY)}
          >
            <span className="cm-mall-badge" style={{ background: "#0f172a" }}>
              <Layers size={12} />
            </span>
            전체
          </button>
          {MALLS.map((mall) => (
            <button
              key={mall.id}
              type="button"
              className={`cm-mall-pill ${selectedMall === mall.id ? "active" : ""}`}
              onClick={() => setSelectedMall(mall.id)}
            >
              <span className="cm-mall-badge" style={{ background: mall.color }}>
                {mall.short}
              </span>
              {mall.name}
            </button>
          ))}
        </div>
      </section>

      <section className="cm-cascade-card">
        <div className="cm-tabs-toolbar">
          {isGlobal ? (
            // ["전체" 선택 시] 매핑완료/미매핑 탭 구분 없이 단일 현황 타이틀만 표시
            <div className="cm-status-title">
              <span className="cm-status-title-text">표준 카테고리 매핑 현황</span>
              <span className="cm-tab-count">{formatCount(total)}</span>
            </div>
          ) : (
            <div className="cm-tabs">
              <button
                className={`cm-tab-btn ${tab === "mapped" ? "active" : ""}`}
                onClick={() => setTab("mapped")}
              >
                매핑 완료 표준 카테고리
                <span className="cm-tab-count">{formatCount(mappedCount)}</span>
              </button>
              <button
                className={`cm-tab-btn ${tab === "unmapped" ? "active" : ""}`}
                onClick={() => setTab("unmapped")}
              >
                미매핑 표준 카테고리
                <span className="cm-tab-count">{formatCount(unmappedCount)}</span>
              </button>
            </div>
          )}

          <div className="cm-search">
            <Search size={16} className="cm-search-icon" />
            <input
              type="text"
              placeholder="표준 카테고리 키워드로 검색 (예: 가디건)"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
        </div>

        {/* [사이트 카테고리 우선 매핑] 특정 쇼핑몰 + 미매핑 탭에서만 노출 */}
        {tab === "unmapped" && !isGlobal && activeMall && (
          <div className="cm-site-first-mapper">
            <div className="cm-site-first-header">
              <span className="cm-mall-badge sm" style={{ background: activeMall.color }}>
                {activeMall.short}
              </span>
              <strong>{activeMall.name} 사이트 카테고리 선택</strong>
              <span className="cm-site-first-desc">
                먼저 매핑할 사이트 카테고리를 고른 뒤, 아래 목록에서 표준 카테고리를 복수
                선택하고 일괄 적용하세요.
              </span>
            </div>

            <div className="cm-modal-modeswitch cm-site-first-modeswitch">
              <button
                type="button"
                className={siteMode === "search" ? "active" : ""}
                onClick={() => setSiteMode("search")}
              >
                <Search size={13} /> 검색
              </button>
              <button
                type="button"
                className={siteMode === "tree" ? "active" : ""}
                onClick={() => setSiteMode("tree")}
              >
                <ListTree size={13} /> 트리로 찾기
              </button>
            </div>

            <div className="cm-site-first-picker">
              {siteMode === "search" ? (
                <SiteCategorySearchBox
                  acode={activeMall.id}
                  placeholder="사이트 카테고리 검색 (예: 라운드넥 니트)"
                  className="cm-autocomplete-wide"
                  onSelect={(tag) => setSelectedSiteTag(tag)}
                />
              ) : (
                <SiteCategoryTree
                  acode={activeMall.id}
                  activeCcode={selectedSiteTag?.ccode}
                  activeLabel={selectedSiteTag?.label}
                  onSelect={(tag) => setSelectedSiteTag(tag)}
                />
              )}
            </div>

            <div className="cm-site-first-applybar">
              {selectedSiteTag ? (
                <span className="cm-tag">
                  선택됨: {selectedSiteTag.label}
                  <button onClick={() => setSelectedSiteTag(null)}>
                    <X size={12} />
                  </button>
                </span>
              ) : (
                <span className="cm-muted">사이트 카테고리를 아직 선택하지 않았습니다.</span>
              )}
              <span className="cm-bulk-count">{selectedPcodes.size}개 선택됨</span>
              <button
                className="cm-btn-primary"
                disabled={!selectedSiteTag || selectedPcodes.size === 0 || applying}
                onClick={applyBulkMapping}
              >
                {applying ? "적용 중..." : "일괄 적용"}
              </button>
            </div>
          </div>
        )}

        <div className="cm-list-wrap">
          {loading ? (
            <div className="cm-cascade-placeholder">
              <Loader2 size={16} className="cm-spin" /> 불러오는 중...
            </div>
          ) : rows.length === 0 ? (
            <div className="cm-empty">
              {isGlobal
                ? "조건에 맞는 표준 카테고리가 없습니다."
                : tab === "unmapped"
                  ? "조건에 맞는 미매핑 카테고리가 없습니다."
                  : "조건에 맞는 매핑 완료 카테고리가 없습니다."}
            </div>
          ) : isGlobal ? (
            rows.map((row) => (
              <GlobalMappingTableRow
                key={row.pcode}
                row={row}
                onOpenPicker={(mall, current) =>
                  setEditing({
                    pcode: row.pcode,
                    pcodeLabel: row.label,
                    acode: mall.id,
                    mallName: mall.name,
                    mallColor: mall.color,
                    current,
                  })
                }
              />
            ))
          ) : tab === "unmapped" ? (
            rows.map((row) => (
              <UnmappedSiteFirstRow
                key={row.pcode}
                row={row}
                selected={selectedPcodes.has(row.pcode)}
                previewTag={selectedPcodes.has(row.pcode) ? selectedSiteTag : null}
                onToggleSelect={() => togglePcodeSelect(row.pcode)}
              />
            ))
          ) : (
            rows.map((row) => {
              const mapping = row.mappings.find((m) => m.acode === selectedMall);
              return (
                <CategoryRowItem
                  key={row.pcode}
                  row={row}
                  mall={activeMall!}
                  mapping={mapping}
                  onOpenPicker={() =>
                    setEditing({
                      pcode: row.pcode,
                      pcodeLabel: row.label,
                      acode: activeMall!.id,
                      mallName: activeMall!.name,
                      mallColor: activeMall!.color,
                      current: mapping ? { ccode: mapping.ccode, label: mapping.label } : undefined,
                    })
                  }
                />
              );
            })
          )}
        </div>

        <div className="cm-table-footer">
          <span className="cm-muted">
            전체 {total}개 중 {(page - 1) * PAGE_SIZE + 1}-
            {Math.min(page * PAGE_SIZE, total)}
          </span>
          {totalPages > 1 && (
            <div className="cm-pagination">
              <button
                className="cm-btn-ghost"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft size={14} /> 이전
              </button>
              <span className="cm-pagination-info">
                {page} / {totalPages} 페이지
              </span>
              <button
                className="cm-btn-ghost"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                다음 <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      </section>

      <CategoryPickerModal
        state={editing}
        saving={pickerSaving}
        onClose={() => setEditing(null)}
        onSave={savePickerSelection}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 표준 카테고리 1행 (특정 쇼핑몰 + 매핑완료 탭)                          */
/* 이 탭의 행은 항상 해당 쇼핑몰에 유효한 매핑이 있는 상태이므로           */
/* mapping은 항상 존재한다. 수정(Pencil) 버튼으로 모달을 연다.            */
/* ------------------------------------------------------------------ */
function CategoryRowItem({
  row,
  mall,
  mapping,
  onOpenPicker,
}: {
  row: StandardCategoryRow;
  mall: Mall;
  mapping?: MallCategoryMapping;
  onOpenPicker: () => void;
}) {
  return (
    <div className="cm-row-card">
      <div className="cm-row-main">
        <div className="cm-row-label">{row.label}</div>
        <div className="cm-row-code">{row.pcode}</div>
      </div>
      <div className={`cm-mall-status-chip cm-mall-status-chip-single ${mapping ? "mapped" : "unmapped"}`}>
        <span className="cm-mall-badge sm" style={{ background: mall.color }}>
          {mall.short}
        </span>
        <div className="cm-mall-status-info">
          <span className="cm-mall-status-name">{mall.name}</span>
          {mapping ? (
            <span className="cm-mall-status-path">{mapping.label}</span>
          ) : (
            <span className="cm-mall-status-empty">미매핑</span>
          )}
        </div>
        <button
          type="button"
          className="cm-mall-status-btn"
          title="매핑 수정"
          onClick={onOpenPicker}
        >
          <Pencil size={13} />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 표준 카테고리 1행 (특정 쇼핑몰 + 미매핑 탭)                            */
/* [사이트 카테고리 우선 매핑] 체크박스로 선택하면, 상단에서 미리 고른     */
/* 사이트 카테고리가 "적용 예정" 태그로 미리보기된다(아직 저장 전).        */
/* ------------------------------------------------------------------ */
function UnmappedSiteFirstRow({
  row,
  selected,
  previewTag,
  onToggleSelect,
}: {
  row: StandardCategoryRow;
  selected: boolean;
  previewTag: Tag | null;
  onToggleSelect: () => void;
}) {
  return (
    <div className={`cm-row-card ${selected ? "cm-row-card-selected" : ""}`}>
      <input
        type="checkbox"
        className="cm-row-checkbox"
        checked={selected}
        onChange={onToggleSelect}
      />
      <div className="cm-row-main">
        <div className="cm-row-label">{row.label}</div>
        <div className="cm-row-code">{row.pcode}</div>
      </div>
      <div className="cm-row-preview">
        {previewTag ? (
          <span className="cm-tag pending">
            <Check size={12} /> 적용 예정: {previewTag.label}
          </span>
        ) : selected ? (
          <span className="cm-muted">상단에서 사이트 카테고리를 선택하면 여기 미리보기가 표시됩니다.</span>
        ) : (
          <span className="cm-mall-status-empty">미매핑</span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 표준 카테고리 1행 ("전체" 선택 시)                                    */
/* 리스트 형태: 왼쪽에 표준 카테고리, 오른쪽에 그 표준 카테고리에 매핑된   */
/* 모든 사이트 카테고리를 테이블(쇼핑몰/카테고리 코드/카테고리 정보)로     */
/* 나열한다. 화면에 등록된 4개 몰(MALLS)뿐 아니라 실제 DB에 존재하는       */
/* 모든 몰의 매핑을 그대로 보여준다(하드코딩되지 않은 몰은 acode 그대로).  */
/* 등록된 4개 몰에 대해서만 연필 아이콘으로 수정 모달을 열 수 있다.        */
/* ------------------------------------------------------------------ */
function GlobalMappingTableRow({
  row,
  onOpenPicker,
}: {
  row: StandardCategoryRow;
  onOpenPicker: (mall: Mall, current?: Tag) => void;
}) {
  return (
    <div className="cm-glist-row">
      <div className="cm-glist-std">
        <div className="cm-row-label">{row.label}</div>
        <div className="cm-row-code">{row.pcode}</div>
      </div>
      <div className="cm-glist-mapped">
        {row.mappings.length === 0 ? (
          <div className="cm-glist-empty">매핑된 사이트 카테고리가 없습니다.</div>
        ) : (
          <table className="cm-glist-table">
            <thead>
              <tr>
                <th>쇼핑몰</th>
                <th>카테고리 코드</th>
                <th>카테고리 정보</th>
                <th aria-hidden />
              </tr>
            </thead>
            <tbody>
              {row.mappings.map((mapping, idx) => {
                const knownMall = MALLS.find((m) => m.id === mapping.acode);
                return (
                  <tr key={`${mapping.acode}-${mapping.ccode}-${idx}`}>
                    <td className="cm-glist-mallname">
                      {knownMall && (
                        <span className="cm-mall-badge sm" style={{ background: knownMall.color }}>
                          {knownMall.short}
                        </span>
                      )}
                      {mapping.mallName ?? mapping.acode}
                    </td>
                    <td className="cm-mono">{mapping.ccode || "—"}</td>
                    <td className="cm-glist-path">{mapping.label}</td>
                    <td className="cm-glist-action">
                      {knownMall && (
                        <button
                          type="button"
                          className="cm-mall-status-btn"
                          title="매핑 수정"
                          onClick={() =>
                            onOpenPicker(knownMall, { ccode: mapping.ccode, label: mapping.label })
                          }
                        >
                          <Pencil size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 카테고리 매핑 추가/수정 모달 (개별 1건 저장 전용)                      */
/* "검색"과 "트리로 찾기" 두 가지 방식을 제공한다.                        */
/* [수정 확정 버튼] 검색/트리에서 카테고리를 고르면 즉시 저장되지 않고     */
/* "적용 예정" 상태로만 미리보기된다. "적용" 버튼을 눌러야 실제로 저장     */
/* (POST /products/category-mapping)이 호출된다. 다른 카테고리를 다시     */
/* 고르면 적용 예정 값이 교체되고, 여전히 저장 전이다.                    */
/* ------------------------------------------------------------------ */
function CategoryPickerModal({
  state,
  saving,
  onClose,
  onSave,
}: {
  state: EditingState | null;
  saving: boolean;
  onClose: () => void;
  onSave: (tag: Tag) => Promise<void>;
}) {
  const [mode, setMode] = useState<"search" | "tree">("search");
  const [pendingTag, setPendingTag] = useState<Tag | null>(null);

  useEffect(() => {
    setMode("search");
    setPendingTag(null);
  }, [state?.pcode, state?.acode]);

  // ESC 키로 모달 닫기
  useEffect(() => {
    if (!state) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [state, onClose]);

  if (!state) return null;

  const handleApply = async () => {
    if (!pendingTag) return;
    await onSave(pendingTag);
  };

  return (
    <div className="cm-modal-overlay" onClick={onClose}>
      <div className="cm-modal cm-modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="cm-modal-header">
          <div className="cm-modal-header-titles">
            <span className="cm-modal-eyebrow">
              <span className="cm-mall-badge sm" style={{ background: state.mallColor }}>
                {state.mallName.slice(0, 1)}
              </span>
              {state.mallName} 카테고리 매핑
            </span>
            <h3>{state.pcodeLabel}</h3>
            <span className="cm-modal-pcode">{state.pcode}</span>
          </div>
          <button type="button" className="cm-modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {state.current && (
          <div className="cm-modal-current">
            <span className="cm-modal-current-label">현재 매핑</span>
            <span className="cm-tag">{state.current.label}</span>
          </div>
        )}

        <div className="cm-modal-modeswitch">
          <button
            type="button"
            className={mode === "search" ? "active" : ""}
            onClick={() => setMode("search")}
          >
            <Search size={13} /> 검색
          </button>
          <button
            type="button"
            className={mode === "tree" ? "active" : ""}
            onClick={() => setMode("tree")}
          >
            <ListTree size={13} /> 트리로 찾기
          </button>
        </div>

        <div className="cm-modal-body">
          {mode === "search" ? (
            <SiteCategorySearchBox
              acode={state.acode}
              placeholder="사이트 카테고리 검색 (예: 라운드넥 니트)"
              className="cm-autocomplete-wide"
              autoFocus
              onSelect={(tag) => setPendingTag(tag)}
            />
          ) : (
            <SiteCategoryTree
              acode={state.acode}
              activeCcode={pendingTag?.ccode ?? state.current?.ccode}
              activeLabel={pendingTag?.label ?? state.current?.label}
              onSelect={(tag) => setPendingTag(tag)}
            />
          )}
        </div>

        <div className="cm-modal-applybar">
          {pendingTag ? (
            <span className="cm-tag pending">
              <Check size={12} /> 적용 예정: {pendingTag.label}
              <button type="button" onClick={() => setPendingTag(null)}>
                <X size={12} />
              </button>
            </span>
          ) : (
            <span className="cm-muted">위에서 사이트 카테고리를 선택하세요.</span>
          )}
          <button
            type="button"
            className="cm-btn-primary"
            disabled={!pendingTag || saving}
            onClick={handleApply}
          >
            {saving ? "적용 중..." : "적용"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 사이트 카테고리 트리 (상품 등록 페이지와 동일한 "오른쪽으로 펼쳐지는"   */
/* 컬럼형 캐스케이딩 UI). GET /products/site-category/:acode 는 몰의     */
/* 사이트 카테고리 전체를 중첩 트리(children)로 반환하며, 실제 선택       */
/* 가능한 leaf 노드에만 ccode 값이 채워진다. 한 번 불러온 트리는 오래     */
/* (10분) 캐싱해 재방문 시 즉시 표시된다. 어떤 뎁스에서 노드를 클릭하면    */
/* 그 노드의 자식이 오른쪽에 새 컬럼으로 펼쳐지고, leaf(ccode 보유)       */
/* 노드를 클릭하면 바로 선택이 확정된다.                                 */
/* ------------------------------------------------------------------ */
function useSiteCategoryTree(acode: string) {
  return useQuery({
    queryKey: ["site-category-tree", acode],
    queryFn: async ({ signal }) => {
      const { data } = await api.get<{ success: boolean; data: SiteCategoryTreeNode[] }>(
        `/products/site-category/${acode}`,
        { signal },
      );
      return data.data;
    },
    enabled: !!acode,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
  });
}

function SiteCategoryTree({
  acode,
  activeCcode,
  activeLabel,
  onSelect,
}: {
  acode: string;
  activeCcode?: string;
  activeLabel?: string;
  onSelect: (tag: Tag) => void;
}) {
  const { data, isLoading, isError } = useSiteCategoryTree(acode);

  // 현재 선택된 경로가 있으면 해당 경로까지 컬럼이 자동으로 펼쳐진 상태로 보여준다.
  const initialPath = useMemo(
    () => (activeLabel ? activeLabel.split(" > ") : []),
    [activeLabel],
  );
  const [selectedPath, setSelectedPath] = useState<string[]>(initialPath);

  useEffect(() => {
    setSelectedPath(initialPath);
  }, [acode, initialPath]);

  // selectedPath를 따라가며 각 뎁스에서 보여줄 컬럼(노드 배열)들을 계산한다.
  const columns = useMemo(() => {
    if (!data) return [];
    const cols: SiteCategoryTreeNode[][] = [data];
    let currentLevel = data;
    for (const label of selectedPath) {
      const found = currentLevel.find((n) => n.label === label);
      if (!found || !found.children || found.children.length === 0) break;
      currentLevel = found.children;
      cols.push(currentLevel);
    }
    return cols;
  }, [data, selectedPath]);

  const handleNodeClick = (depth: number, node: SiteCategoryTreeNode) => {
    const pathToHere = [...selectedPath.slice(0, depth), node.label];
    if (node.ccode) {
      onSelect({ ccode: node.ccode, label: pathToHere.join(" > ") });
      return;
    }
    if (node.children && node.children.length > 0) {
      setSelectedPath(pathToHere);
    }
  };

  if (isLoading) {
    return (
      <div className="cm-tree-loading">
        <Loader2 size={14} className="cm-spin" /> 카테고리 트리를 불러오는 중...
      </div>
    );
  }
  if (isError) {
    return <div className="cm-tree-error">카테고리 트리를 불러오지 못했습니다.</div>;
  }
  if (!data || data.length === 0) {
    return <div className="cm-tree-empty">등록된 사이트 카테고리가 없습니다.</div>;
  }

  return (
    <div className="cm-tree-columns">
      {columns.map((columnNodes, depth) => (
        <div className="cm-tree-column" key={depth}>
          <div className="cm-tree-column-list">
            {columnNodes.map((node) => {
              const isOnPath = selectedPath[depth] === node.label;
              const isSelectable = !!node.ccode;
              const isActive = isSelectable && node.ccode === activeCcode;
              const hasChildren = !!node.children && node.children.length > 0;
              return (
                <button
                  key={node.id}
                  type="button"
                  className={`cm-tree-column-item ${isOnPath ? "selected" : ""} ${isActive ? "active" : ""}`}
                  onClick={() => handleNodeClick(depth, node)}
                >
                  <span>{node.label}</span>
                  {isActive && <Check size={13} className="cm-tree-check" />}
                  {hasChildren && !isActive && (
                    <ChevronRight size={14} className="cm-tree-column-arrow" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 사이트 카테고리 검색용 자동완성 입력창                                */
/* 사이트 카테고리(ccode)를 키워드로 검색해서 선택하면 onSelect 호출     */
/* ------------------------------------------------------------------ */
function SiteCategorySearchBox({
  acode,
  placeholder,
  className,
  autoFocus,
  onSelect,
}: {
  acode: string;
  placeholder: string;
  className?: string;
  autoFocus?: boolean;
  onSelect: (tag: Tag) => void;
}) {
  const [value, setValue] = useState("");
  const [results, setResults] = useState<SiteSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!value.trim()) {
      setResults([]);
      return;
    }
    let active = true;
    setLoading(true);
    const timer = setTimeout(() => {
      api
        .get(`/products/site-category/search/${acode}`, {
          params: { keyword: value.trim() },
        })
        .then(({ data }) => {
          if (active) setResults(Array.isArray(data) ? data : []);
        })
        .catch(() => {
          if (active) setResults([]);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [value, acode]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className={`cm-autocomplete ${className ?? ""}`} ref={boxRef}>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && value.trim() && (
        <div className="cm-autocomplete-list">
          {loading ? (
            <div className="cm-autocomplete-item muted">검색 중...</div>
          ) : results.length === 0 ? (
            <div className="cm-autocomplete-item muted">검색 결과가 없습니다.</div>
          ) : (
            results.map((r) => (
              <button
                key={r.ccode}
                className="cm-autocomplete-item"
                onClick={() => {
                  onSelect({ ccode: r.ccode, label: r.label });
                  setValue("");
                  setResults([]);
                  setOpen(false);
                }}
              >
                {r.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
