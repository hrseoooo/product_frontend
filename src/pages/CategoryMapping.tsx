import { useMemo, useState } from "react";
import {
  Search,
  ChevronRight,
  Check,
  RotateCcw,
  Save,
  Layers,
  CircleCheck,
  CircleAlert,
} from "lucide-react";
import Navigation from "../components/Navigation";
import "./CategoryMapping.css";

/* ------------------------------------------------------------------ */
/* Dummy data                                                          */
/* ------------------------------------------------------------------ */

type Mall = {
  id: string;
  name: string;
  short: string;
  color: string;
};

const MALLS: Mall[] = [
  { id: "auction", name: "옥션", short: "A", color: "#e4002b" },
  { id: "gmarket", name: "G마켓", short: "G", color: "#00a862" },
  { id: "11st", name: "11번가", short: "11", color: "#ff0038" },
  { id: "interpark", name: "인터파크", short: "IP", color: "#e6007e" },
  { id: "coupang", name: "쿠팡", short: "C", color: "#ff5a4a" },
  { id: "smartstore", name: "스마트스토어", short: "N", color: "#03c75a" },
  { id: "lotteon", name: "롯데온", short: "L", color: "#da0f19" },
  { id: "wemakeprice", name: "위메프", short: "W", color: "#f23b57" },
  { id: "tmon", name: "티몬", short: "T", color: "#ff4757" },
];

const MALL_MAP: Record<string, Mall> = Object.fromEntries(
  MALLS.map((m) => [m.id, m])
);

type CategoryNode = {
  id: string;
  name: string;
  code?: string; // 사이트 카테고리 코드 (leaf)
  children?: CategoryNode[];
};

/* 쇼핑몰마다 서로 다른 "사이트 카테고리" 체계를 갖는다 */

const TREE_MARKET: CategoryNode[] = [
  {
    id: "m-car",
    name: "자동차용품",
    children: [
      {
        id: "m-car-scooter",
        name: "스쿠터/전동휠",
        children: [
          { id: "m-car-scooter-e", name: "전동스쿠터", code: "200012345" },
          { id: "m-car-scooter-k", name: "전동킥보드", code: "200012346" },
        ],
      },
      {
        id: "m-car-tire",
        name: "타이어/휠",
        children: [{ id: "m-car-tire-s", name: "스노우타이어", code: "200012350" }],
      },
    ],
  },
  {
    id: "m-fashion",
    name: "패션의류/잡화",
    children: [
      {
        id: "m-fashion-w",
        name: "여성의류",
        children: [
          { id: "m-fashion-w-coat", name: "코트/자켓", code: "200013001" },
          { id: "m-fashion-w-tee", name: "티셔츠", code: "200013002" },
        ],
      },
    ],
  },
  {
    id: "m-digital",
    name: "디지털/휴대폰",
    children: [
      {
        id: "m-digital-mobile",
        name: "휴대폰액세서리",
        children: [
          { id: "m-digital-mobile-case", name: "케이스", code: "200014001" },
          { id: "m-digital-mobile-ear", name: "이어폰", code: "200014002" },
        ],
      },
    ],
  },
];

const TREE_PORTAL: CategoryNode[] = [
  {
    id: "p-sports",
    name: "스포츠/레저",
    children: [
      {
        id: "p-sports-bike",
        name: "자전거/이동수단",
        children: [
          { id: "p-sports-bike-e", name: "전기자전거", code: "CAT_50001" },
          { id: "p-sports-bike-k", name: "킥보드", code: "CAT_50002" },
        ],
      },
    ],
  },
  {
    id: "p-fashion",
    name: "패션의류",
    children: [
      {
        id: "p-fashion-outer",
        name: "아우터",
        children: [
          { id: "p-fashion-outer-coat", name: "코트", code: "CAT_50101" },
          { id: "p-fashion-outer-pad", name: "패딩", code: "CAT_50102" },
        ],
      },
    ],
  },
  {
    id: "p-digital",
    name: "가전/디지털",
    children: [
      {
        id: "p-digital-phone",
        name: "휴대폰",
        children: [
          { id: "p-digital-phone-case", name: "휴대폰케이스", code: "CAT_50201" },
          { id: "p-digital-phone-ear", name: "블루투스이어폰", code: "CAT_50202" },
        ],
      },
    ],
  },
];

