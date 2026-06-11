import { Link } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";

const Navigation = () => {
  const accessToken = useAuthStore((state) => state.accessToken);
  const setAccessToken = useAuthStore((state) => state.setAccessToken);

  return (
    <nav style={{ padding: "20px", background: "#eee" }}>
      <Link to="/" style={{ marginRight: "10px" }}>
        홈
      </Link>

      <Link to="/register" style={{ marginRight: "10px" }}>
        상품등록
      </Link>

      {accessToken ? (
        <>
          <Link to="/userinfo" style={{ marginRight: "10px" }}>
            내정보
          </Link>
          <button
            onClick={() => setAccessToken(null)}
            style={{ marginRight: "10px" }}
          >
            로그아웃
          </button>
        </>
      ) : (
        <>
          <Link to="/login" style={{ marginRight: "10px" }}>
            로그인
          </Link>
          <Link to="/signup" style={{ marginRight: "10px" }}>
            회원가입
          </Link>
        </>
      )}
    </nav>
  );
};

export default Navigation;
