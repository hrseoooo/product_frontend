import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  ChevronRight,
  ChevronLeft,
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
/*                                                                      */
/* [쇼핑몰 선택] 다중 선택은 제거되었고, 단일 선택(라디오 방식)이다.       */
/* - 특정 쇼핑몰 선택 시: 기존과 동일하게 그 쇼핑몰(acode) 기준으로       */
/*   미매핑/매핑완료를 조회한다.                                         */
/* - "전체" 선택 시: 쇼핑몰 구분이 아니라 표준 카테고리(pcode) 자체를     */
/*   기준으로 조회한다. "미매핑" = 어떤 쇼핑몰에도 매핑이 없는 표준        */
/*   카테고리, "매핑완료" = 하나 이상의 쇼핑몰에 매핑이 있는 표준          */
/*   카테고리(매핑된 사이트 카테고리를 전부 나열).                        */
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

const GLOBAL_KEY = "GLOBAL";

function getMallColor(acode: string): string {
  return MALLS.find((m) => m.id === acode)?.color ?? "#64748b";
}

// [매핑완료 탭을 먼저 보여주기 위해 순서 변경] 매핑완료 -> 미매핑
type Tab = "mapped" | "unmapped";

type Tag = { ccode: string; label: string };

// ---- 특정 쇼핑몰 선택 시 응답 모양 ----
// [1:1 원칙] 같은 pcode는 같은 acode 내에서 매핑을 최대 1개만 가진다.
type MallCategoryMapping = { acode: string; ccode: string; label: string };
type StandardCategoryRow = { pcode: string; label: string; mappings: MallCategoryMapping[] };

// ---- "전체" 선택 시 응답 모양 (쇼핑몰 구분 없이 pcode 기준) ----
type GlobalMappedSiteCategory = { acode: string; mallName: string; ccode: string; label: string };
type GlobalStandardCategoryRow = {
  pcode: string;
  label: string;
  siteCategories: GlobalMappedSiteCategory[];
};

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

function listEndpoint(tab: Tab, isGlobal: boolean) {
  if (isGlobal) {
    return tab === "unmapped"
      ? `/products/standard-category/global-unmapped`
      : `/products/standard-category/global-mapped`;
  }
  return tab === "unmapped"
    ? `/products/standard-category/unmapped`
    : `/products/standard-category/mapped`;
}

