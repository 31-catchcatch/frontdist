document.addEventListener("DOMContentLoaded", () => {


  if (!CatchAuth.requireLogin()) return;

  const $ = (sel) => document.querySelector(sel);

  const stars = (n) => {
    const v = Math.max(0, Math.min(5, Number(n) || 0));
    return "★".repeat(v) + "☆".repeat(5 - v);
  };

  let myReviews = [];
  let totalElements = 0;
  const state = { page: 0 };
  const PER_PAGE = 10;
  const pagination = $('[data-role="pagination"]');


  function itemHTML(r) {

    const photoHTML = r.imageUrl
      ? `<div class="ri-photos"><img src="${esc(r.imageUrl)}" alt="리뷰 사진"></div>`
      : "";


    const thumb = r.productThumbnailUrl || "https://placehold.co/300x400/f5f5f5/999?text=IMG";


    const date = r.createdAt ? r.createdAt.substring(0, 10) : "";

    return `
      <li class="review-item" data-id="${r.reviewId}">
        <a href="product-detail.html?id=${encodeURIComponent(r.productId)}" class="ri-thumb">
          <img src="${SafeUrl(thumb)}" alt="${esc(r.productName)}">
        </a>
        <div class="ri-body">
          <div class="ri-product">
            <a href="product-detail.html?id=${encodeURIComponent(r.productId)}" class="ri-name">${esc(r.productName)}</a>
          </div>

          <div class="ri-meta">
            <span class="ri-stars">${stars(r.rating)}</span>
            <span class="ri-date">${date}</span>
          </div>

          <p class="ri-text">${esc(r.content)}</p>
          ${photoHTML}

          <div class="ri-actions">
            <button type="button" class="btn-edit" data-action="edit">수정</button>
            <button type="button" class="btn-delete" data-action="delete">삭제</button>
          </div>
        </div>
      </li>
    `;
  }


  function render() {
    $('[data-role="total"]').textContent = totalElements;

    if (myReviews.length === 0) {
      $('[data-role="review-list"]').innerHTML = "";
      $('[data-role="review-empty"]').hidden = false;
      if (pagination) pagination.innerHTML = "";
      return;
    }

    $('[data-role="review-empty"]').hidden = true;
    $('[data-role="review-list"]').innerHTML = myReviews.map(itemHTML).join("");
  }


  function renderPagination(totalPages, current0) {
    if (!pagination) return;
    if (!totalPages || totalPages <= 1) {
      pagination.innerHTML = "";
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


  async function loadMyReviews() {
    try {
      const result = await CatchApi.page("/users/me/reviews", { page: state.page, size: PER_PAGE });

      myReviews = result.content;
      totalElements = result.totalElements;


      if (myReviews.length === 0 && state.page > 0) {
        state.page -= 1;
        return loadMyReviews();
      }

      render();
      renderPagination(result.totalPages, result.page);
    } catch (err) {
      console.error(err);
      $('[data-role="review-list"]').innerHTML =
        `<li class="state-error">리뷰를 불러오지 못했습니다.<br>${esc(err.message)}</li>`;
      if (pagination) pagination.innerHTML = "";
    }
  }


  $('[data-role="review-list"]').addEventListener("click", async (e) => {
    const li = e.target.closest(".review-item");
    if (!li) return;

    const id = Number(li.dataset.id);
    const action = e.target.dataset.action;


    if (action === "edit") {
      const review = myReviews.find((r) => Number(r.reviewId) === id);
      if (review) {
        try {
          sessionStorage.setItem("catchcatch.editReview", JSON.stringify(review));
        } catch (_) {  }
      }
      location.href = `review-write.html?reviewId=${id}&edit=true`;
      return;
    }

    if (action === "delete") {
      if (!confirm("이 리뷰를 삭제할까요?")) return;

      const btn = e.target;
      btn.disabled = true;

      try {
        await CatchApi.del(`/reviews/${id}`);


        await loadMyReviews();
      } catch (err) {
        console.error(err);
        alert(err.message || "리뷰 삭제에 실패했습니다.");
        btn.disabled = false;
      }
    }
  });


  if (pagination) {
    pagination.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-page]");
      if (!btn || btn.disabled) return;
      state.page = Number(btn.dataset.page);
      loadMyReviews();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }


  loadMyReviews();

});
