document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  if (!window.CatchAuth || !CatchAuth.requireLogin()) return;

  const API_BASE = (window.CATCHCATCH_API_BASE_URL || "/api/v1").replace(/\/$/, "");

  const params = new URLSearchParams(location.search);
  const isEdit = params.get("edit") === "true";
  const reviewId = params.get("reviewId");
  const orderDetailId = params.get("orderDetailId");
  let productId = params.get("productId");

  const $ = (sel) => document.querySelector(sel);
  const won = (n) => Number(n || 0).toLocaleString("ko-KR") + "원";

  const form = $("#reviewForm");
  const submitButton = $(".btn-submit");


  if (isEdit) {
    if (!reviewId) {
      alert("수정할 리뷰 정보를 찾을 수 없습니다.");
      location.href = "my-reviews.html";
      return;
    }
  } else {
    if (!orderDetailId || !productId) {
      alert("리뷰를 작성할 주문 정보를 찾을 수 없습니다. 주문 내역에서 다시 시도해 주세요.");
      location.href = "orders.html";
      return;
    }
  }

  const MIN_LENGTH = 10;

  const STAR_TEXT = {
    1: "별로예요",
    2: "그저 그래요",
    3: "보통이에요",
    4: "맘에 들어요",
    5: "최고예요!",
  };

  let rating = 0;
  let photo = null;
  let existingImageUrl = null;

  async function apiFetch(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (!(options.body instanceof FormData)) headers.set("Accept", "application/json");
    if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");

    const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;
    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.message || "요청을 처리하지 못했습니다.");
    }
    return payload?.data ?? payload;
  }


  async function loadProduct() {
    if (!productId) return;
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


  const starBox = $('[data-role="star-rating"]');
  const starText = $('[data-role="star-text"]');


  function setRating(n) {
    rating = n;
    starBox.querySelectorAll("button").forEach((b) => {
      b.classList.toggle("is-on", Number(b.dataset.star) <= rating);
    });
    if (rating > 0) {
      starText.textContent = STAR_TEXT[rating];
      starText.classList.add("is-selected");
    }
  }

  starBox.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-star]");
    if (!btn) return;
    setRating(Number(btn.dataset.star));
  });


  const bodyInput = $("#reviewBody");
  const charNow = $('[data-role="char-now"]');

  bodyInput.addEventListener("input", () => {
    charNow.textContent = bodyInput.value.length;
  });

  const photoInput = $('[data-role="photo-input"]');
  const photoList = $('[data-role="photo-list"]');
  const photoAdd = $('[data-role="photo-add"]');


  function currentPhotoUrl() {
    return photo ? photo.url : existingImageUrl;
  }

  photoInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    photoInput.value = "";
    if (!file) return;

    if (photo) URL.revokeObjectURL(photo.url);
    photo = { file, url: URL.createObjectURL(file) };
    existingImageUrl = null;
    renderPhotos();
  });

  function renderPhotos() {
    const url = currentPhotoUrl();
    photoList.innerHTML = url
      ? `<div class="photo-item"><img src="${SafeUrl(url)}" alt="첨부 사진"><button type="button" data-photo-remove aria-label="사진 삭제">✕</button></div>`
      : "";
    photoAdd.hidden = Boolean(url);
  }

  photoList.addEventListener("click", (e) => {
    if (!e.target.closest("[data-photo-remove]")) return;
    if (photo) URL.revokeObjectURL(photo.url);
    photo = null;
    existingImageUrl = null;
    renderPhotos();
  });


  $('[data-action="cancel"]').addEventListener("click", () => {
    if (confirm("작성 중인 내용이 사라집니다. 취소할까요?")) {
      location.href = isEdit ? "my-reviews.html" : "orders.html";
    }
  });


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
    submitButton.textContent = isEdit ? "수정 중..." : "등록 중...";

    try {

      let imageUrl = existingImageUrl;
      if (photo) {
        const formData = new FormData();
        formData.append("file", photo.file);
        const uploaded = await apiFetch("/files/upload", { method: "POST", body: formData });
        imageUrl = uploaded.fileUrl;
      }

      if (isEdit) {
        await apiFetch(`/reviews/${encodeURIComponent(reviewId)}`, {
          method: "PUT",
          body: JSON.stringify({ rating, content: body, imageUrl }),
        });
        sessionStorage.removeItem("catchcatch.editReview");
        alert("리뷰가 수정되었습니다.");
        location.href = "my-reviews.html";
      } else {
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
      }
    } catch (error) {
      alert(error.message || (isEdit ? "리뷰 수정에 실패했습니다." : "리뷰 등록에 실패했습니다."));
      submitButton.disabled = false;
      submitButton.textContent = isEdit ? "수정하기" : "등록하기";
    }
  });


  async function loadReviewForEdit() {
    let review = null;
    try {
      const raw = sessionStorage.getItem("catchcatch.editReview");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && String(parsed.reviewId) === String(reviewId)) review = parsed;
      }
    } catch (_) {  }


    if (!review) {
      try {
        const data = await apiFetch(`/users/me/reviews?page=0&size=200`);
        const list = (data && data.content) || [];
        review = list.find((r) => String(r.reviewId) === String(reviewId)) || null;
      } catch (_) {  }
    }

    if (!review) {
      alert("수정할 리뷰를 불러오지 못했습니다. 목록에서 다시 시도해 주세요.");
      location.href = "my-reviews.html";
      return;
    }

    productId = review.productId;


    setRating(Number(review.rating) || 0);
    bodyInput.value = review.content || "";
    charNow.textContent = bodyInput.value.length;
    if (review.imageUrl) existingImageUrl = review.imageUrl;
    renderPhotos();

    await loadProduct();
  }


  if (isEdit) {
    document.title = "리뷰 수정 — 캐치캐치";
    const heading = document.querySelector(".review-head h3");
    if (heading) heading.textContent = "리뷰 수정";
    submitButton.textContent = "수정하기";
    loadReviewForEdit();
  } else {
    loadProduct();
  }
});
