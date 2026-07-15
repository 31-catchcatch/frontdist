// review-write.js — 리뷰 작성 페이지 mock 스크립트
// U-REVIEW-001 → POST /api/v1/products/{productId}/reviews
// 받는 파라미터: ?orderId=주문번호
// 로그인 필요 페이지

document.addEventListener("DOMContentLoaded", () => {

  // ===== 로그인 안 했으면 로그인 페이지로 =====
  if (!CatchAuth.requireLogin()) return;

  const params = new URLSearchParams(location.search);
  const orderId = params.get("orderId") || "20260714-0001";

  // ===== 가짜 주문 상품 정보 =====
  // TODO: GET /api/v1/orders/{orderId} 로 리뷰 대상 상품 정보 조회
  //   ※ 구매확정된 주문인지 백엔드에서 검증 필요
  const orderProduct = {
    orderId: orderId,
    productId: 1,
    brand: "캐치베이직",
    name: "오버핏 울 블렌드 싱글 코트",
    size: "M",
    price: 89600,
    image: "https://placehold.co/300x400/e8e8e8/999?text=COAT",
  };

  const $ = (sel) => document.querySelector(sel);
  const won = (n) => n.toLocaleString("ko-KR") + "원";

  let rating = 0;
  let sizeFit = null;
  let photos = [];

  const MAX_PHOTOS = 5;
  const MIN_LENGTH = 10;

  const STAR_TEXT = {
    1: "별로예요",
    2: "그저 그래요",
    3: "보통이에요",
    4: "맘에 들어요",
    5: "최고예요!",
  };

  // ===== 1. 상품 정보 채우기 =====
  $('[data-role="product-image"]').src = orderProduct.image;
  $('[data-role="product-brand"]').textContent = orderProduct.brand;
  $('[data-role="product-name"]').textContent = orderProduct.name;
  $('[data-role="product-option"]').textContent =
    `사이즈 ${orderProduct.size} · ${won(orderProduct.price)}`;

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

  // ===== 3. 사이즈 평가 =====
  const fitBox = $('[data-role="size-fit"]');

  fitBox.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-fit]");
    if (!btn) return;

    sizeFit = btn.dataset.fit;
    fitBox.querySelectorAll("button").forEach((b) => {
      b.classList.toggle("is-selected", b === btn);
    });
  });

  // ===== 4. 글자수 카운트 =====
  const bodyInput = $("#reviewBody");
  const charNow = $('[data-role="char-now"]');

  bodyInput.addEventListener("input", () => {
    charNow.textContent = bodyInput.value.length;
  });

  // ===== 5. 사진 첨부 =====
  const photoInput = $('[data-role="photo-input"]');
  const photoList = $('[data-role="photo-list"]');
  const photoAdd = $('[data-role="photo-add"]');

  photoInput.addEventListener("change", (e) => {
    const files = [...e.target.files];

    if (photos.length + files.length > MAX_PHOTOS) {
      alert(`사진은 최대 ${MAX_PHOTOS}장까지 첨부할 수 있습니다.`);
      photoInput.value = "";
      return;
    }

    files.forEach((file) => {
      const url = URL.createObjectURL(file);
      photos.push({ file: file, url: url });
    });

    photoInput.value = "";
    renderPhotos();
  });

  function renderPhotos() {
    photoList.innerHTML = photos
      .map((p, i) => `
        <div class="photo-item">
          <img src="${p.url}" alt="첨부 사진 ${i + 1}">
          <button type="button" data-photo-index="${i}" aria-label="사진 삭제">✕</button>
        </div>
      `).join("");

    // 5장 다 차면 추가 버튼 숨김
    photoAdd.hidden = photos.length >= MAX_PHOTOS;
  }

  photoList.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-photo-index]");
    if (!btn) return;

    const idx = Number(btn.dataset.photoIndex);
    URL.revokeObjectURL(photos[idx].url);
    photos.splice(idx, 1);
    renderPhotos();
  });

  // ===== 6. 취소 =====
  $('[data-action="cancel"]').addEventListener("click", () => {
    if (confirm("작성 중인 내용이 사라집니다. 취소할까요?")) {
      location.href = "orders.html";
    }
  });

  // ===== 7. 등록 (U-REVIEW-001) =====
  $("#reviewForm").addEventListener("submit", (e) => {
    e.preventDefault();

    // 별점 체크
    if (rating === 0) {
      alert("별점을 선택해 주세요.");
      return;
    }

    // 내용 체크
    const body = bodyInput.value.trim();
    if (body.length < MIN_LENGTH) {
      alert(`리뷰 내용을 최소 ${MIN_LENGTH}자 이상 작성해 주세요.`);
      bodyInput.focus();
      return;
    }

    // TODO: POST /api/v1/products/{productId}/reviews
    //   body: FormData {
    //     orderId, rating, sizeFit, content, images[]
    //   }
    //   ※ 사진이 있으므로 multipart/form-data 로 전송
    console.log("리뷰 등록 (mock)", {
      orderId: orderProduct.orderId,
      productId: orderProduct.productId,
      rating: rating,
      sizeFit: sizeFit,
      content: body,
      photoCount: photos.length,
    });

    alert("리뷰가 등록되었습니다. 감사합니다!");
    location.href = "orders.html";
  });

});