const TREE_DEPT: CategoryNode[] = [
  {
    id: "d-living",
    name: "리빙/모빌리티",
    children: [
      {
        id: "d-living-move",
        name: "이동수단",
        children: [
          { id: "d-living-move-scooter", name: "전동스쿠터", code: "LC-9001" },
          { id: "d-living-move-kick", name: "킥보드", code: "LC-9002" },
        ],
      },
    ],
  },
  {
    id: "d-fashion",
    name: "패션",
    children: [
      {
        id: "d-fashion-women",
        name: "여성패션",
        children: [
          { id: "d-fashion-women-jacket", name: "자켓", code: "LC-9101" },
          { id: "d-fashion-women-onepiece", name: "원피스", code: "LC-9102" },
        ],
      },
    ],
  },
  {
    id: "d-elec",
    name: "전자기기",
    children: [
      {
        id: "d-elec-phone",
        name: "스마트폰",
        children: [
          { id: "d-elec-phone-main", name: "스마트폰본체", code: "LC-9201" },
          { id: "d-elec-phone-acc", name: "주변기기", code: "LC-9202" },
        ],
      },
    ],
  },
];

const MALL_TREES: Record<string, CategoryNode[]> = {
  auction: TREE_MARKET,
  gmarket: TREE_MARKET,
  "11st": TREE_MARKET,
  interpark: TREE_MARKET,
  coupang: TREE_PORTAL,
  smartstore: TREE_PORTAL,
  lotteon: TREE_DEPT,
  wemakeprice: TREE_DEPT,
  tmon: TREE_DEPT,
};

type MappingRow = {
  id: string;
  productCode: string;
  productName: string;
  // mallId -> 사이트 카테고리 경로 (있으면 매핑됨)
  mappings: Record<string, string[]>;
  updatedAt: string;
};

const INITIAL_ROWS: MappingRow[] = [
  {
    id: "41_07_05_00",
    productCode: "41_07_05_00",
    productName: "전동 킥보드 350W",
    mappings: {
      auction: ["자동차용품", "스쿠터/전동휠", "전동킥보드"],
      gmarket: ["자동차용품", "스쿠터/전동휠", "전동킥보드"],
      coupang: ["스포츠/레저", "자전거/이동수단", "킥보드"],
    },
    updatedAt: "2025-06-28 14:12",
  },
  {
    id: "38_02_01_00",
    productCode: "38_02_01_00",
    productName: "여성 트렌치 코트",
    mappings: {
      smartstore: ["패션의류", "아우터", "코트"],
      lotteon: ["패션", "여성패션", "자켓"],
    },
    updatedAt: "2025-06-30 09:41",
  },
  {
    id: "12_44_09_00",
    productCode: "12_44_09_00",
    productName: "무선 블루투스 이어폰",
    mappings: {},
    updatedAt: "-",
  },
  {
    id: "55_01_02_00",
    productCode: "55_01_02_00",
    productName: "스마트폰 강화유리 케이스",
    mappings: {},
    updatedAt: "-",
  },
];

type RowStatus = "mapped" | "partial" | "unmapped";
// 특정 몰 하나만 놓고 볼 때는 매핑되어 있는지 여부만 의미가 있다 (이분법).
type MallRowStatus = "mapped" | "unmapped";

function getRowStatus(row: MappingRow): RowStatus {
  const count = Object.keys(row.mappings).length;
  if (count === 0) return "unmapped";
  if (count === MALLS.length) return "mapped";
  return "partial";
}

// 다른 몰의 매핑 여부와 무관하게, 지정한 몰 기준으로만 상태를 판단한다.
// (옥션에 매핑했다고 해서 G마켓 기준 상태가 바뀌면 안 됨)
function getRowStatusForMall(row: MappingRow, mallId: string): MallRowStatus {
  return row.mappings[mallId] ? "mapped" : "unmapped";
}

