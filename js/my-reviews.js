// my-reviews.js — 내 리뷰 목록
// GET /api/v1/users/me/reviews (백엔드 작성완료)
// 로그인 필요 페이지

document.addEventListener("DOMContentLoaded", () => {

  // 로그인 안 했으면 로그인 페이지로
  if (!CatchAuth.requireLogin()) return;

  const $ = (sel) => document.querySelector(sel);
  const stars = (n) => "★".repeat(n) + "☆".repeat(5 - n);

  let myReviews = [];

  // ===== 리뷰 하나 HTML =====
  function itemHTML(r) {
    // 리뷰에 첨부한 사진 (있을 때만)
    const photoHTML = r.imageUrl
      ? `<div class="ri-photos"><img src="${r.imageUrl}" alt="리뷰 사진"></div>`
      : "";

    // 상품 썸네일 (없으면 회색 박스)
    const thumb = r.productThumbnailUrl || "https://placehold.co/300x400/f5f5f5/999?text=IMG";

    // 날짜 (2026-07-14T10:00 → 2026-07-14)
    const date = r.createdAt ? r.createdAt.substring(0, 10) : "";

    return `
      <li class="review-item" data-id="${r.reviewId}">
        <a href="product-detail.html?id=${r.productId}" class="ri-thumb">
          <img src="${thumb}" alt="${r.productName}">
        </a>
        <div class="ri-body">
          <div class="ri-product">
            <a href="product-detail.html?id=${r.productId}" class="ri-name">${r.productName}</a>
          </div>

          <div class="ri-meta">
            <span class="ri-stars">${stars(r.rating)}</span>
            <span class="ri-date">${date}</span>
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

  // ===== API에서 진짜 데이터 받아오기 =====
  async function loadMyReviews() {
    try {
      const token = localStorage.getItem("catchcatch.accessToken");

      const res = await fetch("http://localhost:8080/api/v1/users/me/reviews", {
        method: "GET",
        headers: { "Authorization": "Bearer " + token },
      });

      if (!res.ok) throw new Error("리뷰 조회 실패: " + res.status);

      const json = await res.json();
      const list = json.data.content;   // 3겹 껍질 (포인트랑 같음)

      console.log("받은 리뷰:", list);  // 확인용 (나중에 지워도 됨)

      myReviews = list;
      render();

    } catch (err) {
      console.error(err);
      $('[data-role="review-list"]').innerHTML =
        `<li style="text-align:center;padding:60px;color:#e02020;">리뷰를 불러오지 못했습니다.<br>${err.message}</li>`;
    }
  }

  // ===== 수정 / 삭제 (이벤트 위임) =====
  $('[data-role="review-list"]').addEventListener("click", (e) => {
    const li = e.target.closest(".review-item");
    if (!li) return;

    const id = Number(li.dataset.id);
    const action = e.target.dataset.action;

    // 수정 → 리뷰 작성 페이지로
    if (action === "edit") {
      // TODO: 리뷰 수정 API (PUT /api/v1/reviews/{reviewId}) — 백엔드 확인 필요
      location.href = `review-write.html?reviewId=${id}&edit=true`;
    }

    // 삭제
    if (action === "delete") {
      if (!confirm("이 리뷰를 삭제할까요?")) return;
      // TODO: 리뷰 삭제 API (DELETE /api/v1/reviews/{reviewId}) — 백엔드 확인 필요
      alert("삭제 API가 아직 준비되지 않았습니다.");
    }
  });

  // ===== 시작 =====
  loadMyReviews();

});