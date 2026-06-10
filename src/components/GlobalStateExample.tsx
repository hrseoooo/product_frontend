import { useUIStore } from '../store/useUIStore';

export function GlobalStateExample() {
  const viewMode = useUIStore((state) => state.viewMode);
  const toggleViewMode = useUIStore((state) => state.toggleViewMode);

  return (
    <section className="example-card">
      <h2>전역 상태 테스트</h2>
      <p>현재 전역 뷰 모드: {viewMode}</p>
      <button type="button" onClick={toggleViewMode}>
        메인 목록 보기 모드 전환
      </button>
      <p style={{ marginTop: 12, fontSize: '0.95rem' }}>
        이 버튼을 누르면 위의 제품 목록에도 실제로 영향이 옵니다.
      </p>
    </section>
  );
}
