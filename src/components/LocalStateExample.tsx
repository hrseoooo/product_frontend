import { useState } from 'react';

const localItems = ['로컬 상품 A', '로컬 상품 B', '로컬 상품 C'];

export function LocalStateExample() {
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  return (
    <section className="example-card">
      <h2>로컬 상태 테스트</h2>
      <p>현재 로컬 뷰 모드: {viewMode}</p>
      <button type="button" onClick={() => setViewMode('list')}>
        로컬 리스트 보기
      </button>
      <button type="button" onClick={() => setViewMode('grid')}>
        로컬 그리드 보기
      </button>
      <ul className={`preview-list ${viewMode}`}>
        {localItems.map((item) => (
          <li key={item} className="preview-item">
            {item}
          </li>
        ))}
      </ul>
      <p style={{ marginTop: 12, fontSize: '0.95rem' }}>
        이 상태는 이 컴포넌트 내부에서만 작동합니다.
      </p>
    </section>
  );
}
