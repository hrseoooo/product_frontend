import { useEffect, useMemo, useState } from "react";
import {
  Search,
  ChevronRight,
  ChevronLeft,
  Check,
  RotateCcw,
  Layers,
  CircleCheck,
  CircleAlert,
  Loader2,
} from "lucide-react";
import Navigation from "../components/Navigation";
import api from "../api/axios";
import "./CategoryMapping.css";

/* ------------------------------------------------------------------ */
/* Mall definitions                                                     */
/* 실제 mall_accounts에 매핑된 acode가 확인된 쇼핑몰만 우선 하드코딩한다.  */
/* (mall-account.service.ts / update_db.ts 참고)                        */
/* 나머지 쇼핑몰(옥션/G마켓/인터파크/롯데온/위메프/티몬 등)의 acode는     */
/* 아직 확정되지 않아 추후 추가한다.                                     */
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

const MALL_MAP: Record<string, Mall> = Object.fromEntries(
  MALLS.map((m) => [m.id, m])
);

/* ------------------------------------------------------------------ */
/* API response types                                                  */
/* (product/src/products/dto/site-category.dto.ts 와 동일한 형태)       */
/* ------------------------------------------------------------------ */

type CategoryNode = {
  id: string;
  label: string;
  children: CategoryNode[];
};

type SiteCategoryRow = {
  number: string;
  acode: string;
  shopId: string;
  ccode: string;
  dc1Nm: string;
  dc2Nm: string;
  dc3Nm: string;
  dc4Nm: string;
  dc5Nm: string;
  dc6Nm: string;
  dc7Nm: string;
  cateStateCd: number;
  pcode?: string; // 매핑완료 목록에서만 내려옴
};

function isLeafNode(node?: CategoryNode): boolean {
  return !!node && (!node.children || node.children.length === 0);
}

function rowPath(row: SiteCategoryRow): string {
  return [row.dc1Nm, row.dc2Nm, row.dc3Nm, row.dc4Nm, row.dc5Nm, row.dc6Nm, row.dc7Nm]
    .filter(Boolean)
    .join(" > ");
}

