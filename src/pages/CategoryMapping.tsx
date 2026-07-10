import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  X,
  Loader2,
  Layers,
  Check,
  Plus,
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
/* 최대 1개만 가질 수 있다(백엔드 setStandardMapping 참고). 백엔드는      */
/* 삭제(delete) API를 제공하지 않으므로, 매핑을 없애려면 다른 ccode로     */
/* 교체해야 한다.                                                       */
/* "미매핑" = 선택된 쇼핑몰 중 하나 이상에 사이트 카테고리 매핑이 없음.    */
/* "매핑완료" = 선택된 쇼핑몰 전체에 사이트 카테고리 매핑이 모두 존재.     */
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

// [매핑완료 탭을 먼저 보여주기 위해 순서 변경] 매핑완료 -> 미매핑
type Tab = "mapped" | "unmapped";

type Tag = { ccode: string; label: string };

// 백엔드(StandardCategoryRow)가 실제로 내려주는 모양: 몰(acode)별 매핑 1건.
// [1:1 원칙] 같은 pcode는 같은 acode 내에서 매핑을 최대 1개만 가진다.
type MallCategoryMapping = { acode: string; ccode: string; label: string };
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

// 탭별 엔드포인트/쿼리 캐시 키를 한 곳에서 관리합니다.
function listQueryKey(tab: Tab, acodesKey: string, keyword: string, page: number) {
  return ["standard-category", tab, acodesKey, keyword, page] as const;
}

function listEndpoint(tab: Tab) {
  return tab === "unmapped"
    ? `/products/standard-category/unmapped`
    : `/products/standard-category/mapped`;
}

async function fetchList(
  tab: Tab,
  acodesKey: string,
  keyword: string,
  page: number,
  signal?: AbortSignal,
): Promise<ListResponse<StandardCategoryRow>> {
  // 백엔드는 acode를 URL 경로가 아닌 acodes 쿼리 파라미터(쉼표구분, 다중 몰 지원)로 받는다.
  const { data } = await api.get<ListResponse<StandardCategoryRow>>(listEndpoint(tab), {
    params: { acodes: acodesKey, keyword, page, limit: PAGE_SIZE },
    signal,
  });
  return data;
}