async function fetchList<T>(
  endpoint: string,
  params: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<ListResponse<T>> {
  const { data } = await api.get<ListResponse<T>>(endpoint, { params, signal });
  return data;
}

// 편집(추가/수정) 모달을 열 때 필요한 상태.
// acode가 null이면 "아직 어느 쇼핑몰에 매핑할지 선택하지 않은 상태"이며,
// 이 경우 모달이 먼저 쇼핑몰 선택 UI를 보여준다(전체 탭의 미매핑 표준
// 카테고리에 새로 매핑을 추가할 때 발생).
type EditingState = {
  pcode: string;
  pcodeLabel: string;
  acode: string | null;
  mallName: string | null;
  mallColor: string | null;
  current?: Tag;
};

export default function CategoryMapping() {
  // [단일 선택] 쇼핑몰 다중 선택 기능은 제거되었다. GLOBAL_KEY = "전체".
  const [selectedMall, setSelectedMall] = useState<string>(MALLS[0].id);
  const isGlobal = selectedMall === GLOBAL_KEY;

  // [매핑완료 탭을 먼저 보여줌]
  const [tab, setTab] = useState<Tab>("mapped");
  const [keyword, setKeyword] = useState("");
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  const [page, setPage] = useState(1);

  const queryClient = useQueryClient();

  // 검색어 디바운스 (300ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKeyword(keyword), 300);
    return () => clearTimeout(timer);
  }, [keyword]);

  // 쇼핑몰/탭/검색어가 바뀌면 1페이지로 리셋
  useEffect(() => {
    setPage(1);
  }, [selectedMall, tab, debouncedKeyword]);

  const endpoint = listEndpoint(tab, isGlobal);
  const params = useMemo(
    () =>
      isGlobal
        ? { keyword: debouncedKeyword, page, limit: PAGE_SIZE }
        : { acodes: selectedMall, keyword: debouncedKeyword, page, limit: PAGE_SIZE },
    [isGlobal, selectedMall, debouncedKeyword, page],
  );

  /* ---------------- 목록 로드 (react-query 캐싱) ----------------
   * - 같은 (탭, 몰, 검색어, 페이지) 조합은 staleTime(30초) 동안 재요청하지 않고
   *   캐시된 데이터를 즉시 반환합니다.
   * - placeholderData: keepPreviousData 로 페이지/필터 전환 시 화면이 비었다가
   *   다시 채워지는 깜빡임 없이 이전 데이터를 유지한 채 새 데이터로 갈아탑니다.
   */
  const listQuery = useQuery({
    queryKey: ["standard-category", tab, selectedMall, debouncedKeyword, page],
    queryFn: ({ signal }) =>
      fetchList<StandardCategoryRow | GlobalStandardCategoryRow>(endpoint, params, signal),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });

  // [로딩 속도 개선] 현재 탭의 다음 페이지와, 반대 탭(첫 페이지)을 백그라운드에서
  // 미리 캐싱해둡니다.
  useEffect(() => {
    const totalKnown = listQuery.data?.total ?? 0;
    const hasNextPage = totalKnown > page * PAGE_SIZE;
    if (hasNextPage) {
      queryClient.prefetchQuery({
        queryKey: ["standard-category", tab, selectedMall, debouncedKeyword, page + 1],
        queryFn: ({ signal }) =>
          fetchList(endpoint, { ...params, page: page + 1 }, signal),
        staleTime: 30_000,
      });
    }

    const otherTab: Tab = tab === "unmapped" ? "mapped" : "unmapped";
    const otherEndpoint = listEndpoint(otherTab, isGlobal);
    queryClient.prefetchQuery({
      queryKey: ["standard-category", otherTab, selectedMall, debouncedKeyword, 1],
      queryFn: ({ signal }) =>
        fetchList(otherEndpoint, { ...params, page: 1 }, signal),
      staleTime: 30_000,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMall, tab, debouncedKeyword, page, listQuery.data?.total, isGlobal]);

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
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [pickerSaving, setPickerSaving] = useState(false);

  /* ---------------- 매핑 설정/교체 ----------------
   * [1:1 원칙] 백엔드(POST /products/category-mapping)는 같은 (pcode, acode)에
   * 대해 항상 "덮어쓰기(수정)"로 동작하며, 별도의 삭제 API는 제공하지 않는다.
   * 저장 후에는 매핑완료/미매핑 소속이 바뀔 수 있으므로 두 탭의 캐시를
   * 모두 무효화해 정합성을 보장한다.
   */
  const savePickerSelection = async (tag: Tag) => {
    if (!editing || !editing.acode) return;
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

  // 전체 탭의 미매핑 표준 카테고리에 "매핑 추가"를 누르면 아직 어느
  // 쇼핑몰에 매핑할지 모르는 상태(acode=null)로 모달이 열린다. 모달 안에서
  // 쇼핑몰을 고르면 이 핸들러로 editing 상태를 채운다.
  const selectMallForEditing = (mall: Mall) => {
    setEditing((prev) =>
      prev ? { ...prev, acode: mall.id, mallName: mall.name, mallColor: mall.color } : prev,
    );
  };

  /* ---------------- 일괄 매핑 부스터 (특정 쇼핑몰 + 미매핑 탭 전용) ----------------
   * "전체" 탭은 여러 쇼핑몰에 걸친 조회라 일괄 매핑의 대상 쇼핑몰을 특정할 수
   * 없으므로, 특정 쇼핑몰을 선택했을 때만 제공한다.
   */
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedPcodes, setSelectedPcodes] = useState<Set<string>>(new Set());
  const [bulkTag, setBulkTag] = useState<Tag | null>(null);
  const [bulkApplying, setBulkApplying] = useState(false);

  useEffect(() => {
    // 쇼핑몰/탭이 바뀌면 일괄 매핑 상태를 초기화
    setBulkMode(false);
    setSelectedPcodes(new Set());
    setBulkTag(null);
  }, [selectedMall, tab]);

  const toggleBulkSelect = (pcode: string) => {
    setSelectedPcodes((prev) => {
      const next = new Set(prev);
      if (next.has(pcode)) next.delete(pcode);
      else next.add(pcode);
      return next;
    });
  };

  const applyBulkMapping = async () => {
    if (isGlobal || !bulkTag || selectedPcodes.size === 0) return;
    setBulkApplying(true);
    try {
      await api.post("/products/category-mapping/bulk", {
        acode: selectedMall,
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

          {tab === "unmapped" && !isGlobal && (
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

        {tab === "unmapped" && !isGlobal && bulkMode && (
          <div className="cm-bulk-bar">
            <span className="cm-bulk-count">{selectedPcodes.size}개 선택됨</span>
            <div className="cm-bulk-search">
              <SiteCategorySearchBox
                acode={selectedMall}
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
          {loading ? (
            <div className="cm-cascade-placeholder">
              <Loader2 size={16} className="cm-spin" /> 불러오는 중...
            </div>
          ) : rows.length === 0 ? (
            <div className="cm-empty">
              {tab === "unmapped"
                ? "조건에 맞는 미매핑 카테고리가 없습니다."
                : "조건에 맞는 매핑 완료 카테고리가 없습니다."}
            </div>
          ) : isGlobal ? (
            (rows as GlobalStandardCategoryRow[]).map((row) => (
              <GlobalCategoryRowItem
                key={row.pcode}
                row={row}
                tab={tab}
                onOpenAdd={() =>
                  setEditing({
                    pcode: row.pcode,
                    pcodeLabel: row.label,
                    acode: null,
                    mallName: null,
                    mallColor: null,
                  })
                }
                onOpenEdit={(site) =>
                  setEditing({
                    pcode: row.pcode,
                    pcodeLabel: row.label,
                    acode: site.acode,
                    mallName: site.mallName,
                    mallColor: getMallColor(site.acode),
                    current: { ccode: site.ccode, label: site.label },
                  })
                }
              />
            ))
          ) : (
            (rows as StandardCategoryRow[]).map((row) => {
              const mapping = row.mappings.find((m) => m.acode === selectedMall);
              return (
                <CategoryRowItem
                  key={row.pcode}
                  row={row}
                  mall={activeMall!}
                  mapping={mapping}
                  bulkMode={tab === "unmapped" && bulkMode}
                  selected={selectedPcodes.has(row.pcode)}
                  onToggleSelect={() => toggleBulkSelect(row.pcode)}
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
        onSelectMall={selectMallForEditing}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 표준 카테고리 1행 (특정 쇼핑몰 선택 시)                                */
/* 선택된 쇼핑몰 하나에 대한 매핑 상태를 보여주고, 버튼으로 매핑을         */
/* 추가(Plus)하거나 수정(Pencil)한다.                                    */
/* ------------------------------------------------------------------ */
function CategoryRowItem({
  row,
  mall,
  mapping,
  bulkMode,
  selected,
  onToggleSelect,
  onOpenPicker,
}: {
  row: StandardCategoryRow;
  mall: Mall;
  mapping?: MallCategoryMapping;
  bulkMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onOpenPicker: () => void;
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
            title={mapping ? "매핑 수정" : "매핑 추가"}
            onClick={onOpenPicker}
          >
            {mapping ? <Pencil size={13} /> : <Plus size={13} />}
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 표준 카테고리 1행 ("전체" 선택 시)                                    */
/* 미매핑 탭: pcode + label만 표시하고, "매핑 추가"를 누르면 쇼핑몰을      */
/* 먼저 고르는 모달이 열린다.                                            */
/* 매핑완료 탭: 왼쪽에 표준 카테고리, 오른쪽에 매핑된 모든 사이트          */
/* 카테고리(쇼핑몰 무관)를 표 형태로 나열한다.                            */
/* ------------------------------------------------------------------ */
function GlobalCategoryRowItem({
  row,
  tab,
  onOpenAdd,
  onOpenEdit,
}: {
  row: GlobalStandardCategoryRow;
  tab: Tab;
  onOpenAdd: () => void;
  onOpenEdit: (site: GlobalMappedSiteCategory) => void;
}) {
  return (
    <div className="cm-row-card cm-row-card-global">
      <div className="cm-row-main">
        <div className="cm-row-label">{row.label}</div>
        <div className="cm-row-code">{row.pcode}</div>
      </div>

      {tab === "unmapped" ? (
        <div className="cm-global-unmapped-side">
          <span className="cm-mall-status-empty">어떤 쇼핑몰에도 매핑되지 않음</span>
          <button type="button" className="cm-btn-primary sm" onClick={onOpenAdd}>
            <Plus size={13} /> 매핑 추가
          </button>
        </div>
      ) : (
        <div className="cm-global-table-wrap">
          <table className="cm-global-table">
            <thead>
              <tr>
                <th>쇼핑몰</th>
                <th>카테고리 코드</th>
                <th>카테고리 경로</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {row.siteCategories.map((site) => (
                <tr key={`${site.acode}-${site.ccode}`}>
                  <td>
                    <span className="cm-mall-badge sm" style={{ background: getMallColor(site.acode) }}>
                      {site.mallName.slice(0, 1)}
                    </span>
                    <span className="cm-global-mallname">{site.mallName}</span>
                  </td>
                  <td className="cm-mono">{site.ccode}</td>
                  <td>{site.label}</td>
                  <td>
                    <button
                      type="button"
                      className="cm-mall-status-btn"
                      title="매핑 수정"
                      onClick={() => onOpenEdit(site)}
                    >
                      <Pencil size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 카테고리 매핑 추가/수정 모달                                          */
/* acode가 아직 없으면(전체 탭에서 새로 추가하는 경우) 먼저 쇼핑몰을      */
/* 고르는 화면을 보여주고, 고른 뒤에는 "검색"/"트리로 찾기" 두 가지        */
/* 방식으로 사이트 카테고리를 선택한다.                                  */
/* ------------------------------------------------------------------ */
function CategoryPickerModal({
  state,
  saving,
  onClose,
  onSave,
  onSelectMall,
}: {
  state: EditingState | null;
  saving: boolean;
  onClose: () => void;
  onSave: (tag: Tag) => Promise<void>;
  onSelectMall: (mall: Mall) => void;
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
      <div className="cm-modal cm-modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="cm-modal-header">
          <div className="cm-modal-header-titles">
            <span className="cm-modal-eyebrow">
              {state.acode && state.mallColor && state.mallName ? (
                <>
                  <span className="cm-mall-badge sm" style={{ background: state.mallColor }}>
                    {state.mallName.slice(0, 1)}
                  </span>
                  {state.mallName} 카테고리 매핑
                </>
              ) : (
                "카테고리 매핑 추가"
              )}
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

        <div className="cm-modal-body">
          {!state.acode ? (
            <div className="cm-modal-mall-picker">
              <p className="cm-modal-mall-picker-desc">
                어느 쇼핑몰에 이 표준 카테고리를 매핑할지 먼저 선택해주세요.
              </p>
              <div className="cm-modal-mall-picker-list">
                {MALLS.map((mall) => (
                  <button
                    key={mall.id}
                    type="button"
                    className="cm-modal-mall-picker-item"
                    onClick={() => onSelectMall(mall)}
                  >
                    <span className="cm-mall-badge sm" style={{ background: mall.color }}>
                      {mall.short}
                    </span>
                    {mall.name}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
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
            </>
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
/* 사이트 카테고리 트리 (상품 등록 페이지와 동일한 "오른쪽으로 펼쳐지는"   */
/* 컬럼형 캐스케이딩 UI). GET /products/site-category/:acode 는 몰의     */
/* 사이트 카테고리 전체를 중첩 트리(children)로 반환하며, 실제 선택       */
/* 가능한 leaf 노드에만 ccode 값이 채워진다. 한 번 불러온 트리는 오래     */
/* (10분) 캐싱해 재방문 시 즉시 표시된다. 어떤 뎁스에서 노드를 클릭하면    */
/* 그 노드의 자식이 오른쪽에 새 컬럼으로 펼쳐지고(Register.tsx 표준        */
/* 카테고리 선택 UI와 동일한 방식), leaf(ccode 보유) 노드를 클릭하면       */
/* 바로 선택이 확정된다.                                                 */
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

  // 현재 매핑된 경로가 있으면 모달을 열었을 때 해당 경로까지 컬럼이
  // 자동으로 펼쳐진 상태로 보여준다. acode/activeLabel이 바뀌면 다시 계산.
  const initialPath = useMemo(
    () => (activeLabel ? activeLabel.split(" > ") : []),
    [activeLabel],
  );
  const [selectedPath, setSelectedPath] = useState<string[]>(initialPath);

  useEffect(() => {
    setSelectedPath(initialPath);
  }, [acode, initialPath]);

  // selectedPath를 따라가며 각 뎁스에서 보여줄 컬럼(노드 배열)들을 계산한다.
  // 예: selectedPath = ["패션의류잡화", "여성패션"] 이면
  //     [rootNodes, 패션의류잡화의 children, 여성패션의 children] 3개 컬럼.
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
