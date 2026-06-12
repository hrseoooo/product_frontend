import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Product } from "../App";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from "../components/Navigation";
import { useAuthStore } from "../store/useAuthStore";
import Swal from "sweetalert2";

const Register = () => {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: async (newProduct: Omit<Product, "id">) => {
      const response = await fetch("http://localhost:1111/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(newProduct),
      });
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["products"],
      });
      Swal.fire({
        title: "PRODUCT ADDED",
        text: "상품이 성공적으로 등록되었습니다.",
        customClass: {
          popup: "minimal-swal",
          confirmButton: "minimal-confirm",
        },
        buttonsStyling: false,
      }).then(() => {
        navigate("/");
      });
    },
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newProduct = {
      title: formData.get("title") as string,
      price: Number(formData.get("price")),
      description: formData.get("description") as string,
    };
    mutation.mutate(newProduct);
  };

  return (
    <div className="app-container">
      <Navigation />

      <div className="auth-container">
        <h2 className="auth-title">Add Product</h2>

        <form className="auth-form" onSubmit={handleSubmit}>
          <input name="title" placeholder="PRODUCT NAME" required />
          <input
            name="price"
            type="number"
            placeholder="PRICE (KRW)"
            required
          />
          <textarea
            name="description"
            placeholder="DESCRIPTION"
            rows={5}
            required
          />
          <button type="submit">REGISTER</button>
        </form>
      </div>
    </div>
  );
};

export default Register;