function isLeafPath(path?: CategoryNode[]): boolean {
  return !!path && path.length > 0 && !path[path.length - 1].children;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function CategoryMapping() {
  const [selectedMalls, setSelectedMalls] = useState<Set<string>>(
    new Set(["auction", "gmarket"])
  );
  // 쇼핑몰별로 각각의 사이트 카테고리 선택 경로를 관리
  const [mallPaths, setMallPaths] = useState<Record<string, CategoryNode[]>>({});
  const [activeMallId, setActiveMallId] = useState<string>("auction");
  const [rows, setRows] = useState<MappingRow[]>(INITIAL_ROWS);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(
    INITIAL_ROWS[0].id
  );
  const [query, setQuery] = useState("");
  // 상태 필터는 "몰 전체 기준"이 아니라, 지금 포커스된 몰(effectiveMallId) 기준으로 매핑 여부를 본다.
  // 예: 옥션에만 매핑된 상품은 옥션 기준으로는 "완료", G마켓 기준으로는 여전히 "미매핑".
  const [statusFilter, setStatusFilter] = useState<"all" | MallRowStatus>("all");

  // 현재 카스케이드에 보여줄 몰 (선택된 몰 중에서만)
  const effectiveMallId =
    activeMallId && selectedMalls.has(activeMallId)
      ? activeMallId
      : [...selectedMalls][0] ?? null;

  const activePath = effectiveMallId ? mallPaths[effectiveMallId] ?? [] : [];

  // 현재 몰의 사이트 카테고리 트리로 카스케이드 컬럼 구성
  const columns = useMemo(() => {
    if (!effectiveMallId) return [];
    const tree = MALL_TREES[effectiveMallId] ?? [];
    const cols: CategoryNode[][] = [tree];
    for (const node of activePath) {
      if (node.children && node.children.length) cols.push(node.children);
    }
    return cols;
  }, [effectiveMallId, activePath]);

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

  // 선택 완료(leaf까지)된 몰 목록
  const completedMalls = [...selectedMalls].filter((id) =>
    isLeafPath(mallPaths[id])
  );

  const canApply = completedMalls.length > 0 && !!selectedRowId;

  const handleApply = () => {
    if (!canApply || !selectedRowId) return;
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== selectedRowId) return r;
        const mappings = { ...r.mappings };
        completedMalls.forEach((id) => {
          mappings[id] = mallPaths[id].map((n) => n.name);
        });
        return {
          ...r,
          mappings,
          updatedAt: new Date().toISOString().slice(0, 16).replace("T", " "),
        };
      })
    );
  };

  // 필터 기준으로 삼을 몰 (아무 몰도 선택돼 있지 않으면 전체 몰 중 첫 번째로 대체)
  const filterMallId = effectiveMallId ?? MALLS[0].id;

  const filteredRows = rows.filter((r) => {
    const matchesQuery =
      !query ||
      r.productName.toLowerCase().includes(query.toLowerCase()) ||
      r.productCode.toLowerCase().includes(query.toLowerCase());
    const matchesStatus =
      statusFilter === "all" ||
      getRowStatusForMall(r, filterMallId) === statusFilter;
    return matchesQuery && matchesStatus;
  });

  const totalCells = rows.length * MALLS.length;
  const doneCells = rows.reduce(
    (sum, r) => sum + Object.keys(r.mappings).length,
    0
  );
  const progressPct = totalCells ? Math.round((doneCells / totalCells) * 100) : 0;

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
            여러 쇼핑몰을 선택한 뒤, 각 몰의 사이트 카테고리를 지정하고 한 번에
            매핑하세요.
          </p>
        </div>
        <div className="cm-progress">
          <div className="cm-progress-stat">
            <span className="cm-progress-num">{progressPct}%</span>
            <span className="cm-progress-total">
              {doneCells} / {totalCells} 채널 매핑
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

      {/* Site category cascade (per mall) */}
      <section className="cm-cascade-card">
        <div className="cm-cascade-head">
          <h2>
            <Layers size={16} />
            사이트 카테고리 선택
          </h2>
        </div>

        {selectedMalls.size === 0 ? (
          <div className="cm-cascade-placeholder">
            먼저 위에서 쇼핑몰을 선택하세요.
          </div>
        ) : (
          <>
            {/* 선택한 몰 탭 - 각 몰의 사이트 카테고리를 개별 선택 */}
            <div className="cm-mall-tabs">
              {[...selectedMalls].map((id) => {
                const m = MALL_MAP[id];
                const done = isLeafPath(mallPaths[id]);
                return (
                  <button
                    key={id}
                    className={`cm-mall-tab ${
                      effectiveMallId === id ? "active" : ""
                    } ${done ? "done" : ""}`}
                    onClick={() => setActiveMallId(id)}
                  >
                    <span
                      className="cm-mall-badge sm"
                      style={{ background: m.color }}
                    >
                      {m.short}
                    </span>
                    {m.name}
                    {done && <Check size={13} className="cm-tab-check" />}
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
                      {node.name}
                      {node.code && <em className="cm-crumb-code">{node.code}</em>}
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className="cm-columns">
              {columns.map((col, level) => (
                <div className="cm-column" key={level}>
                  {col.map((node) => {
                    const active = activePath[level]?.id === node.id;
                    return (
                      <button
                        key={node.id}
                        className={`cm-column-item ${active ? "active" : ""}`}
                        onClick={() => handleSelect(level, node)}
                      >
                        <span className="cm-column-label">
                          {node.name}
                          {node.code && (
                            <em className="cm-column-code">{node.code}</em>
                          )}
                        </span>
                        {node.children ? (
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

            <div className="cm-cascade-actions">
              <div className="cm-apply-target">
                <span className="cm-apply-target-label">
                  적용 준비 {completedMalls.length}/{selectedMalls.size}
                </span>
                <div className="cm-apply-list">
                  {[...selectedMalls].map((id) => {
                    const m = MALL_MAP[id];
                    const path = mallPaths[id];
                    const done = isLeafPath(path);
                    return (
                      <span
                        key={id}
                        className={`cm-apply-item ${done ? "done" : ""}`}
                      >
                        <span
                          className="cm-mini-badge"
                          style={{ background: m.color }}
                        >
                          {m.short}
                        </span>
                        {done ? (
                          <span className="cm-apply-path">
                            {path!.map((n) => n.name).join(" > ")}
                          </span>
                        ) : (
                          <span className="cm-apply-path muted">미선택</span>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
              <div className="cm-cascade-buttons">
                <button className="cm-btn-ghost" onClick={resetActivePath}>
                  <RotateCcw size={14} /> 현재 몰 초기화
                </button>
                <button
                  className="cm-btn-primary"
                  disabled={!canApply}
                  onClick={handleApply}
                >
                  <Check size={14} /> {completedMalls.length}개 몰 한 번에 적용
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Product mapping table */}
      <section className="cm-table-card">
        <div className="cm-table-toolbar">
          <div className="cm-search">
            <Search size={16} className="cm-search-icon" />
            <input
              type="text"
              placeholder="상품명 또는 코드로 검색"
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

        <div className="cm-table-mall-context">
          <span
            className="cm-mini-badge"
            style={{ background: MALL_MAP[filterMallId].color }}
          >
            {MALL_MAP[filterMallId].short}
          </span>
          <strong>{MALL_MAP[filterMallId].name}</strong> 기준으로 상태를 표시하고
          있습니다. 다른 몰의 매핑 여부는 유지된 채, 몰별로 독립적으로 판단합니다.
        </div>

        <div className="cm-table-wrap">
          <table className="cm-table">
            <thead>
              <tr>
                <th style={{ width: 44 }} />
                <th>상품 코드</th>
                <th>상품명</th>
                <th>채널별 매핑 현황</th>
                <th>상태</th>
                <th>수정일</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                // 전체 진행률 배지(초록/일부/미매핑)는 참고용으로 그대로 보여주고,
                // "상태" 열은 filterMallId 몰 하나만 기준으로 독립적으로 판단한다.
                const overallStatus = getRowStatus(row);
                const mallStatus = getRowStatusForMall(row, filterMallId);
                const mappedCount = Object.keys(row.mappings).length;
                return (
                  <tr
                    key={row.id}
                    className={selectedRowId === row.id ? "selected" : ""}
                    onClick={() => setSelectedRowId(row.id)}
                  >
                    <td>
                      <span
                        className={`cm-radio ${
                          selectedRowId === row.id ? "on" : ""
                        }`}
                      />
                    </td>
                    <td className="cm-mono">{row.productCode}</td>
                    <td className="cm-strong">{row.productName}</td>
                    <td>
                      <div className="cm-mall-grid">
                        {MALLS.map((m) => {
                          const mapped = !!row.mappings[m.id];
                          const isFilterMall = m.id === filterMallId;
                          return (
                            <span
                              key={m.id}
                              className={`cm-mini-badge ${mapped ? "" : "off"} ${
                                isFilterMall ? "focus" : ""
                              }`}
                              style={mapped ? { background: m.color } : undefined}
                              title={
                                mapped
                                  ? `${m.name}: ${row.mappings[m.id].join(" > ")}`
                                  : `${m.name}: 미매핑`
                              }
                            >
                              {m.short}
                            </span>
                          );
                        })}
                        <span className="cm-mall-count">
                          {mappedCount}/{MALLS.length}
                          {overallStatus === "partial" && " · 일부"}
                        </span>
                      </div>
                    </td>
                    <td>
                      {mallStatus === "mapped" ? (
                        <span className="cm-status mapped">
                          <CircleCheck size={13} /> 매핑완료
                        </span>
                      ) : (
                        <span className="cm-status unmapped">
                          <CircleAlert size={13} /> 미매핑
                        </span>
                      )}
                    </td>
                    <td className="cm-muted">{row.updatedAt}</td>
                  </tr>
                );
              })}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="cm-empty">
                    조건에 맞는 상품이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="cm-table-footer">
          <span className="cm-muted">{filteredRows.length}개 상품 표시 중</span>
          <button className="cm-btn-primary">
            <Save size={14} /> 매핑 저장
          </button>
        </div>
      </section>
    </div>
  );
}
