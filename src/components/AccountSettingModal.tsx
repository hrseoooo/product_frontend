import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import api from "../api/axios";
import "./AccountSettingModal.css";

interface AccountForm {
  mallType: string;
  accountName: string;
  sellerId: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function AccountSettingModal({ isOpen, onClose }: Props) {
  const [accounts, setAccounts] = useState([]);
  const { register, handleSubmit, reset } = useForm<AccountForm>();

  const fetchAccounts = async () => {
    try {
      const { data } = await api.get("/mall-account");
      setAccounts(data);
    } catch (err) {
      console.error("Failed to fetch accounts", err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAccounts();
    }
  }, [isOpen]);

  const onSubmit = async (data: AccountForm) => {
    try {
      await api.post("/mall-account", data);
      alert("계정이 연동되었습니다.");
      reset();
      fetchAccounts();
    } catch (error) {
      alert("연동 실패!");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="modal-close-btn">
          &times;
        </button>

        {/* 계정 등록 폼 */}
        <div className="modal-section">
          <h2 className="modal-title">새 계정 연동</h2>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="form-group">
              <label className="form-label">쇼핑몰 선택</label>
              <select {...register("mallType")} className="form-input">
                <option value="COUPANG">쿠팡</option>
                <option value="SMARTSTORE">스마트스토어</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">계정 별칭</label>
              <input
                {...register("accountName")}
                className="form-input"
                placeholder="예: 쿠팡 부계정"
              />
            </div>
            <div className="form-group">
              <label className="form-label">판매자 ID (또는 API Key)</label>
              <input {...register("sellerId")} className="form-input" />
            </div>
            <button type="submit" className="submit-btn">
              연동하기
            </button>
          </form>
        </div>

        {/* 등록된 계정 리스트 */}
        <div className="modal-section">
          <h2 className="modal-title">연동된 계정 목록</h2>
          <ul className="account-list">
            {accounts.length === 0 ? (
              <div className="empty-state">등록된 계정이 없습니다.</div>
            ) : (
              accounts.map((acc: any) => (
                <li key={acc.id} className="account-item">
                  <div className="account-info-main">
                    <span className="mall-tag">{acc.mallType}</span>
                    <span className="account-name">{acc.accountName}</span>
                  </div>
                  <div className="account-info-sub">
                    {/* <span className="account-id-label">계정 ID</span> */}
                    <span className="account-id-value">
                      {acc.sellerId || acc.loginId || "없음"}
                    </span>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
