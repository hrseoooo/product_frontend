import { useState, useEffect } from "react";
import "./ProductImageSlider.css";

interface ProductImageSliderProps {
  images: string[] | null | undefined;
}

export default function ProductImageSlider({ images }: ProductImageSliderProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    // 이미지가 2장 이상일 때만 자동 전환 타이머 설정 (3초)
    if (!images || images.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, 3000);

    return () => clearInterval(timer);
  }, [images]);

  if (!images || images.length === 0) {
    return <div className="product-image-placeholder">No Image</div>;
  }

  if (images.length === 1) {
    return (
      <div className="product-image-slider">
        <img src={images[0]} alt="product" className="slider-image active" />
      </div>
    );
  }

  return (
    <div className="product-image-slider">
      {images.map((img, index) => (
        <img
          key={index}
          src={img}
          alt={`product-${index}`}
          className={`slider-image ${index === currentIndex ? "active" : ""}`}
        />
      ))}
      
      {/* 닷 인디케이터 */}
      <div className="slider-dots">
        {images.map((_, index) => (
          <div
            key={index}
            className={`slider-dot ${index === currentIndex ? "active" : ""}`}
            onClick={() => setCurrentIndex(index)}
          />
        ))}
      </div>
    </div>
  );
}
