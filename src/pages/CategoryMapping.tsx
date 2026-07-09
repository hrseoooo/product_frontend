import { useEffect, useRef, useState } from "react";
import {
  Search,
  ChevronRight,
  ChevronLeft,
  X,
  Loader2,
  Layers,
} from "lucide-react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import Navigation from "../components/Navigation";
import api from "../api/axios";
import "./CategoryMapping.css";

/* ------------------------------------------------------------------ */
/* Master-Slave 구조:                                                  */
/* 표준 카테고리(playauto_cate, Master) 기준으로 사이트 카테고리         */
/* (playauto_site_cate, Slave)를 태그로 매핑한다.                       */
/* "미매핑" = 표준 카테고리에 해당 쇼핑몰 사이트 카테고리가 하나도 없음.   */
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

type Tab = "unmapped" | "mapped";

type Tag = { ccode: string; label: string };
type UnmappedRow = { pcode: string; label: string };
type MappedRow = { pcode: string; label: string; tags: Tag[] };
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
function listQueryKey(tab: Tab, acode: string, keyword: string, page: number) {
  return ["standard-category", tab, acode, keyword, page] as const;
}

function listEndpoint(tab: Tab, acode: string) {
  return tab === "unmapped"
    ? `/products/standard-category/unmapped/${acode}`
    : `/products/standard-category/mapped/${acode}`;
}

async function fetchList<T>(
  tab: Tab,
  acode: string,
  keyword: string,
  page: number,
  signal?: AbortSignal,
): Promise<ListResponse<T>> {
  const { data } = await api.get<ListResponse<T>>(listEndpoint(tab, acode), {
    params: { keyword, page, limit: PAGE_SIZE },
    signal,
  });
  return data;
}