export default function CategoryMapping() {
  // [다중 쇼핑몰 선택] 단일 선택 -> 배열 선택 + "전체" 옵션
  const [selectedAcodes, setSelectedAcodes] = useState<string[]>([MALLS[0].id]);
  // [매핑완료 탭을 먼저 보여줌]
  const [tab, setTab] = useState<Tab>("mapped");
  const [keyword, setKeyword] = useState("");
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  const [page, setPage] = useState(1);

  const queryClient = useQueryClient();

  // MALLS 순서를 기준으로 정렬된 "현재 선택된 몰" 목록 (클릭 순서에 영향받지 않도록)
  const orderedSelectedMalls = useMemo(
    () => MALLS.filter((m) => selectedAcodes.includes(m.id)),
    [selectedAcodes],
  );
  const acodesKey = useMemo(
    () => orderedSelectedMalls.map((m) => m.id).join(","),
    [orderedSelectedMalls],
  );
  const allSelected = selectedAcodes.length === MALLS.length;

  // [해제 안 되는 문제 수정] 이전에는 마지막 1개가 남으면 해제를 막았는데,
  // 그 상태에서 클릭해도 아무 반응이 없어 "버튼이 고장났다"고 느껴졌다.
  // 0개 선택도 허용하고, 대신 0개일 때는 명확한 안내 문구를 보여준다.
  const toggleMall = (id: string) => {
    setSelectedAcodes((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
    );
  };

  // [전체 버튼 토글 수정] 이전에는 항상 "전체 선택"만 하고 재클릭 시 해제하는
  // 로직이 없었다. 이미 전체 선택된 상태에서 다시 누르면 전체 해제되도록 토글.
  const toggleAllMalls = () => {
    setSelectedAcodes((prev) => (prev.length === MALLS.length ? [] : MALLS.map((m) => m.id)));
  };

  // 검색어 디바운스 (300ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKeyword(keyword), 300);
    return () => clearTimeout(timer);
  }, [keyword]);

  // 쇼핑몰/탭/검색어가 바뀌면 1페이지로 리셋
  useEffect(() => {
    setPage(1);
  }, [acodesKey, tab, debouncedKeyword]);

  /* ---------------- 목록 로드 (react-query 캐싱) ----------------
   * - 같은 (탭, 몰 조합, 검색어, 페이지) 조합은 staleTime(30초) 동안 재요청하지 않고
   *   캐시된 데이터를 즉시 반환합니다. 탭/몰 조합을 왔다갔다 해도 API를 다시 부르지 않음.
   * - placeholderData: keepPreviousData 로 페이지/필터 전환 시 화면이 비었다가
   *   다시 채워지는 깜빡임 없이 이전 데이터를 유지한 채 새 데이터로 갈아탑니다.
   */
  const listQuery = useQuery({
    queryKey: listQueryKey(tab, acodesKey, debouncedKeyword, page),
    queryFn: ({ signal }) => fetchList(tab, acodesKey, debouncedKeyword, page, signal),
    enabled: !!acodesKey,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });

  // [로딩 속도 개선] 현재 탭의 다음 페이지와, 반대 탭(첫 페이지)을 백그라운드에서
  // 미리 캐싱해둡니다. 사용자가 실제로 클릭했을 때는 이미 캐시에 있어 API 대기 없이
  // 즉시 렌더링됩니다 (react-query는 이미 캐시된 키는 중복 요청하지 않습니다).
  useEffect(() => {
    if (!acodesKey) return;
    const totalKnown = listQuery.data?.total ?? 0;
    const hasNextPage = totalKnown > page * PAGE_SIZE;
    if (hasNextPage) {
      queryClient.prefetchQuery({
        queryKey: listQueryKey(tab, acodesKey, debouncedKeyword, page + 1),
        queryFn: ({ signal }) => fetchList(tab, acodesKey, debouncedKeyword, page + 1, signal),
        staleTime: 30_000,
      });
    }

    const otherTab: Tab = tab === "unmapped" ? "mapped" : "unmapped";
    queryClient.prefetchQuery({
      queryKey: listQueryKey(otherTab, acodesKey, debouncedKeyword, 1),
      queryFn: ({ signal }) => fetchList(otherTab, acodesKey, debouncedKeyword, 1, signal),
      staleTime: 30_000,
    });
  }, [acodesKey, tab, debouncedKeyword, page, listQuery.data?.total, queryClient]);

  const loading = listQuery.isLoading;
  const rows = listQuery.data?.data ?? [];
  const total = listQuery.data?.total ?? 0;

  useEffect(() => {
    if (listQuery.error) {
      console.error("표준 카테고리 목록 로드 실패", listQuery.error);
    }
  }, [listQuery.error]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // 매핑을 추가/수정할 때 열리는 모달 상태
  const [editing, setEditing] = useState<{
    pcode: string;
    pcodeLabel: string;
    acode: string;
    mallName: string;
    mallColor: string;
    current?: Tag;
  } | null>(null);
  const [pickerSaving, setPickerSaving] = useState(false);

  /* ---------------- 매핑 설정/교체 ----------------
   * [1:1 원칙] 백엔드(POST /products/category-mapping)는 같은 (pcode, acode)에
   * 대해 항상 "덮어쓰기(수정)"로 동작하며, 별도의 삭제 API는 제공하지 않는다.
   * 저장 후에는 매핑완료/미매핑 소속이 바뀔 수 있으므로(예: 마지막 미매핑 몰을
   * 채우면 매핑완료로 이동) 두 탭의 캐시를 모두 무효화해 정합성을 보장한다.
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

  /* ---------------- 일괄 매핑 부스터 (미매핑 탭: 다중 선택 + 표준 카테고리 1개 지정 후 일괄 적용) ---------------- */
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedPcodes, setSelectedPcodes] = useState<Set<string>>(new Set());
  const [bulkAcode, setBulkAcode] = useState<string>(orderedSelectedMalls[0]?.id ?? MALLS[0].id);
  const [bulkTag, setBulkTag] = useState<Tag | null>(null);
  const [bulkApplying, setBulkApplying] = useState(false);

  useEffect(() => {
    // 선택된 몰 조합이 바뀌면 일괄 매핑 대상 몰도 그 안에 포함되도록 보정
    if (!orderedSelectedMalls.some((m) => m.id === bulkAcode)) {
      setBulkAcode(orderedSelectedMalls[0]?.id ?? MALLS[0].id);
    }
  }, [orderedSelectedMalls, bulkAcode]);

  const toggleBulkSelect = (pcode: string) => {
    setSelectedPcodes((prev) => {
      const next = new Set(prev);
      if (next.has(pcode)) next.delete(pcode);
      else next.add(pcode);
      return next;
    });
  };

  const applyBulkMapping = async () => {
    if (!bulkTag || selectedPcodes.size === 0) return;
    setBulkApplying(true);
    try {
      await api.post("/products/category-mapping/bulk", {
        acode: bulkAcode,
        pcodes: [...selectedPcodes],
        ccode: bulkTag.ccode,
      });
      await queryClient.invalidateQueries({ queryKey: ["standard-category"] });
      setSelectedPcodes(new Set());
      setBulkTag(null);
      setBulkMode(false);
    } catch (err) {
      console.error("일괄 매핑 실패", err);
      Swal.fire({ icon: "error", text: "일괄 매핑에 실패했습니다." });
    } finally {
      setBulkApplying(false);
    }
  };

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
          <span className="cm-mall-section-label">
            쇼핑몰 선택
            {selectedAcodes.length > 1 && (
              <em>{allSelected ? "전체 통합 조회" : `${selectedAcodes.length}개 통합 조회`}</em>
            )}
          </span>
        </div>
        <div className="cm-mall-bar">
          <button
            type="button"
            className={`cm-mall-pill cm-mall-pill-all ${allSelected ? "active" : ""}`}
            onClick={toggleAllMalls}
          >
            <span className="cm-mall-badge" style={{ background: "#0f172a" }}>
              <Layers size={12} />
            </span>
            전체
            <span className={`cm-mall-check ${allSelected ? "on" : ""}`}>
              <Check size={11} />
            </span>
          </button>
          {MALLS.map((mall) => {
            const on = selectedAcodes.includes(mall.id);
            return (
              <button
                key={mall.id}
                type="button"
                className={`cm-mall-pill ${on ? "active" : ""}`}
                onClick={() => toggleMall(mall.id)}
              >
                <span className="cm-mall-badge" style={{ background: mall.color }}>
                  {mall.short}
                </span>
                {mall.name}
                <span className={`cm-mall-check ${on ? "on" : ""}`}>
                  <Check size={11} />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="cm-cascade-card">
        <div className="cm-tabs-toolbar">
          <div className="cm-tabs">
            <button
              className={`cm-tab-btn ${tab === "mapped" ? "active" : ""}`}
              onClick={() => setTab("mapped")}
            >
              매핑 완료 표준 카테고리
            </button>
            <button
              className={`cm-tab-btn ${tab === "unmapped" ? "active" : ""}`}
              onClick={() => setTab("unmapped")}
            >
              미매핑 표준 카테고리
            </button>
          </div>

          <div className="cm-search">
            <Search size={16} className="cm-search-icon" />
            <input
              type="text"
              placeholder="표준 카테고리 키워드로 검색 (예: 가디건)"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>

          {tab === "unmapped" && (
            <button
              className={`cm-btn-ghost ${bulkMode ? "active" : ""}`}
              onClick={() => {
                setBulkMode((v) => !v);
                setSelectedPcodes(new Set());
                setBulkTag(null);
              }}
            >
              {bulkMode ? "일괄 매핑 종료" : "일괄 매핑 모드"}
            </button>
          )}
        </div>

        {tab === "unmapped" && bulkMode && (
          <div className="cm-bulk-bar">
            <span className="cm-bulk-count">{selectedPcodes.size}개 선택됨</span>
            {orderedSelectedMalls.length > 1 && (
              <select
                className="cm-bulk-mall-select"
                value={bulkAcode}
                onChange={(e) => setBulkAcode(e.target.value)}
              >
                {orderedSelectedMalls.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} 기준으로 일괄 적용
                  </option>
                ))}
              </select>
            )}
            <div className="cm-bulk-search">
              <SiteCategorySearchBox
                acode={bulkAcode}
                placeholder="일괄 적용할 사이트 카테고리 검색"
                onSelect={(tag) => setBulkTag(tag)}
              />
            </div>
            {bulkTag && (
              <span className="cm-tag cm-bulk-selected-tag">
                {bulkTag.label}
                <button onClick={() => setBulkTag(null)}>
                  <X size={12} />
                </button>
              </span>
            )}
            <button
              className="cm-btn-primary"
              disabled={!bulkTag || selectedPcodes.size === 0 || bulkApplying}
              onClick={applyBulkMapping}
            >
              {bulkApplying ? "적용 중..." : `일괄 매핑(Bulk Apply)`}
            </button>
          </div>
        )}

        <div className="cm-list-wrap">
          {selectedAcodes.length === 0 ? (
            // [출력 안 되는 문제 대응] 몰을 하나도 선택하지 않으면 API 자체를
            // 호출하지 않으므로(enabled: !!acodesKey), 빈 결과와 구분되는
            // 명확한 안내를 보여준다.
            <div className="cm-empty">쇼핑몰을 1개 이상 선택해주세요.</div>
          ) : loading ? (
            <div className="cm-cascade-placeholder">
              <Loader2 size={16} className="cm-spin" /> 불러오는 중...
            </div>
          ) : rows.length === 0 ? (
            <div className="cm-empty">
              {tab === "unmapped"
                ? "조건에 맞는 미매핑 카테고리가 없습니다."
                : selectedAcodes.length > 1
                  ? "선택한 쇼핑몰 전체에 매핑이 모두 존재하는 표준 카테고리가 없습니다. (매핑완료는 선택된 몰 전체 기준입니다)"
                  : "조건에 맞는 매핑 완료 카테고리가 없습니다."}
            </div>
          ) : (
            rows.map((row) => (
              <CategoryRowItem
                key={row.pcode}
                row={row}
                malls={orderedSelectedMalls}
                bulkMode={tab === "unmapped" && bulkMode}
                selected={selectedPcodes.has(row.pcode)}
                onToggleSelect={() => toggleBulkSelect(row.pcode)}
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
/* 표준 카테고리 1행                                                     */
/* 선택된 몰(malls)마다 매핑 상태 칩을 보여주고, 칩의 버튼으로 매핑을      */
/* 추가(Plus)하거나 수정(Pencil)한다. 매핑완료/미매핑 탭 공용 컴포넌트.    */
/* ------------------------------------------------------------------ */
function CategoryRowItem({
  row,
  malls,
  bulkMode,
  selected,
  onToggleSelect,
  onOpenPicker,
}: {
  row: StandardCategoryRow;
  malls: Mall[];
  bulkMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onOpenPicker: (mall: Mall, current?: Tag) => void;
}) {
  return (
    <div className="cm-row-card">
      {bulkMode && (
        <input
          type="checkbox"
          className="cm-row-checkbox"
          checked={selected}
          onChange={onToggleSelect}
        />
      )}
      <div className="cm-row-main">
        <div className="cm-row-label">{row.label}</div>
        <div className="cm-row-code">{row.pcode}</div>
      </div>
      {!bulkMode && (
        <div className="cm-row-mall-list">
          {malls.map((mall) => {
            const mapping = row.mappings.find((m) => m.acode === mall.id);
            return (
              <div
                key={mall.id}
                className={`cm-mall-status-chip ${mapping ? "mapped" : "unmapped"}`}
              >
                <span className="cm-mall-badge sm" style={{ background: mall.color }}>
                  {mall.short}
                </span>
                <div className="cm-mall-status-info">
                  <span className="cm-mall-status-name">{mall.name}</span>
                  {mapping ? (
                    <span className="cm-mall-status-path" title={mapping.label}>
                      {mapping.label}
                    </span>
                  ) : (
                    <span className="cm-mall-status-empty">미매핑</span>
                  )}
                </div>
                <button
                  type="button"
                  className="cm-mall-status-btn"
                  title={mapping ? "매핑 수정" : "매핑 추가"}
                  onClick={() =>
                    onOpenPicker(
                      mall,
                      mapping ? { ccode: mapping.ccode, label: mapping.label } : undefined,
                    )
                  }
                >
                  {mapping ? <Pencil size={13} /> : <Plus size={13} />}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 카테고리 매핑 추가/수정 모달                                          */
/* "검색"(자동완성)과 "트리로 찾기"(상품 등록 페이지와 동일한 트리 조회   */
/* API를 재사용) 두 가지 방식을 제공한다. 검색 기능은 기존 그대로 유지    */
/* 하고, 트리 탐색 기능을 추가로 제공한다.                                */
/* ------------------------------------------------------------------ */
function CategoryPickerModal({
  state,
  saving,
  onClose,
  onSave,
}: {
  state: {
    pcode: string;
    pcodeLabel: string;
    acode: string;
    mallName: string;
    mallColor: string;
    current?: Tag;
  } | null;
  saving: boolean;
  onClose: () => void;
  onSave: (tag: Tag) => Promise<void>;
}) {
  const [mode, setMode] = useState<"search" | "tree">("search");

  useEffect(() => {
    setMode("search");
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

  return (
    <div className="cm-modal-overlay" onClick={onClose}>
      <div className="cm-modal" onClick={(e) => e.stopPropagation()}>
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
              onSelect={onSave}
            />
          ) : (
            <SiteCategoryTree
              acode={state.acode}
              activeCcode={state.current?.ccode}
              activeLabel={state.current?.label}
              onSelect={onSave}
            />
          )}
        </div>

        {saving && (
          <div className="cm-modal-saving">
            <Loader2 size={14} className="cm-spin" /> 저장 중...
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 사이트 카테고리 트리 (상품 등록 페이지와 동일한 트리형 API 재사용)     */
/* GET /products/site-category/:acode 는 몰의 사이트 카테고리 전체를     */
/* 중첩 트리(children)로 반환하며, 실제 선택 가능한 leaf 노드에만 ccode  */
/* 값이 채워진다. 한 번 불러온 트리는 오래(10분) 캐싱해 재방문 시 즉시    */
/* 표시되며, 화면에는 펼치기/접기로 필요한 부분만 렌더링해 성능을 지킨다.  */
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
  // 현재 매핑된 경로가 있으면 트리를 열었을 때 해당 경로까지 자동으로 펼쳐서 보여준다.
  const autoExpandPath = useMemo(
    () => (activeLabel ? activeLabel.split(" > ") : undefined),
    [activeLabel],
  );

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
    <div className="cm-tree-scroll">
      {data.map((node) => (
        <SiteCategoryTreeNodeView
          key={node.id}
          node={node}
          depth={0}
          path={[]}
          activeCcode={activeCcode}
          autoExpandPath={autoExpandPath}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function SiteCategoryTreeNodeView({
  node,
  depth,
  path,
  activeCcode,
  autoExpandPath,
  onSelect,
}: {
  node: SiteCategoryTreeNode;
  depth: number;
  path: string[];
  activeCcode?: string;
  autoExpandPath?: string[];
  onSelect: (tag: Tag) => void;
}) {
  const shouldAutoExpand = !!autoExpandPath && autoExpandPath[depth] === node.label;
  const [open, setOpen] = useState(shouldAutoExpand);

  useEffect(() => {
    if (shouldAutoExpand) setOpen(true);
  }, [shouldAutoExpand]);

  const hasChildren = node.children && node.children.length > 0;
  const isSelectable = !!node.ccode;
  const isActive = isSelectable && node.ccode === activeCcode;
  const childPath = [...path, node.label];

  return (
    <div className="cm-tree-node">
      <div className={`cm-tree-row ${isActive ? "active" : ""}`}>
        {hasChildren ? (
          <button
            type="button"
            className="cm-tree-toggle"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "접기" : "펼치기"}
          >
            <ChevronDown size={14} className={open ? "" : "cm-tree-toggle-closed"} />
          </button>
        ) : (
          <span className="cm-tree-toggle-spacer" />
        )}
        <button
          type="button"
          className="cm-tree-label"
          onClick={() =>
            isSelectable
              ? onSelect({ ccode: node.ccode!, label: childPath.join(" > ") })
              : setOpen((o) => !o)
          }
        >
          <span>{node.label}</span>
          {isActive && <Check size={13} className="cm-tree-check" />}
        </button>
      </div>
      {hasChildren && open && (
        <div className="cm-tree-children">
          {node.children.map((child) => (
            <SiteCategoryTreeNodeView
              key={child.id}
              node={child}
              depth={depth + 1}
              path={childPath}
              activeCcode={activeCcode}
              autoExpandPath={autoExpandPath}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 사이트 카테고리 검색용 자동완성 입력창 (기존 검색 기능 유지)          */
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
