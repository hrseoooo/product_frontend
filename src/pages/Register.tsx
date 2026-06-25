import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import Navigation from "../components/Navigation";
import { useAuthStore } from "../store/useAuthStore";
import Swal from "sweetalert2";
import api from "../api/axios";
import {
  ChevronDown,
  ChevronUp,
  ImagePlus,
  X,
  ChevronRight,
  CheckCircle2,
  Link,
  Pencil,
  RotateCcw,
} from "lucide-react";
import "froala-editor/css/froala_style.min.css";
import "froala-editor/css/froala_editor.pkgd.min.css";
import FroalaEditorModule from "react-froala-wysiwyg";

// Vite에서 CommonJS 모듈을 가져올 때 default 내부에 들어갈 수 있음
const FroalaEditorComponent =
  (FroalaEditorModule as any).default || FroalaEditorModule;
import "./Register.css";

// 품목고시 카테고리별 필요 정보
const noticeCategories = {
  의류: [
    "제품소재",
    "색상",
    "치수",
    "제조자(수입자)",
    "제조국",
    "세탁방법 및 취급시 주의사항",
    "제조연월",
    "품질보증기준",
    "A/S 책임자와 전화번호",
  ],
  가전: [
    "품명 및 모델명",
    "KC 인증 필 유무",
    "정격전압, 소비전력",
    "에너지소비효율등급",
    "출시년월",
    "제조자(수입자)",
    "제조국",
    "크기",
    "무게",
    "주요 사양",
    "품질보증기준",
    "A/S 책임자와 전화번호",
  ],
  식품: [
    "제품명",
    "식품의 유형",
    "생산자 및 소재지",
    "제조연월일, 유통기한 또는 품질유지기한",
    "포장단위별 용량(중량), 수량",
    "원재료명 및 함량",
    "영양성분",
    "유전자변형식품에 해당하는 경우의 표시",
    "소비자안전을 위한 주의사항",
    "수입식품 문구",
    "소비자상담 관련 전화번호",
  ],
  기타: [
    "품명 및 모델명",
    "인증/허가 사항",
    "제조국(원산지)",
    "제조자(수입자)",
    "소비자상담 관련 전화번호",
  ],
};