export default function CategoryMapping() {
  const [acode, setAcode] = useState<string>(MALLS[0].id);
  const [tab, setTab] = useState<Tab>("unmapped");
  const [keyword, setKeyword] = useState("");
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  const [page, setPage] = useState(1);

  const queryClient = useQueryClient();

  // 미매핑 탭에서 사용자가 아직 서버에 저장하지 않고 화면에서 붙여둔 태그(1:N 구성 중)
  // pcode -> Tag[]
  const [pendingTags, setPendingTags] = useState<Record<string, Tag[]>>({});

  // 검색어 디바운스 (300ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKeyword(keyword), 300);
    return () => clearTimeout(timer);
  }, [keyword]);

  // 쇼핑몰/탭/검색어가 바뀌면 1페이지로 리셋
  useEffect(() => {
    setPage(1);
  }, [acode, tab, debouncedKeyword]);

  /* ---------------- 목록 로드 (react-query 캐싱) ----------------
   * - 같은 (탭, 몰, 검색어, 페이지) 조합은 staleTime(30초) 동안 재요청하지 않고
   *   캐시된 데이터를 즉시 반환합니다. 탭/몰을 왔다갔다 해도 API를 다시 부르지 않음.
   * - placeholderData: keepPreviousData 로 페이지/필터 전환 시 화면이 비었다가
   *   다시 채워지는 깜빡임 없이 이전 데이터를 유지한 채 새 데이터로 갈아탑니다.
   */
  const listQuery = useQuery({
    queryKey: listQueryKey(tab, acode, debouncedKeyword, page),
    queryFn: ({ signal }) =>
      fetchList<UnmappedRow | MappedRow>(tab, acode, debouncedKeyword, page, signal),
    enabled: !!acode,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });

  // [로딩 속도 개선] 현재 탭의 다음 페이지와, 반대 탭(첫 페이지)을 백그라운드에서
  // 미리 캐싱해둡니다. 사용자가 실제로 클릭했을 때는 이미 캐시에 있어 API 대기 없이
  // 즉시 렌더링됩니다 (react-query는 이미 캐시된 키는 중복 요청하지 않습니다).
  useEffect(() => {
    if (!acode) return;
    const totalKnown = listQuery.data?.total ?? 0;
    const hasNextPage = totalKnown > page * PAGE_SIZE;
    if (hasNextPage) {
      queryClient.prefetchQuery({
        queryKey: listQueryKey(tab, acode, debouncedKeyword, page + 1),
        queryFn: ({ signal }) =>
          fetchList<UnmappedRow | MappedRow>(tab, acode, debouncedKeyword, page + 1, signal),
        staleTime: 30_000,
      });
    }

    const otherTab: Tab = tab === "unmapped" ? "mapped" : "unmapped";
    queryClient.prefetchQuery({
      queryKey: listQueryKey(otherTab, acode, debouncedKeyword, 1),
      queryFn: ({ signal }) =>
        fetchList<UnmappedRow | MappedRow>(otherTab, acode, debouncedKeyword, 1, signal),
      staleTime: 30_000,
    });
  }, [acode, tab, debouncedKeyword, page, listQuery.data?.total, queryClient]);

  const loading = listQuery.isLoading;
  const unmappedRows = tab === "unmapped" ? ((listQuery.data?.data as UnmappedRow[]) ?? []) : [];
  const mappedRows = tab === "mapped" ? ((listQuery.data?.data as MappedRow[]) ?? []) : [];
  const total = listQuery.data?.total ?? 0;

  useEffect(() => {
    if (listQuery.error) {
      console.error("표준 카테고리 목록 로드 실패", listQuery.error);
    }
  }, [listQuery.error]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // 캐시에 들어있는 매핑완료 목록을 낙관적으로 갈아끼우는 헬퍼.
  // 서버에 실제로 반영된 뒤에도 invalidate로 최종 정합성을 맞춥니다.
  const currentMappedKey = listQueryKey(tab, acode, debouncedKeyword, page);
  const patchMappedCache = (
    updater: (rows: MappedRow[]) => MappedRow[],
  ) => {
    queryClient.setQueryData<ListResponse<MappedRow>>(currentMappedKey, (prev) =>
      prev ? { ...prev, data: updater(prev.data) } : prev,
    );
  };

  /* ---------------- 태그 추가/삭제 (매핑완료 탭: 즉시 서버 반영) ---------------- */
  const addTagImmediate = async (pcode: string, tag: Tag) => {
    await api.post("/products/category-mapping/tag", {
      pcode,
      acode,
      ccode: tag.ccode,
    });
    patchMappedCache((rows) =>
      rows.map((row) =>
        row.pcode === pcode ? { ...row, tags: [...row.tags, tag] } : row,
      ),
    );
    queryClient.invalidateQueries({ queryKey: ["standard-category", "mapped", acode] });
  };

  const removeTagImmediate = async (pcode: string, ccode: string) => {
    await api.post("/products/category-mapping/tag/remove", {
      pcode,
      acode,
      ccode,
    });
    patchMappedCache((rows) =>
      rows.map((row) =>
        row.pcode === pcode
          ? { ...row, tags: row.tags.filter((t) => t.ccode !== ccode) }
          : row,
      ),
    );
    queryClient.invalidateQueries({ queryKey: ["standard-category", "mapped", acode] });
  };

  /* ---------------- 태그 추가/삭제 (미매핑 탭: pendingTags에 쌓아두고 일괄/개별 확정) ---------------- */
  const addPendingTag = (pcode: string, tag: Tag) => {
    setPendingTags((prev) => {
      const cur = prev[pcode] ?? [];
      if (cur.some((t) => t.ccode === tag.ccode)) return prev;
      return { ...prev, [pcode]: [...cur, tag] };
    });
  };

  const removePendingTag = (pcode: string, ccode: string) => {
    setPendingTags((prev) => ({
      ...prev,
      [pcode]: (prev[pcode] ?? []).filter((t) => t.ccode !== ccode),
    }));
  };

  const confirmPendingTags = async (pcode: string) => {
    const tags = pendingTags[pcode];
    if (!tags || tags.length === 0) return;
    await Promise.all(
      tags.map((t) =>
        api.post("/products/category-mapping/tag", {
          pcode,
          acode,
          ccode: t.ccode,
        })
      )
    );
    setPendingTags((prev) => {
      const next = { ...prev };
      delete next[pcode];
      return next;
    });
    // 매핑이 완료됐으므로 미매핑 목록 캐시에서 제거하고, 매핑완료 목록은 무효화합니다.
    queryClient.setQueryData<ListResponse<UnmappedRow>>(currentMappedKey, (prev) =>
      prev
        ? {
            ...prev,
            data: prev.data.filter((r) => r.pcode !== pcode),
            total: Math.max(0, prev.total - 1),
          }
        : prev,
    );
    queryClient.invalidateQueries({ queryKey: ["standard-category", "unmapped", acode] });
    queryClient.invalidateQueries({ queryKey: ["standard-category", "mapped", acode] });
  };

  /* ---------------- 일괄 매핑 부스터 (미매핑 탭: 다중 선택 + 표준 카테고리 1개 지정 후 일괄 적용) ---------------- */
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedPcodes, setSelectedPcodes] = useState<Set<string>>(new Set());
  const [bulkTag, setBulkTag] = useState<Tag | null>(null);
  const [bulkApplying, setBulkApplying] = useState(false);

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
      await api.post("/products/category-mapping/tag/bulk", {
        acode,
        pcodes: [...selectedPcodes],
        ccode: bulkTag.ccode,
      });
      queryClient.setQueryData<ListResponse<UnmappedRow>>(currentMappedKey, (prev) =>
        prev
          ? {
              ...prev,
              data: prev.data.filter((r) => !selectedPcodes.has(r.pcode)),
              total: Math.max(0, prev.total - selectedPcodes.size),
            }
          : prev,
      );
      queryClient.invalidateQueries({ queryKey: ["standard-category", "unmapped", acode] });
      queryClient.invalidateQueries({ queryKey: ["standard-category", "mapped", acode] });
      setSelectedPcodes(new Set());
      setBulkTag(null);
      setBulkMode(false);
    } catch (err) {
      console.error("일괄 매핑 실패", err);
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
            표준 카테고리를 기준으로, 각 쇼핑몰의 사이트 카테고리를 태그로
            매핑하세요.
          </p>
        </div>
      </header>

      <section className="cm-mall-section">
        <div className="cm-mall-section-head">
          <span className="cm-mall-section-label">쇼핑몰 선택</span>
        </div>
        <div className="cm-mall-bar">
          {MALLS.map((mall) => {
            const on = acode === mall.id;
            return (
              <button
                key={mall.id}
                type="button"
                className={`cm-mall-pill ${on ? "active" : ""}`}
                onClick={() => setAcode(mall.id)}
              >
                <span className="cm-mall-badge" style={{ background: mall.color }}>
                  {mall.short}
                </span>
                {mall.name}
              </button>
            );
          })}
        </div>
      </section>

      <section className="cm-cascade-card">
        <div className="cm-tabs-toolbar">
          <div className="cm-tabs">
            <button
              className={`cm-tab-btn ${tab === "unmapped" ? "active" : ""}`}
              onClick={() => setTab("unmapped")}
            >
              미매핑 표준 카테고리
            </button>
            <button
              className={`cm-tab-btn ${tab === "mapped" ? "active" : ""}`}
              onClick={() => setTab("mapped")}
            >
              매핑 완료 표준 카테고리
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
            <div className="cm-bulk-search">
              <SiteCategorySearchBox
                acode={acode}
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
          ) : tab === "unmapped" ? (
            unmappedRows.length === 0 ? (
              <div className="cm-empty">조건에 맞는 미매핑 카테고리가 없습니다.</div>
            ) : (
              unmappedRows.map((row) => (
                <UnmappedRowItem
                  key={row.pcode}
                  row={row}
                  acode={acode}
                  bulkMode={bulkMode}
                  selected={selectedPcodes.has(row.pcode)}
                  onToggleSelect={() => toggleBulkSelect(row.pcode)}
                  pendingTags={pendingTags[row.pcode] ?? []}
                  onAddPendingTag={(tag) => addPendingTag(row.pcode, tag)}
                  onRemovePendingTag={(ccode) => removePendingTag(row.pcode, ccode)}
                  onConfirm={() => confirmPendingTags(row.pcode)}
                />
              ))
            )
          ) : mappedRows.length === 0 ? (
            <div className="cm-empty">조건에 맞는 매핑 완료 카테고리가 없습니다.</div>
          ) : (
            mappedRows.map((row) => (
              <MappedRowItem
                key={row.pcode}
                row={row}
                acode={acode}
                onAddTag={(tag) => addTagImmediate(row.pcode, tag)}
                onRemoveTag={(ccode) => removeTagImmediate(row.pcode, ccode)}
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
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 표준 카테고리 검색용 자동완성 입력창                                  */
/* 사이트 카테고리(ccode)를 키워드로 검색해서 선택하면 onSelect 호출     */
/* ------------------------------------------------------------------ */
function SiteCategorySearchBox({
  acode,
  placeholder,
  onSelect,
}: {
  acode: string;
  placeholder: string;
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
    <div className="cm-autocomplete" ref={boxRef}>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
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

/* ------------------------------------------------------------------ */
/* 미매핑 표준 카테고리 1행                                             */
/* ------------------------------------------------------------------ */
function UnmappedRowItem({
  row,
  acode,
  bulkMode,
  selected,
  onToggleSelect,
  pendingTags,
  onAddPendingTag,
  onRemovePendingTag,
  onConfirm,
}: {
  row: UnmappedRow;
  acode: string;
  bulkMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  pendingTags: Tag[];
  onAddPendingTag: (tag: Tag) => void;
  onRemovePendingTag: (ccode: string) => void;
  onConfirm: () => void;
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
        <div className="cm-row-mapping">
          <div className="cm-tag-list">
            {pendingTags.map((t) => (
              <span key={t.ccode} className="cm-tag pending">
                {t.label}
                <button onClick={() => onRemovePendingTag(t.ccode)}>
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          <SiteCategorySearchBox
            acode={acode}
            placeholder="사이트 카테고리 검색"
            onSelect={(tag) => onAddPendingTag(tag)}
          />
          {pendingTags.length > 0 && (
            <button className="cm-btn-primary sm" onClick={onConfirm}>
              매핑 확정
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 매핑완료 표준 카테고리 1행 (태그 N개, 자유 추가/삭제)                 */
/* ------------------------------------------------------------------ */
function MappedRowItem({
  row,
  acode,
  onAddTag,
  onRemoveTag,
}: {
  row: MappedRow;
  acode: string;
  onAddTag: (tag: Tag) => Promise<void>;
  onRemoveTag: (ccode: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <div className="cm-row-card">
      <div className="cm-row-main">
        <div className="cm-row-label">{row.label}</div>
        <div className="cm-row-code">{row.pcode}</div>
      </div>
      <div className="cm-row-mapping">
        <div className="cm-tag-list">
          {row.tags.map((t) => (
            <span key={t.ccode} className="cm-tag">
              {t.label}
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await onRemoveTag(t.ccode);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
        <SiteCategorySearchBox
          acode={acode}
          placeholder="사이트 카테고리 추가 검색"
          onSelect={async (tag) => {
            setBusy(true);
            try {
              await onAddTag(tag);
            } finally {
              setBusy(false);
            }
          }}
        />
      </div>
    </div>
  );
}
