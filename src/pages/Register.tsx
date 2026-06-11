import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Product } from "../App";
import type { FormEvent } from "react";
import Navigation from "../components/Navigation";
import { useAuthStore } from "../store/useAuthStore";

const Register = () => {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);

  const mutation = useMutation({
    mutationFn: async (newProduct: Omit<Product, "id" | "createdAt">) => {
      const response = await fetch("http://localhost:1111/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`, // 토큰을 헤더에 포함
          // Authorization : 'Bearer' + accessToken
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
    <>
      <Navigation />
      <form className="product-form" onSubmit={handleSubmit}>
        <h2>상품 생성</h2>
        <input name="title" placeholder="상품명" required />
        <input name="price" type="number" placeholder="가격" required />
        <textarea name="description" placeholder="설명" required />
        <button type="submit">상품 생성</button>
      </form>
    </>
  );
};

export default Register;
