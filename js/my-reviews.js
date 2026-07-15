// my-reviews.js — 내 리뷰 목록 mock 스크립트
// ※ 기능정의서 보완 — 내가 작성한 리뷰 조회/관리
// 조회: GET /api/v1/users/me/reviews (제안)
// 수정: PUT /api/v1/reviews/{reviewId} (제안)
// 삭제: DELETE /api/v1/reviews/{reviewId} (제안)
// 로그인 필요 페이지

document.addEventListener("DOMContentLoaded", () => {

  // ===== 로그인 안 했으면 로그인 페이지로 =====
  if (!CatchAuth.requireLogin()) return;

  // ===== 가짜 내 리뷰 데이터 =====
  // TODO: GET /api/v1/users/me/reviews
  let myReviews = [
    {
      reviewId: 1001,
      productId: 1,
      brand: "캐치베이직",
      name: "오버핏 울 블렌드 싱글 코트",
      size: "M",
      rating: 5,
      date: "2026.07.10",
      content: "핏이 정말 예뻐요! 어깨가 넉넉해서 안에 니트 입어도 편합니다. 두께감도 적당해서 초겨울까지 입기 좋을 것 같아요.",
      thumb: "https://placehold.co/300x400/e8e8e8/999?text=COAT",
      photos: [
        "https://placehold.co/200x200/eaeaea/999?text=1",
        "https://placehold.co/200x200/e0e0e0/999?text=2",
      ],
    },
    {
      reviewId: 1002,
      productId: 5,
      brand: "무드로우",
      name: "베이직 크루넥 니트",
      size: "L",
      rating: 4,
      date: "2026.07.05",
      content: "색감 예쁘고 촉감 좋아요. 다만 생각보다 얇아서 별 하나 뺐습니다.",
      thumb: "https://placehold.co/300x400/f0f0f0/999?text=KNIT",
      photos: [],
    },
    {
      reviewId: 1003,
      productId: 12,
      brand: "온더코너",
      name: "와이드 데님 팬츠",
      size: "S",
      rating: 5,
      date: "2026.06.28",
      content: "핏이 딱 원하던 와이드핏이에요. 재질도 도톰하니 좋습니다. 재구매 의사 있어요!",
      thumb: "https://placehold.co/300x400/e0e0e0/999?text=DENIM",
      photos: [
        "https://placehold.co/200x200/ededed/999?text=1",
      ],
    },
  ];

  const $ = (sel) => document.querySelector(sel);
  const stars = (n) => "★".repeat(n) + "☆".repeat(5 - n);

  // ===== 리뷰 하나 HTML =====
  function itemHTML(r) {
    const photoHTML = r.photos.length
      ? `<div class="ri-photos">${r.photos.map((src) => `<img src="${src}" alt="리뷰 사진">`).join("")}</div>`
      : "";

    return `
      <li class="review-item" data-id="${r.reviewId}">
        <a href="product-detail.html?id=${r.productId}" class="ri-thumb">
          <img src="${r.thumb}" alt="${r.name}">
        </a>
        <div class="ri-body">
          <div class="ri-product">
            <span class="ri-brand">${r.brand}</span>
            <a href="product-detail.html?id=${r.productId}" class="ri-name">${r.name}</a>
            <span class="ri-option">사이즈 ${r.size}</span>
          </div>

          <div class="ri-meta">
            <span class="ri-stars">${stars(r.rating)}</span>
            <span class="ri-date">${r.date}</span>
          </div>

          <p class="ri-text">${r.content}</p>
          ${photoHTML}

          <div class="ri-actions">
            <button type="button" class="btn-edit" data-action="edit">수정</button>
            <button type="button" class="btn-delete" data-action="delete">삭제</button>
          </div>
        </div>
      </li>
    `;
  }

  // ===== 화면 그리기 =====
  function render() {
    $('[data-role="total"]').textContent = myReviews.length;

    if (myReviews.length === 0) {
      $('[data-role="review-list"]').innerHTML = "";
      $('[data-role="review-empty"]').hidden = false;
      return;
    }

    $('[data-role="review-empty"]').hidden = true;
    $('[data-role="review-list"]').innerHTML = myReviews.map(itemHTML).join("");
  }

  // ===== 수정 / 삭제 (이벤트 위임) =====
  $('[data-role="review-list"]').addEventListener("click", (e) => {
    const li = e.target.closest(".review-item");
    if (!li) return;

    const id = Number(li.dataset.id);
    const review = myReviews.find((r) => r.reviewId === id);
    const action = e.target.dataset.action;

    // 수정 → 리뷰 작성 페이지로 (수정 모드)
    if (action === "edit") {
      // TODO: PUT /api/v1/reviews/{reviewId}
      //   review-write.html에서 기존 값을 불러와 수정하도록 연동
      location.href = `review-write.html?reviewId=${id}&edit=true`;
    }

    // 삭제
    if (action === "delete") {
      if (!confirm("이 리뷰를 삭제할까요?")) return;
      myReviews = myReviews.filter((r) => r.reviewId !== id);
      // TODO: DELETE /api/v1/reviews/{reviewId}
      render();
    }
  });

  // ===== 시작 =====
  render();

});