export default function Register() {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const navigate = useNavigate();

  // 아코디온 상태
  const [openSection, setOpenSection] = useState<number>(1);
  const [validationError, setValidationError] = useState<string>("");

  const toggleSection = (section: number) => {
    if (section > 1 && selectedAccounts.length === 0) {
      setValidationError(
        "1단계: 쇼핑몰 계정을 먼저 선택해야 다음 단계로 갈 수 있습니다.",
      );
      setOpenSection(1);
      return;
    }
    if (section > 2 && !getFinalCategoryId()) {
      setValidationError(
        "2단계: 표준 카테고리를 끝까지 선택해야 다음 단계로 갈 수 있습니다.",
      );
      setOpenSection(2);
      return;
    }
    setOpenSection(openSection === section ? 0 : section);
    setValidationError("");
  };

  // 가장 깊은 뎁스의 선택된 카테고리 ID 반환
  const getFinalCategoryId = () => {
    const { c1, c2, c3, c4 } = selectedCategory;
    if (c4) return c4.id;
    if (c3) return c3.id;
    if (c2) return c2.id;
    if (c1) return c1.id;
    return null;
  };

  const getSelectedCategoryPath = () => {
    const parts = [];
    if (selectedCategory.c1) parts.push(selectedCategory.c1.label);
    if (selectedCategory.c2) parts.push(selectedCategory.c2.label);
    if (selectedCategory.c3) parts.push(selectedCategory.c3.label);
    if (selectedCategory.c4) parts.push(selectedCategory.c4.label);
    return parts.join(" > ");
  };

  const isSelectionComplete = () => {
    const { c1, c2, c3, c4 } = selectedCategory;
    if (c4) return !c4.hasChildren;
    if (c3) return !c3.hasChildren;
    if (c2) return !c2.hasChildren;
    if (c1) return !c1.hasChildren;
    return false;
  };

  const nextStep = (currentStep: number) => {
    if (currentStep === 1 && selectedAccounts.length === 0) {
      setValidationError("최소 1개 이상의 쇼핑몰 계정을 선택해야 합니다.");
      return;
    }
    if (currentStep === 2 && !getFinalCategoryId()) {
      setValidationError("표준 카테고리를 선택해야 합니다.");
      return;
    }
    if (currentStep === 3 && (!basicInfo.title.trim() || !basicInfo.price)) {
      setValidationError("상품명과 판매가는 필수 입력값입니다.");
      return;
    }
    setValidationError("");
    setOpenSection(currentStep + 1);
  };

  // Step 1: 쇼핑몰 계정
  const [mallAccounts, setMallAccounts] = useState<any[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<number[]>([]);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const { data } = await api.get("/mall-account");
        setMallAccounts(data);
      } catch (err) {
        console.error("계정 목록 불러오기 실패", err);
      }
    };
    if (accessToken) fetchAccounts();
  }, [accessToken]);

  const handleAccountToggle = (id: number) => {
    setSelectedAccounts((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
    );
  };

  // Step 2: 표준 카테고리
  const [categoryTree, setCategoryTree] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState({
    c1: null as any,
    c2: null as any,
    c3: null as any,
    c4: null as any,
  });

  useEffect(() => {
    const fetchCategoryTree = async () => {
      try {
        const { data } = await api.get("/products/standard-category");
        if (data.success) {
          setCategoryTree(data.data);
        }
      } catch (err) {
        console.error("표준 카테고리 불러오기 실패", err);
      }
    };
    if (accessToken) fetchCategoryTree();
  }, [accessToken]);

  const handleCategorySelect = (level: 1 | 2 | 3 | 4, node: any) => {
    setSelectedCategory((prev) => {
      if (level === 1) return { c1: node, c2: null, c3: null, c4: null };
      if (level === 2) return { ...prev, c2: node, c3: null, c4: null };
      if (level === 3) return { ...prev, c3: node, c4: null };
      return { ...prev, c4: node };
    });
  };

  const [mappedCategories, setMappedCategories] = useState<any[]>([]);
  const [isMappingLoading, setIsMappingLoading] = useState(false);

  const fetchMappedCategories = async () => {
    const finalId = getFinalCategoryId();
    if (!finalId || selectedAccounts.length === 0) {
      setMappedCategories([]);
      return;
    }
    setIsMappingLoading(true);
    try {
      const { data } = await api.get(
        `/products/mapped-categories?pcode=${finalId}&accountIds=${selectedAccounts.join(",")}`,
      );
      setMappedCategories(data);
    } catch (error) {
      console.error("매핑 카테고리 로드 실패", error);
    } finally {
      setIsMappingLoading(false);
    }
  };

  useEffect(() => {
    if (isSelectionComplete()) {
      fetchMappedCategories();
    } else {
      setMappedCategories([]);
    }
  }, [
    selectedCategory.c1,
    selectedCategory.c2,
    selectedCategory.c3,
    selectedCategory.c4,
    selectedAccounts,
  ]);

  // 쇼핑몰 카테고리 수동 수정 (프론트엔드 상태)
  const [manualOverrides, setManualOverrides] = useState<
    Record<string, { path: string; pathArray: string[] }>
  >({});
  const [editingMapping, setEditingMapping] = useState<{
    pcode: string;
    acode: string;
    mallName: string;
    pathArray: string[];
  } | null>(null);
  const [siteCategories, setSiteCategories] = useState<Record<number, any[]>>(
    {},
  );

  const openEditModal = async (mc: any, officialName: string) => {
    // 수동 오버라이드가 있으면 그걸 쓰고, 없으면 mc.path 사용
    const override = manualOverrides[mc.acode];
    const basePath = override ? override.path : mc.path;
    const initialPath = mc.isMapped && basePath ? basePath.split(" > ") : [];

    setEditingMapping({
      pcode: getFinalCategoryId()!,
      acode: mc.acode,
      mallName: officialName,
      pathArray: initialPath,
    });

    setSiteCategories({});

    const fetchPromises = [];
    // 1차 카테고리
    fetchPromises.push(
      queryClient.fetchQuery({
        queryKey: ["siteCategories", mc.acode, 1, ""],
        queryFn: async () => {
          const res = await api.get(
            `/products/site-categories/${mc.acode}?depth=1&parentPath=`,
          );
          return res.data;
        },
        staleTime: 1000 * 60 * 30,
      }),
    );

    // 2차 이상 카테고리 (현재 매핑된 경로까지 모두 로딩)
    let currentPath: string[] = [];
    for (let i = 0; i < initialPath.length; i++) {
      currentPath.push(initialPath[i]);
      if (i + 2 <= 6) {
        const depth = i + 2;
        const parentPathStr = currentPath.join(",");
        fetchPromises.push(
          queryClient.fetchQuery({
            queryKey: ["siteCategories", mc.acode, depth, parentPathStr],
            queryFn: async () => {
              const res = await api.get(
                `/products/site-categories/${mc.acode}?depth=${depth}&parentPath=${parentPathStr}`,
              );
              return res.data;
            },
            staleTime: 1000 * 60 * 30,
          }),
        );
      }
    }

    try {
      const results = await Promise.all(fetchPromises);
      const newSiteCategories: Record<number, any[]> = {};
      results.forEach((data, index) => {
        const depth = index + 1;
        newSiteCategories[depth] = data;
      });
      setSiteCategories(newSiteCategories);
    } catch (err) {
      console.error("쇼핑몰 카테고리 초기 로드 실패", err);
    }
  };

  useEffect(() => {
    if (editingMapping) {
      setTimeout(() => {
        const selectedItems = document.querySelectorAll(
          ".category-item.selected",
        );
        selectedItems.forEach((item) => {
          item.scrollIntoView({ block: "center", behavior: "smooth" });
        });
      }, 100);
    }
  }, [editingMapping, siteCategories]);

  const fetchSiteCategoriesLazy = async (
    acode: string,
    depth: number,
    parentPath: string[],
  ) => {
    try {
      const data = await queryClient.fetchQuery({
        queryKey: ["siteCategories", acode, depth, parentPath.join(",")],
        queryFn: async () => {
          const res = await api.get(
            `/products/site-categories/${acode}?depth=${depth}&parentPath=${parentPath.join(",")}`,
          );
          return res.data;
        },
        staleTime: 1000 * 60 * 30, // 30분 캐싱
      });
      setSiteCategories((prev) => ({ ...prev, [depth]: data }));
    } catch (err) {
      console.error("쇼핑몰 카테고리 로드 실패", err);
    }
  };

  const handleSiteCategorySelect = (depth: number, node: any) => {
    if (!editingMapping) return;
    const newPath = editingMapping.pathArray.slice(0, depth - 1);
    newPath.push(node.label);

    setEditingMapping({ ...editingMapping, pathArray: newPath });

    // 하위 뎁스 초기화
    const newSiteCategories = { ...siteCategories };
    for (let i = depth + 1; i <= 6; i++) delete newSiteCategories[i];
    setSiteCategories(newSiteCategories);

    if (node.hasChildren) {
      fetchSiteCategoriesLazy(editingMapping.acode, depth + 1, newPath);
    }
  };

  const submitCategoryMapping = async () => {
    if (!editingMapping) return;
    setManualOverrides((prev) => ({
      ...prev,
      [editingMapping.acode]: {
        path: editingMapping.pathArray.join(" > "),
        pathArray: editingMapping.pathArray,
      },
    }));
    setEditingMapping(null);
  };

  const resetCategoryMapping = (acode: string) => {
    Swal.fire({
      title: "초기화하시겠습니까?",
      text: "수동 매핑을 초기화하고 자동 매핑으로 되돌립니다.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "초기화",
      cancelButtonText: "취소",
    }).then((result) => {
      if (result.isConfirmed) {
        setManualOverrides((prev) => {
          const next = { ...prev };
          delete next[acode];
          return next;
        });
        setEditingMapping(null);
      }
    });
  };

  // Step 3: 기본 정보
  const [basicInfo, setBasicInfo] = useState({
    title: "",
    price: "",
    stock: "999",
    brand: "",
    origin: "국산",
    condition: "NEW", // NEW or USED
  });

  const handleBasicInfoChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setBasicInfo({ ...basicInfo, [e.target.name]: e.target.value });
  };

  // Step 4: 이미지
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      if (images.length + newFiles.length > 10) {
        Swal.fire({
          icon: "warning",
          text: "이미지는 최대 10장까지만 업로드 가능합니다.",
        });
        return;
      }
      const updatedFiles = [...images, ...newFiles];
      setImages(updatedFiles);

      const updatedPreviews = updatedFiles.map((file) =>
        URL.createObjectURL(file),
      );
      setImagePreviews(updatedPreviews);
    }
  };

  const removeImage = (index: number) => {
    const updatedFiles = [...images];
    updatedFiles.splice(index, 1);
    setImages(updatedFiles);

    const updatedPreviews = [...imagePreviews];
    URL.revokeObjectURL(updatedPreviews[index]); // 메모리 누수 방지
    updatedPreviews.splice(index, 1);
    setImagePreviews(updatedPreviews);
  };

  // Step 5: 상세 설명 (Froala)
  const [description, setDescription] = useState("");

  // Step 6: 품목고시 정보
  const [noticeCategory, setNoticeCategory] =
    useState<keyof typeof noticeCategories>("의류");
  const [noticeData, setNoticeData] = useState<Record<string, string>>({});

  useEffect(() => {
    // 카테고리 변경 시 초기화
    const initialData: Record<string, string> = {};
    noticeCategories[noticeCategory].forEach((key) => {
      initialData[key] = "상품 상세설명 참조"; // 기본값
    });
    setNoticeData(initialData);
  }, [noticeCategory]);

  const handleNoticeChange = (key: string, value: string) => {
    setNoticeData({ ...noticeData, [key]: value });
  };

  // 제출 핸들러
  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      const response = await fetch("http://localhost:1111/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Network response was not ok");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      Swal.fire({
        title: "등록 완료",
        text: "상품이 성공적으로 등록되었습니다.",
        icon: "success",
        confirmButtonColor: "#3b82f6",
      }).then(() => {
        navigate("/");
      });
    },
    onError: () => {
      Swal.fire({
        title: "등록 실패",
        text: "상품 등록 중 오류가 발생했습니다.",
        icon: "error",
      });
    },
  });

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!getFinalCategoryId()) {
      Swal.fire({ icon: "warning", text: "표준 카테고리를 선택해주세요." });
      setOpenSection(2);
      return;
    }
    if (!basicInfo.title || !basicInfo.price) {
      Swal.fire({ icon: "warning", text: "상품명과 가격을 입력해주세요." });
      setOpenSection(3);
      return;
    }

    const base64Images = await Promise.all(images.map(fileToBase64));

    const payload = {
      title: basicInfo.title,
      price: Number(basicInfo.price),
      description: description,
      stock: Number(basicInfo.stock),
      brand: basicInfo.brand,
      origin: basicInfo.origin,
      condition: basicInfo.condition,
      noticeCategory: noticeCategory,
      noticeData: noticeData,
      mallAccounts: selectedAccounts,
      images: base64Images,
      standardCategoryId: getFinalCategoryId(),
    };

    mutation.mutate(payload);
  };

  return (
    <div className="app-container" style={{ background: "#f8fafc" }}>
      <Navigation />

      <div className="register-container">
        <div className="register-header">
          <h1 className="register-title">상품 등록</h1>
          <p className="register-subtitle">
            통합 상품 정보를 입력하고 다수의 쇼핑몰에 한 번에 배포하세요.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="register-form">
          {/* Step 1: 쇼핑몰 계정 선택 */}
          <div
            className={`accordion-item ${openSection === 1 ? "active" : ""}`}
          >
            <button
              type="button"
              className="accordion-header"
              onClick={() => toggleSection(1)}
            >
              <div className="accordion-title">
                <span className="step-number">1</span>
                쇼핑몰 계정 선택
              </div>
              {openSection === 1 ? (
                <ChevronUp size={20} color="#94a3b8" />
              ) : (
                <ChevronDown size={20} color="#94a3b8" />
              )}
            </button>
            {openSection === 1 && (
              <div className="accordion-body">
                <p className="section-desc">
                  상품을 등록할 쇼핑몰 계정을 모두 선택해주세요.
                </p>
                {mallAccounts.length === 0 ? (
                  <div className="empty-message">
                    등록된 연동 계정이 없습니다. 헤더의 '쇼핑몰계정'에서 먼저
                    추가해주세요.
                  </div>
                ) : (
                  <div className="account-grid">
                    {mallAccounts.map((acc) => (
                      <label
                        key={acc.id}
                        className={`account-card ${selectedAccounts.includes(acc.id) ? "selected" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedAccounts.includes(acc.id)}
                          onChange={() => handleAccountToggle(acc.id)}
                          className="hidden-checkbox"
                        />
                        <div className="acc-type">{acc.mallType}</div>
                        <div className="acc-name">{acc.accountName}</div>
                      </label>
                    ))}
                  </div>
                )}
                <div className="next-step-container">
                  {validationError && openSection === 1 && (
                    <div className="validation-error">{validationError}</div>
                  )}
                  <button
                    type="button"
                    className="next-step-btn"
                    onClick={() => nextStep(1)}
                  >
                    다음 단계로
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Step 2: 표준 카테고리 선택 */}
          <div
            className={`accordion-item ${openSection === 2 ? "active" : ""}`}
          >
            <button
              type="button"
              className="accordion-header"
              onClick={() => toggleSection(2)}
            >
              <div className="accordion-title">
                <span className="step-number">2</span>
                표준 카테고리 선택
              </div>
              {openSection === 2 ? (
                <ChevronUp size={20} color="#94a3b8" />
              ) : (
                <ChevronDown size={20} color="#94a3b8" />
              )}
            </button>
            {openSection === 2 && (
              <div className="accordion-body">
                <p className="section-desc">
                  상품에 맞는 표준 카테고리를 끝까지 선택해주세요.
                </p>
                <div className="category-selector-container">
                  {/* 대분류 (1차) */}
                  <div className="category-column">
                    <div className="category-column-header">대분류</div>
                    <div className="category-list">
                      {categoryTree.map((node) => (
                        <button
                          key={node.id}
                          type="button"
                          className={`category-item ${selectedCategory.c1?.id === node.id ? "selected" : ""}`}
                          onClick={() => handleCategorySelect(1, node)}
                        >
                          <span>{node.label}</span>
                          <ChevronRight className="category-item-chevron" />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 중분류 (2차) */}
                  {selectedCategory.c1 &&
                    selectedCategory.c1.children.length > 0 && (
                      <div className="category-column">
                        <div className="category-column-header">중분류</div>
                        <div className="category-list">
                          {selectedCategory.c1.children.map((node: any) => (
                            <button
                              key={node.id}
                              type="button"
                              className={`category-item ${selectedCategory.c2?.id === node.id ? "selected" : ""}`}
                              onClick={() => handleCategorySelect(2, node)}
                            >
                              <span>{node.label}</span>
                              <ChevronRight className="category-item-chevron" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* 소분류 (3차) */}
                  {selectedCategory.c2 &&
                    selectedCategory.c2.children.length > 0 && (
                      <div className="category-column">
                        <div className="category-column-header">소분류</div>
                        <div className="category-list">
                          {selectedCategory.c2.children.map((node: any) => (
                            <button
                              key={node.id}
                              type="button"
                              className={`category-item ${selectedCategory.c3?.id === node.id ? "selected" : ""}`}
                              onClick={() => handleCategorySelect(3, node)}
                            >
                              <span>{node.label}</span>
                              {node.children && node.children.length > 0 && (
                                <ChevronRight className="category-item-chevron" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* 세세분류 (4차) */}
                  {selectedCategory.c3 &&
                    selectedCategory.c3.children &&
                    selectedCategory.c3.children.length > 0 && (
                      <div className="category-column">
                        <div className="category-column-header">세분류</div>
                        <div className="category-list">
                          {selectedCategory.c3.children.map((node: any) => (
                            <button
                              key={node.id}
                              type="button"
                              className={`category-item ${selectedCategory.c4?.id === node.id ? "selected" : ""}`}
                              onClick={() => handleCategorySelect(4, node)}
                            >
                              <span>{node.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                </div>

                {getFinalCategoryId() && (
                  <div className="selected-category-box">
                    <div className="selected-category-title">
                      <CheckCircle2 size={16} className="title-icon" />
                      선택된 표준 카테고리
                    </div>
                    <div className="selected-category-path">
                      {getSelectedCategoryPath()}{" "}
                      <span className="selected-category-id">
                        (ID: {getFinalCategoryId()})
                      </span>
                    </div>

                    {/* 슬레이브 카테고리 영역 */}
                    {isSelectionComplete() && (
                      <div className="slave-categories-section">
                        <div className="slave-categories-header">
                          <Link size={16} className="title-icon" />
                          연동된 쇼핑몰 카테고리
                        </div>
                        {isMappingLoading ? (
                          <div className="slave-loading">로딩 중...</div>
                        ) : mappedCategories.length > 0 ? (
                          <div className="slave-list">
                            {mappedCategories.map((mc, idx) => {
                              const mallNameMap: Record<string, string> = {
                                COUPANG: "쿠팡",
                                SMARTSTORE: "스마트스토어",
                                "11ST": "11번가",
                                CAFE24: "카페24",
                              };
                              const mallIconMap: Record<string, string> = {
                                COUPANG: "/assets/coupang.png",
                                SMARTSTORE: "/assets/smartstore.png",
                                "11ST": "/assets/11st.png",
                                CAFE24: "/assets/cafe24.png",
                              };
                              const officialName =
                                mallNameMap[mc.mallType] || mc.mallType;
                              const iconUrl = mallIconMap[mc.mallType] || null;

                              // 로컬 수동 상태 반영
                              const override = manualOverrides[mc.acode];
                              const isManual = !!override;
                              const currentPath = override
                                ? override.path
                                : mc.path;
                              const isCurrentlyMapped =
                                mc.isMapped || !!currentPath;

                              return (
                                <div key={idx} className="slave-card">
                                  <div
                                    className="slave-badge-wrapper"
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      marginRight: "16px"
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '210px', flexShrink: 0 }}>
                                      {iconUrl && (
                                        <img
                                          src={iconUrl}
                                          alt={officialName}
                                          style={{
                                            width: "32px",
                                            height: "32px",
                                            borderRadius: "50%",
                                            objectFit: "cover",
                                            border: "1px solid #e2e8f0"
                                          }}
                                        />
                                      )}
                                      <strong style={{ fontSize: '15px', color: '#1e293b', whiteSpace: 'nowrap' }}>
                                        {officialName}
                                      </strong>
                                      <span style={{ fontSize: '13px', color: '#64748b', whiteSpace: 'nowrap' }}>
                                        ({mc.accountName})
                                      </span>
                                    </div>
                                    <div style={{ width: '1px', height: '32px', backgroundColor: '#e2e8f0' }} />
                                  </div>
                                  {isCurrentlyMapped ? (
                                    <div className="slave-path">
                                      {currentPath}
                                    </div>
                                  ) : (
                                    <div className="slave-error">
                                      {officialName}에 매핑된 카테고리가
                                      존재하지 않습니다.
                                    </div>
                                  )}
                                  {isCurrentlyMapped && (
                                    <div
                                      className={`mapping-type-badge ${isManual ? "manual" : "auto"}`}
                                    >
                                      {isManual ? "수동" : "자동"}
                                    </div>
                                  )}
                                  <button
                                    type="button"
                                    className="slave-edit-btn"
                                    onClick={() =>
                                      openEditModal(
                                        {
                                          ...mc,
                                          isMapped: isCurrentlyMapped,
                                          path: currentPath,
                                        },
                                        officialName,
                                      )
                                    }
                                    title="쇼핑몰 카테고리 수동 수정"
                                  >
                                    <Pencil size={14} />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                )}

                {/* 쇼핑몰 카테고리 수정 모달 */}
                {editingMapping && (
                  <div className="modal-overlay">
                    <div className="category-modal">
                      <div className="modal-header">
                        <h3>[{editingMapping.mallName}] 카테고리 수동 매핑</h3>
                        <button
                          type="button"
                          onClick={() => setEditingMapping(null)}
                          className="modal-close-btn"
                        >
                          <X size={24} />
                        </button>
                      </div>
                      <div className="modal-body">
                        <p className="modal-desc">
                          해당 쇼핑몰에서 사용할 정확한 카테고리를 끝까지
                          선택해주세요.
                        </p>

                        <div className="category-selector-container">
                          {[1, 2, 3, 4, 5, 6, 7].map((depth) => {
                            const nodes = siteCategories[depth];
                            if (!nodes || nodes.length === 0) return null;

                            return (
                              <div key={depth} className="category-column">
                                <div className="category-column-header">
                                  {depth}차 분류
                                </div>
                                <div className="category-list">
                                  {nodes.map((node) => (
                                    <button
                                      key={node.id}
                                      type="button"
                                      className={`category-item ${editingMapping.pathArray[depth - 1] === node.label ? "selected" : ""}`}
                                      onClick={() =>
                                        handleSiteCategorySelect(depth, node)
                                      }
                                    >
                                      <span>{node.label}</span>
                                      {node.hasChildren && (
                                        <ChevronRight className="category-item-chevron" />
                                      )}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div
                          className="modal-selected-path"
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <div>
                            <strong>선택한 경로:</strong>{" "}
                            {editingMapping.pathArray.join(" > ") || "없음"}
                          </div>
                          {manualOverrides[editingMapping.acode] && (
                            <button
                              type="button"
                              className="slave-reset-btn"
                              onClick={() => {
                                resetCategoryMapping(editingMapping.acode);
                              }}
                              title="수동 매핑 초기화"
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                                padding: "4px 8px",
                                border: "1px solid #e2e8f0",
                                borderRadius: "4px",
                                background: "#fff",
                                color: "#64748b",
                                cursor: "pointer",
                              }}
                            >
                              <RotateCcw size={14} />
                              <span style={{ fontSize: "12px" }}>초기화</span>
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="modal-footer">
                        <button
                          type="button"
                          className="btn-cancel"
                          onClick={() => setEditingMapping(null)}
                        >
                          취소
                        </button>
                        <button
                          type="button"
                          className="btn-confirm"
                          onClick={submitCategoryMapping}
                          disabled={editingMapping.pathArray.length === 0}
                        >
                          확인
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="next-step-container">
                  {validationError && openSection === 2 && (
                    <div className="validation-error">{validationError}</div>
                  )}
                  <button
                    type="button"
                    className="next-step-btn"
                    onClick={() => nextStep(2)}
                  >
                    다음 단계로
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Step 3: 기본 및 판매 정보 */}
          <div
            className={`accordion-item ${openSection === 3 ? "active" : ""}`}
          >
            <button
              type="button"
              className="accordion-header"
              onClick={() => toggleSection(3)}
            >
              <div className="accordion-title">
                <span className="step-number">3</span>
                기본 및 판매 정보
              </div>
              {openSection === 3 ? (
                <ChevronUp size={20} color="#94a3b8" />
              ) : (
                <ChevronDown size={20} color="#94a3b8" />
              )}
            </button>
            {openSection === 3 && (
              <div className="accordion-body">
                <div className="form-grid">
                  <div className="form-group full-width">
                    <label>
                      상품명 <span className="req">*</span>
                    </label>
                    <input
                      type="text"
                      name="title"
                      value={basicInfo.title}
                      onChange={handleBasicInfoChange}
                      placeholder="예: 무지 라운드 반팔 티셔츠"
                    />
                  </div>
                  <div className="form-group">
                    <label>
                      판매가 (원) <span className="req">*</span>
                    </label>
                    <input
                      type="number"
                      name="price"
                      value={basicInfo.price}
                      onChange={handleBasicInfoChange}
                      placeholder="10000"
                    />
                  </div>
                  <div className="form-group">
                    <label>재고수량</label>
                    <input
                      type="number"
                      name="stock"
                      value={basicInfo.stock}
                      onChange={handleBasicInfoChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>브랜드/제조사</label>
                    <input
                      type="text"
                      name="brand"
                      value={basicInfo.brand}
                      onChange={handleBasicInfoChange}
                      placeholder="자체제작"
                    />
                  </div>
                  <div className="form-group">
                    <label>원산지</label>
                    <input
                      type="text"
                      name="origin"
                      value={basicInfo.origin}
                      onChange={handleBasicInfoChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>상품 상태</label>
                    <select
                      name="condition"
                      value={basicInfo.condition}
                      onChange={handleBasicInfoChange}
                    >
                      <option value="NEW">새상품</option>
                      <option value="USED">중고상품</option>
                    </select>
                  </div>
                </div>
                <div className="next-step-container">
                  {validationError && openSection === 3 && (
                    <div className="validation-error">{validationError}</div>
                  )}
                  <button
                    type="button"
                    className="next-step-btn"
                    onClick={() => nextStep(3)}
                  >
                    다음 단계로
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Step 4: 이미지 등록 */}
          <div
            className={`accordion-item ${openSection === 4 ? "active" : ""}`}
          >
            <button
              type="button"
              className="accordion-header"
              onClick={() => toggleSection(4)}
            >
              <div className="accordion-title">
                <span className="step-number">4</span>
                이미지 등록 ({images.length}/10)
              </div>
              {openSection === 4 ? (
                <ChevronUp size={20} color="#94a3b8" />
              ) : (
                <ChevronDown size={20} color="#94a3b8" />
              )}
            </button>
            {openSection === 4 && (
              <div className="accordion-body">
                <p className="section-desc">
                  대표 이미지 1장과 부가 이미지 최대 9장을 등록할 수 있습니다.
                </p>
                <div className="image-uploader-grid">
                  <label className="image-upload-box">
                    <ImagePlus size={32} color="#94a3b8" />
                    <span>이미지 추가</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleImageUpload}
                      style={{ display: "none" }}
                    />
                  </label>

                  {imagePreviews.map((preview, idx) => (
                    <div key={idx} className="image-preview">
                      <img src={preview} alt={`preview ${idx}`} />
                      {idx === 0 && <span className="main-badge">대표</span>}
                      <button
                        type="button"
                        className="remove-btn"
                        onClick={() => removeImage(idx)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="next-step-container">
                  <button
                    type="button"
                    className="next-step-btn"
                    onClick={() => nextStep(4)}
                  >
                    다음 단계로
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Step 5: 상세 설명 (Froala Editor) */}
          <div
            className={`accordion-item ${openSection === 5 ? "active" : ""}`}
          >
            <button
              type="button"
              className="accordion-header"
              onClick={() => toggleSection(5)}
            >
              <div className="accordion-title">
                <span className="step-number">5</span>
                상세 설명
              </div>
              {openSection === 5 ? (
                <ChevronUp size={20} color="#94a3b8" />
              ) : (
                <ChevronDown size={20} color="#94a3b8" />
              )}
            </button>
            {openSection === 5 && (
              <div className="accordion-body editor-body">
                <p className="section-desc">
                  상품에 대한 상세한 설명을 작성해주세요. 에디터에서 자유롭게
                  텍스트를 꾸밀 수 있습니다.
                </p>
                <FroalaEditorComponent
                  tag="textarea"
                  model={description}
                  onModelChange={setDescription}
                  config={{
                    placeholderText:
                      "상품의 특징, 사이즈, 유의사항 등을 자유롭게 작성하세요...",
                    heightMin: 300,
                    toolbarButtons: [
                      "bold",
                      "italic",
                      "underline",
                      "strikeThrough",
                      "|",
                      "formatOL",
                      "formatUL",
                      "|",
                      "insertImage",
                      "insertTable",
                      "insertLink",
                      "|",
                      "html",
                    ],
                    quickInsertEnabled: false,
                  }}
                />
                <div className="next-step-container">
                  <button
                    type="button"
                    className="next-step-btn"
                    onClick={() => nextStep(5)}
                  >
                    다음 단계로
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Step 6: 품목고시정보 */}
          <div
            className={`accordion-item ${openSection === 6 ? "active" : ""}`}
          >
            <button
              type="button"
              className="accordion-header"
              onClick={() => toggleSection(6)}
            >
              <div className="accordion-title">
                <span className="step-number">6</span>
                품목고시정보
              </div>
              {openSection === 6 ? (
                <ChevronUp size={20} color="#94a3b8" />
              ) : (
                <ChevronDown size={20} color="#94a3b8" />
              )}
            </button>
            {openSection === 6 && (
              <div className="accordion-body">
                <div
                  className="form-group"
                  style={{ maxWidth: "300px", marginBottom: "24px" }}
                >
                  <label>상품군 선택</label>
                  <select
                    value={noticeCategory}
                    onChange={(e) =>
                      setNoticeCategory(
                        e.target.value as keyof typeof noticeCategories,
                      )
                    }
                  >
                    {Object.keys(noticeCategories).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="notice-grid">
                  {noticeCategories[noticeCategory].map((key) => (
                    <div className="notice-item" key={key}>
                      <div className="notice-key">{key}</div>
                      <input
                        type="text"
                        value={noticeData[key] || ""}
                        onChange={(e) =>
                          handleNoticeChange(key, e.target.value)
                        }
                        className="notice-value"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="register-actions">
            <button type="submit" className="submit-action-btn">
              상품 일괄 등록하기
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
