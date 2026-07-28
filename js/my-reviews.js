// my-reviews.js — 내 리뷰 목록
// GET /api/v1/users/me/reviews (백엔드 작성완료)
// 로그인 필요 페이지

document.addEventListener("DOMContentLoaded", () => {

  // 로그인 안 했으면 로그인 페이지로
  if (!CatchAuth.requireLogin()) return;

  const $ = (sel) => document.querySelector(sel);
  // rating 이 null/범위밖이어도 repeat() RangeError 로 렌더가 깨지지 않도록 0~5 로 클램프
  const stars = (n) => {
    const v = Math.max(0, Math.min(5, Number(n) || 0));
    return "★".repeat(v) + "☆".repeat(5 - v);
  };

  let myReviews = [];
  let totalElements = 0;              // 서버 전체 리뷰 수 (총계 표기용)
  const state = { page: 0 };          // 현재 페이지 (0-index, 서버와 동일)
  const PER_PAGE = 10;                // 한 페이지에 보여줄 리뷰 수
  const pagination = $('[data-role="pagination"]');

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
        <a href="product-detail.html?id=${encodeURIComponent(r.productId)}" class="ri-thumb">
          <img src="${thumb}" alt="${r.productName}">
        </a>
        <div class="ri-body">
          <div class="ri-product">
            <a href="product-detail.html?id=${encodeURIComponent(r.productId)}" class="ri-name">${r.productName}</a>
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
    $('[data-role="total"]').textContent = totalElements; // 현재 페이지 수가 아닌 전체 건수

    if (myReviews.length === 0) {
      $('[data-role="review-list"]').innerHTML = "";
      $('[data-role="review-empty"]').hidden = false;
      if (pagination) pagination.innerHTML = "";
      return;
    }

    $('[data-role="review-empty"]').hidden = true;
    $('[data-role="review-list"]').innerHTML = myReviews.map(itemHTML).join("");
  }

  // ===== 페이지네이션 (표기는 1-index, 내부는 0-index) — product-list.js 와 동일 규약 =====
  function renderPagination(totalPages, current0) {
    if (!pagination) return;
    if (!totalPages || totalPages <= 1) {
      pagination.innerHTML = ""; // 페이지가 하나뿐이면 숨김
      return;
    }
    const cur = current0 + 1;
    let html = `<button data-page="${current0 - 1}" ${current0 === 0 ? "disabled" : ""}>‹</button>`;
    for (let i = 1; i <= totalPages; i++) {
      html += `<button data-page="${i - 1}" class="${i === cur ? "is-active" : ""}">${i}</button>`;
    }
    html += `<button data-page="${current0 + 1}" ${cur >= totalPages ? "disabled" : ""}>›</button>`;
    pagination.innerHTML = html;
  }

  // ===== API에서 진짜 데이터 받아오기 =====
  async function loadMyReviews() {
    try {
      // CatchApi.page 가 BASE(/api/v1)·인증(Bearer)·봉투해제·페이지정규화를 전담한다.
      // GET /api/v1/users/me/reviews?page=&size= → { content, page, totalElements, totalPages, ... }
      const result = await CatchApi.page("/users/me/reviews", { page: state.page, size: PER_PAGE });

      myReviews = result.content;
      totalElements = result.totalElements;

      // 마지막 페이지의 마지막 리뷰를 지워 현재 페이지가 비면 한 페이지 앞으로 보정 후 재조회
      if (myReviews.length === 0 && state.page > 0) {
        state.page -= 1;
        return loadMyReviews();
      }

      render();
      renderPagination(result.totalPages, result.page);
    } catch (err) {
      console.error(err);
      $('[data-role="review-list"]').innerHTML =
        `<li style="text-align:center;padding:60px;color:#e02020;">리뷰를 불러오지 못했습니다.<br>${err.message}</li>`;
      if (pagination) pagination.innerHTML = "";
    }
  }

  // ===== 수정 / 삭제 (이벤트 위임) =====
  $('[data-role="review-list"]').addEventListener("click", async (e) => {
    const li = e.target.closest(".review-item");
    if (!li) return;

    const id = Number(li.dataset.id);
    const action = e.target.dataset.action;

    // 수정 → 리뷰 작성 페이지(작성/수정 겸용)로
    if (action === "edit") {
      // 백엔드에 리뷰 단건 GET 이 없으므로, 프리필용으로 현재 리뷰 객체를
      // sessionStorage 에 실어 넘긴다. (review-write.js 가 읽어 폼을 채움)
      const review = myReviews.find((r) => Number(r.reviewId) === id);
      if (review) {
        try {
          sessionStorage.setItem("catchcatch.editReview", JSON.stringify(review));
        } catch (_) { /* 저장 실패해도 review-write 가 목록에서 폴백 조회 */ }
      }
      location.href = `review-write.html?reviewId=${id}&edit=true`;
      return;
    }

    // 삭제 → DELETE /api/v1/reviews/{reviewId}
    //   백엔드: 본인 작성 리뷰만 논리 삭제(soft delete). 성공 시 ApiResponse(data 없음).
    if (action === "delete") {
      if (!confirm("이 리뷰를 삭제할까요?")) return;

      const btn = e.target;
      btn.disabled = true; // 중복 클릭 방지

      try {
        await CatchApi.del(`/reviews/${id}`); // BASE(/api/v1) 자동, 봉투 해제·에러 throw

        // 삭제 후엔 총 건수·페이지 수·항목 위치가 바뀌므로 현재 페이지를 서버에서 다시 로드한다.
        // (현재 페이지가 비면 loadMyReviews 가 한 페이지 앞으로 보정)
        await loadMyReviews();
      } catch (err) {
        console.error(err);
        alert(err.message || "리뷰 삭제에 실패했습니다.");
        btn.disabled = false; // 실패 시 재시도 가능하도록 복구
      }
    }
  });

  // ===== 페이지 클릭 (이벤트 위임) =====
  if (pagination) {
    pagination.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-page]");
      if (!btn || btn.disabled) return;
      state.page = Number(btn.dataset.page);
      loadMyReviews();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // ===== 시작 =====
  loadMyReviews();

});