type StatusFilter = "all" | "mapped" | "unmapped";
type CombinedRow = SiteCategoryRow & { mallId: string; isMapped: boolean };

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function CategoryMapping() {
  const [selectedMalls, setSelectedMalls] = useState<Set<string>>(
    new Set([MALLS[0].id])
  );
  const [activeMallId, setActiveMallId] = useState<string>(MALLS[0].id);

  // 몰별 사이트 카테고리 트리 캐시 (탐색 영역용, GET /products/site-category/:acode)
  const [treeCache, setTreeCache] = useState<Record<string, CategoryNode[]>>({});
  const [treeLoading, setTreeLoading] = useState(false);
  const [mallPaths, setMallPaths] = useState<Record<string, CategoryNode[]>>({});

  // 몰별 매핑/미매핑 사이트 카테고리 목록 캐시
  // (GET /products/site-category/mapped/:acode, /unmapped/:acode)
  const [rowsCache, setRowsCache] = useState<
    Record<string, { mapped: SiteCategoryRow[]; unmapped: SiteCategoryRow[] }>
  >({});
  const [rowsLoading, setRowsLoading] = useState(false);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // 미매핑 카테고리가 쇼핑몰당 만 건 단위로 나올 수 있어, 전체 행을 한 번에
  // <tr>로 렌더링하면 브라우저 메인 스레드가 초 단위로 멈춰버립니다.
  // 페이지 단위로 잘라서 그리도록 페이지네이션을 둡니다.
  const PAGE_SIZE = 50;
  const [page, setPage] = useState(1);

  // 현재 카스케이드 탐색 대상 몰 (선택된 몰 중에서만)
  const effectiveMallId =
    activeMallId && selectedMalls.has(activeMallId)
      ? activeMallId
      : [...selectedMalls][0] ?? null;

  /* ---------------- 사이트 카테고리 트리 로드 (탐색 영역) ---------------- */
  useEffect(() => {
    if (!effectiveMallId || treeCache[effectiveMallId]) return;
    let active = true;
    setTreeLoading(true);
    api
      .get(`/products/site-category/${effectiveMallId}`)
      .then(({ data }) => {
        if (!active) return;
        if (data?.success) {
          setTreeCache((prev) => ({ ...prev, [effectiveMallId]: data.data }));
        }
      })
      .catch((err) => console.error("사이트 카테고리 트리 로드 실패", err))
      .finally(() => {
        if (active) setTreeLoading(false);
      });
    return () => {
      active = false;
    };
  }, [effectiveMallId, treeCache]);

  /* ---------------- 선택된 몰들의 매핑/미매핑 목록 로드 (표 영역) ---------------- */
  useEffect(() => {
    const targets = [...selectedMalls].filter((id) => !rowsCache[id]);
    if (targets.length === 0) return;
    let active = true;
    setRowsLoading(true);
    Promise.all(
      targets.map((acode) =>
        Promise.all([
          api.get(`/products/site-category/mapped/${acode}`),
          api.get(`/products/site-category/unmapped/${acode}`),
        ]).then(([mappedRes, unmappedRes]) => ({
          acode,
          mapped: mappedRes.data?.success ? mappedRes.data.data : [],
          unmapped: unmappedRes.data?.success ? unmappedRes.data.data : [],
        }))
      )
    )
      .then((results) => {
        if (!active) return;
        setRowsCache((prev) => {
          const next = { ...prev };
          results.forEach((r) => {
            next[r.acode] = { mapped: r.mapped, unmapped: r.unmapped };
          });
          return next;
        });
      })
      .catch((err) =>
        console.error("사이트 카테고리 매핑/미매핑 목록 로드 실패", err)
      )
      .finally(() => {
        if (active) setRowsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedMalls, rowsCache]);

  const activePath = effectiveMallId ? mallPaths[effectiveMallId] ?? [] : [];

  // 현재 몰의 사이트 카테고리 트리로 카스케이드 컬럼 구성
  const columns = useMemo(() => {
    if (!effectiveMallId) return [];
    const tree = treeCache[effectiveMallId] ?? [];
    const cols: CategoryNode[][] = [tree];
    for (const node of activePath) {
      if (node.children && node.children.length) cols.push(node.children);
    }
    return cols;
  }, [effectiveMallId, activePath, treeCache]);

  const toggleMall = (id: string) => {
    setSelectedMalls((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else {
        next.add(id);
        setActiveMallId(id); // 새로 선택하면 해당 몰로 포커스
      }
      return next;
    });
  };

  const allSelected = selectedMalls.size === MALLS.length;
  const toggleAllMalls = () => {
    setSelectedMalls(allSelected ? new Set() : new Set(MALLS.map((m) => m.id)));
  };

  const handleSelect = (level: number, node: CategoryNode) => {
    if (!effectiveMallId) return;
    setMallPaths((prev) => {
      const cur = prev[effectiveMallId] ?? [];
      const next = cur.slice(0, level);
      next[level] = node;
      return { ...prev, [effectiveMallId]: next };
    });
  };

  const resetActivePath = () => {
    if (!effectiveMallId) return;
    setMallPaths((prev) => ({ ...prev, [effectiveMallId]: [] }));
  };

  /* ---------------- 표 영역: 선택된 몰 전체를 통합한 사이트 카테고리 목록 ---------------- */
  const combinedRows: CombinedRow[] = useMemo(() => {
    const rows: CombinedRow[] = [];
    selectedMalls.forEach((acode) => {
      const cache = rowsCache[acode];
      if (!cache) return;
      cache.mapped.forEach((r) => rows.push({ ...r, mallId: acode, isMapped: true }));
      cache.unmapped.forEach((r) =>
        rows.push({ ...r, mallId: acode, isMapped: false })
      );
    });
    return rows;
  }, [selectedMalls, rowsCache]);

  const filteredRows = combinedRows.filter((row) => {
    const path = rowPath(row);
    const matchesQuery =
      !query ||
      path.toLowerCase().includes(query.toLowerCase()) ||
      row.ccode.toLowerCase().includes(query.toLowerCase());
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "mapped" && row.isMapped) ||
      (statusFilter === "unmapped" && !row.isMapped);
    return matchesQuery && matchesStatus;
  });

  const totalCount = combinedRows.length;
  const mappedCount = combinedRows.filter((r) => r.isMapped).length;
  const progressPct = totalCount ? Math.round((mappedCount / totalCount) * 100) : 0;

  // 검색어/필터/쇼핑몰 선택이 바뀌면 1페이지로 리셋 (이전 필터 결과의 뒷페이지에
  // 머물러 있으면 빈 화면처럼 보일 수 있음)
  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, selectedMalls]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = useMemo(
    () => filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filteredRows, safePage]
  );

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
            여러 쇼핑몰을 선택한 뒤, 각 몰의 사이트 카테고리 매핑 현황을 한
            화면에서 확인하세요.
          </p>
        </div>
        <div className="cm-progress">
          <div className="cm-progress-stat">
            <span className="cm-progress-num">{progressPct}%</span>
            <span className="cm-progress-total">
              {mappedCount} / {totalCount} 카테고리 매핑
            </span>
          </div>
          <div className="cm-progress-bar">
            <div className="cm-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      </header>

      {/* Mall selector (multi-select) */}
      <section className="cm-mall-section">
        <div className="cm-mall-section-head">
          <span className="cm-mall-section-label">
            쇼핑몰 선택
            <em>{selectedMalls.size}개 선택됨</em>
          </span>
          <button className="cm-selectall-btn" onClick={toggleAllMalls}>
            {allSelected ? "전체 해제" : "전체 선택"}
          </button>
        </div>
        <div className="cm-mall-bar">
          {MALLS.map((mall) => {
            const on = selectedMalls.has(mall.id);
            return (
              <button
                key={mall.id}
                className={`cm-mall-pill ${on ? "active" : ""}`}
                onClick={() => toggleMall(mall.id)}
              >
                <span className="cm-mall-badge" style={{ background: mall.color }}>
                  {mall.short}
                </span>
                {mall.name}
                <span className={`cm-mall-check ${on ? "on" : ""}`}>
                  {on && <Check size={12} strokeWidth={3} />}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Site category cascade (browse, per mall) */}
      <section className="cm-cascade-card">
        <div className="cm-cascade-head">
          <h2>
            <Layers size={16} />
            사이트 카테고리 탐색
          </h2>
        </div>

        {selectedMalls.size === 0 ? (
          <div className="cm-cascade-placeholder">
            먼저 위에서 쇼핑몰을 선택하세요.
          </div>
        ) : (
          <>
            {/* 선택한 몰 탭 - 몰별로 사이트 카테고리 트리를 개별 탐색 */}
            <div className="cm-mall-tabs">
              {[...selectedMalls].map((id) => {
                const m = MALL_MAP[id];
                return (
                  <button
                    key={id}
                    className={`cm-mall-tab ${effectiveMallId === id ? "active" : ""}`}
                    onClick={() => setActiveMallId(id)}
                  >
                    <span
                      className="cm-mall-badge sm"
                      style={{ background: m.color }}
                    >
                      {m.short}
                    </span>
                    {m.name}
                  </button>
                );
              })}
            </div>

            {/* 현재 몰 breadcrumb */}
            <div className="cm-cascade-subhead">
              <div className="cm-breadcrumb">
                {activePath.length === 0 ? (
                  <span className="cm-breadcrumb-empty">
                    {effectiveMallId ? MALL_MAP[effectiveMallId].name : ""} 카테고리를
                    선택하세요
                  </span>
                ) : (
                  activePath.map((node, i) => (
                    <span key={node.id} className="cm-crumb">
                      {i > 0 && <ChevronRight size={13} className="cm-crumb-sep" />}
                      {node.label}
                    </span>
                  ))
                )}
              </div>
            </div>

            {treeLoading && !treeCache[effectiveMallId ?? ""] ? (
              <div className="cm-cascade-placeholder">
                <Loader2 size={16} className="cm-spin" /> 카테고리 불러오는 중...
              </div>
            ) : (
              <div className="cm-columns">
                {columns.map((col, level) => (
                  <div className="cm-column" key={level}>
                    {col.map((node) => {
                      const active = activePath[level]?.id === node.id;
                      const leaf = isLeafNode(node);
                      return (
                        <button
                          key={node.id}
                          className={`cm-column-item ${active ? "active" : ""}`}
                          onClick={() => handleSelect(level, node)}
                        >
                          <span className="cm-column-label">{node.label}</span>
                          {!leaf ? (
                            <ChevronRight size={14} className="cm-column-arrow" />
                          ) : (
                            active && <Check size={14} className="cm-column-check" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}

            <div className="cm-cascade-actions">
              <div className="cm-apply-target">
                <span className="cm-apply-target-label">
                  {effectiveMallId ? MALL_MAP[effectiveMallId].name : ""} 카테고리 경로
                </span>
                <div className="cm-apply-list">
                  <span className="cm-apply-item done">
                    <span className="cm-apply-path">
                      {activePath.length > 0
                        ? activePath.map((n) => n.label).join(" > ")
                        : "선택된 경로 없음"}
                    </span>
                  </span>
                </div>
              </div>
              <div className="cm-cascade-buttons">
                <button className="cm-btn-ghost" onClick={resetActivePath}>
                  <RotateCcw size={14} /> 경로 초기화
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Site category list (전체 / 매핑완료 / 미매핑) */}
      <section className="cm-table-card">
        <div className="cm-table-toolbar">
          <div className="cm-search">
            <Search size={16} className="cm-search-icon" />
            <input
              type="text"
              placeholder="카테고리명 또는 코드로 검색"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="cm-filter-group">
            {(["all", "mapped", "unmapped"] as const).map((f) => (
              <button
                key={f}
                className={`cm-filter-chip ${statusFilter === f ? "active" : ""}`}
                onClick={() => setStatusFilter(f)}
              >
                {f === "all" ? "전체" : f === "mapped" ? "매핑완료" : "미매핑"}
              </button>
            ))}
          </div>
        </div>

        <div className="cm-table-wrap">
          <table className="cm-table">
            <thead>
              <tr>
                <th style={{ width: 110 }}>쇼핑몰</th>
                <th>사이트 카테고리 경로</th>
                <th style={{ width: 140 }}>사이트 코드</th>
                <th style={{ width: 140 }}>매핑된 표준코드</th>
                <th style={{ width: 110 }}>상태</th>
              </tr>
            </thead>
            <tbody>
              {rowsLoading && filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="cm-empty">
                    불러오는 중...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="cm-empty">
                    조건에 맞는 카테고리가 없습니다.
                  </td>
                </tr>
              ) : (
                pagedRows.map((row, idx) => {
                  const m = MALL_MAP[row.mallId];
                  return (
                    <tr
                      key={`${row.mallId}-${row.number}-${row.ccode}-${row.pcode ?? "u"}-${idx}`}
                    >
                      <td>
                        <span
                          className="cm-mini-badge"
                          style={{ background: m.color, marginRight: 6 }}
                        >
                          {m.short}
                        </span>
                        {m.name}
                      </td>
                      <td>{rowPath(row) || "-"}</td>
                      <td className="cm-mono">{row.ccode}</td>
                      <td className="cm-mono">{row.pcode || "-"}</td>
                      <td>
                        {row.isMapped ? (
                          <span className="cm-status mapped">
                            <CircleCheck size={13} /> 매핑완료
                          </span>
                        ) : (
                          <span className="cm-status unmapped">
                            <CircleAlert size={13} /> 미매핑
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="cm-table-footer">
          <span className="cm-muted">
            전체 {filteredRows.length}개 중 {(safePage - 1) * PAGE_SIZE + 1}-
            {Math.min(safePage * PAGE_SIZE, filteredRows.length)}
          </span>
          {totalPages > 1 && (
            <div className="cm-pagination">
              <button
                className="cm-btn-ghost"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft size={14} /> 이전
              </button>
              <span className="cm-pagination-info">
                {safePage} / {totalPages} 페이지
              </span>
              <button
                className="cm-btn-ghost"
                disabled={safePage >= totalPages}
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
