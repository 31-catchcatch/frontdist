// review-write.js — U-REVIEW-001 리뷰 작성
// POST /api/v1/products/{productId}/reviews
// 받는 파라미터: ?orderDetailId=주문상세ID&productId=상품ID (orders.html에서 전달)

document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  if (!window.CatchAuth || !CatchAuth.requireLogin()) return;

  const API_BASE = (window.CATCHCATCH_API_BASE_URL || "/api/v1").replace(/\/$/, "");

  const params = new URLSearchParams(location.search);
  const orderDetailId = params.get("orderDetailId");
  const productId = params.get("productId");

  const $ = (sel) => document.querySelector(sel);
  const won = (n) => Number(n || 0).toLocaleString("ko-KR") + "원";

  const form = $("#reviewForm");

  if (!orderDetailId || !productId) {
    alert("리뷰를 작성할 주문 정보를 찾을 수 없습니다. 주문 내역에서 다시 시도해 주세요.");
    location.href = "orders.html";
    return;
  }

  let rating = 0;
  let photo = null; // { file, url } 최대 1장 (백엔드가 imageUrl 1개만 지원)

  const MIN_LENGTH = 10;

  const STAR_TEXT = {
    1: "별로예요",
    2: "그저 그래요",
    3: "보통이에요",
    4: "맘에 들어요",
    5: "최고예요!",
  };

  function getAccessToken() {
    return sessionStorage.getItem("catchcatch.accessToken") || localStorage.getItem("catchcatch.accessToken");
  }

  async function apiFetch(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (!(options.body instanceof FormData)) headers.set("Accept", "application/json");
    if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);

    const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;
    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.message || "요청을 처리하지 못했습니다.");
    }
    return payload?.data ?? payload;
  }

  // ===== 1. 대상 상품 정보 조회 =====
  async function loadProduct() {
    try {
      const product = await apiFetch(`/products/${encodeURIComponent(productId)}`);
      $('[data-role="product-image"]').src = (product.imageUrls && product.imageUrls[0]) || "";
      $('[data-role="product-brand"]').textContent = product.sellerName || "";
      $('[data-role="product-name"]').textContent = product.name || "";
      $('[data-role="product-option"]').textContent = won(product.finalPrice ?? product.price);
    } catch (error) {
      $('[data-role="product-name"]').textContent = "상품 정보를 불러오지 못했습니다.";
    }
  }
  loadProduct();

  // ===== 2. 별점 =====
  const starBox = $('[data-role="star-rating"]');
  const starText = $('[data-role="star-text"]');

  starBox.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-star]");
    if (!btn) return;

    rating = Number(btn.dataset.star);

    starBox.querySelectorAll("button").forEach((b) => {
      b.classList.toggle("is-on", Number(b.dataset.star) <= rating);
    });

    starText.textContent = STAR_TEXT[rating];
    starText.classList.add("is-selected");
  });

  // ===== 3. 글자수 카운트 =====
  const bodyInput = $("#reviewBody");
  const charNow = $('[data-role="char-now"]');

  bodyInput.addEventListener("input", () => {
    charNow.textContent = bodyInput.value.length;
  });

  // ===== 4. 사진 첨부 (최대 1장, 백엔드가 imageUrl 1개만 지원) =====
  const photoInput = $('[data-role="photo-input"]');
  const photoList = $('[data-role="photo-list"]');
  const photoAdd = $('[data-role="photo-add"]');

  photoInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    photoInput.value = "";
    if (!file) return;

    if (photo) URL.revokeObjectURL(photo.url);
    photo = { file, url: URL.createObjectURL(file) };
    renderPhotos();
  });

  function renderPhotos() {
    photoList.innerHTML = photo
      ? `<div class="photo-item"><img src="${photo.url}" alt="첨부 사진"><button type="button" data-photo-remove aria-label="사진 삭제">✕</button></div>`
      : "";
    photoAdd.hidden = Boolean(photo);
  }

  photoList.addEventListener("click", (e) => {
    if (!e.target.closest("[data-photo-remove]")) return;
    URL.revokeObjectURL(photo.url);
    photo = null;
    renderPhotos();
  });

  // ===== 5. 취소 =====
  $('[data-action="cancel"]').addEventListener("click", () => {
    if (confirm("작성 중인 내용이 사라집니다. 취소할까요?")) {
      location.href = "orders.html";
    }
  });

  // ===== 6. 등록 (U-REVIEW-001) =====
  const submitButton = $(".btn-submit");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (rating === 0) {
      alert("별점을 선택해 주세요.");
      return;
    }

    const body = bodyInput.value.trim();
    if (body.length < MIN_LENGTH) {
      alert(`리뷰 내용을 최소 ${MIN_LENGTH}자 이상 작성해 주세요.`);
      bodyInput.focus();
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "등록 중...";

    try {
      let imageUrl = null;
      if (photo) {
        const formData = new FormData();
        formData.append("file", photo.file);
        const uploaded = await apiFetch("/files/upload", { method: "POST", body: formData });
        imageUrl = uploaded.fileUrl;
      }

      await apiFetch(`/products/${encodeURIComponent(productId)}/reviews`, {
        method: "POST",
        body: JSON.stringify({
          orderDetailId: Number(orderDetailId),
          rating,
          content: body,
          imageUrl,
        }),
      });

      alert("리뷰가 등록되었습니다. 감사합니다!");
      location.href = "orders.html";
    } catch (error) {
      alert(error.message || "리뷰 등록에 실패했습니다.");
      submitButton.disabled = false;
      submitButton.textContent = "등록하기";
    }
  });
});
