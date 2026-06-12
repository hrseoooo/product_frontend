import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import AccountSettingModal from "./AccountSettingModal";

const Navigation = () => {
  const accessToken = useAuthStore((state) => state.accessToken);
  const setAccessToken = useAuthStore((state) => state.setAccessToken);
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleLogout = () => {
    setAccessToken(null);
    navigate("/");
  };

  return (
    <>
      <nav className="main-nav">
        <a href="/" className="nav-logo">
          rin
        </a>

        <div className="nav-links">
          {accessToken ? (
            <>
              <Link to="/">Products</Link>
              <Link to="/register">Add Product</Link>
              <button onClick={() => setIsModalOpen(true)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>쇼핑몰계정</button>
              <button onClick={handleLogout}>Logout</button>
            </>
          ) : (
            <>
              <Link to="/login">Login</Link>
              <Link to="/signup">Sign Up</Link>
            </>
          )}
        </div>
      </nav>
      <AccountSettingModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};

export default Navigation;
