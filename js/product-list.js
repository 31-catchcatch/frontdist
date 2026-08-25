document.addEventListener("DOMContentLoaded", () => {

  const grid = document.querySelector('[data-role="product-grid"]');
  const emptyMsg = document.querySelector('[data-role="empty"]');
  const errorMsg = document.querySelector('[data-role="error"]');
  const pagination = document.querySelector('[data-role="pagination"]');
  const totalEl = document.querySelector('[data-role="total"]');
  const titleEl = document.querySelector('[data-role="page-title"]');
  const sortSelect = document.querySelector('[data-role="sort"]');

  const PER_PAGE = 12;


  const SORT_MAP = {
    new: "createdAt,desc",
    low: "price,asc",
    high: "price,desc",
  };
  function backendSort() {
    const base = SORT_MAP[sortSelect.value] || SORT_MAP.new;
    return [base, "id,desc"];
  }


  const params = new URLSearchParams(location.search);
  const urlCat = params.get("cat");
  const urlQuery = params.get("q");
  const urlBrand = params.get("brand");
  const urlView = params.get("view");

  let state = {
    page: 0,
    categoryId: null,
    brandId: urlBrand || null,
    keyword: urlQuery || null,
  };
  let likedIds = new Set();


  function initHeading() {
    if (urlQuery) {
      titleEl.textContent = `"${urlQuery}" 검색 결과`;
    } else if (urlBrand) {
      titleEl.textContent = "브랜드 상품";
    } else if (urlCat && CatchCatalog.SLUG_TO_NAME[urlCat]) {
      titleEl.textContent = CatchCatalog.SLUG_TO_NAME[urlCat];
    } else if (urlView === "best") {
      titleEl.textContent = "신상품";
    } else {
      titleEl.textContent = "전체 상품";
    }

    const radio = document.querySelector(`[data-filter="cat"][value="${urlCat || ""}"]`);
    if (radio) radio.checked = true;
  }


  function starHTML(avg) {
    const full = Math.round(avg);
    let s = "";
    for (let i = 1; i <= 5; i++) s += i <= full ? "★" : "☆";
    return s;
  }

  function cardHTML(p) {
    const brand = p.brandName ? `<p class="card-brand">${esc(p.brandName)}</p>` : "";
    const discount =
      p.discountRate > 0
        ? `<span class="card-origin"><s>${CatchApi.won(p.price)}</s></span> <span class="card-rate">${p.discountRate}%</span>`
        : "";
    const liked = likedIds.has(p.productId) ? " is-liked" : "";
    return `
      <div class="product-card">
        <a href="${esc(p.detailUrl)}">
          <div class="card-thumb">
            <img src="${SafeUrl(p.thumbnailUrl || CatchApi.PLACEHOLDER)}" alt="${esc(p.name)}"
                 onerror="this.onerror=null;this.src=CatchApi.PLACEHOLDER">
          </div>
          ${brand}
          <p class="card-name">${esc(p.name)}</p>
          <div class="card-price">
            <span class="card-final">${CatchApi.won(p.finalPrice)}</span>
            ${discount}
          </div>
          <p class="card-review" data-review-for="${p.productId}"><span class="card-stars">☆☆☆☆☆</span> <span class="card-review-count">리뷰 -</span></p>
        </a>
        <button type="button" class="card-like${liked}" data-like-id="${p.productId}" aria-label="찜하기">
          <svg viewBox="0 0 24 24"><path d="M12 20s-7-4.6-7-9.3A3.7 3.7 0 0 1 12 8a3.7 3.7 0 0 1 7 2.7C19 15.4 12 20 12 20Z"/></svg>
        </button>
      </div>
    `;
  }


  function hydrateReviews(items) {
    items.forEach((p) => {
      CatchProduct.fetchReviewMeta(p.productId).then((meta) => {
        const el = grid.querySelector(`[data-review-for="${p.productId}"]`);
        if (!el) return;
        el.querySelector(".card-stars").textContent = starHTML(meta.avg);
        el.querySelector(".card-review-count").textContent = `리뷰 ${meta.count.toLocaleString("ko-KR")}`;
      });
    });
  }


  function renderPagination(totalPages, current0) {
    const cur = current0 + 1;
    let html = `<button data-page="${current0 - 1}" ${current0 === 0 ? "disabled" : ""}>‹</button>`;
    for (let i = 1; i <= totalPages; i++) {
      html += `<button data-page="${i - 1}" class="${i === cur ? "is-active" : ""}">${i}</button>`;
    }
    html += `<button data-page="${current0 + 1}" ${cur >= totalPages ? "disabled" : ""}>›</button>`;
    pagination.innerHTML = html;
  }


  async function load() {
    errorMsg.hidden = true;
    emptyMsg.hidden = true;
    grid.setAttribute("aria-busy", "true");

    try {
      const result = await CatchProduct.fetchList({
        categoryId: state.categoryId,
        brandId: state.brandId,
        keyword: state.keyword,
        page: state.page,
        size: PER_PAGE,
        sort: backendSort(),
      });

      totalEl.textContent = result.totalElements.toLocaleString("ko-KR");

      if (result.items.length === 0) {
        grid.innerHTML = "";
        pagination.innerHTML = "";
        emptyMsg.hidden = false;
        return;
      }

      grid.innerHTML = result.items.map(cardHTML).join("");
      renderPagination(result.totalPages, result.page);
      hydrateReviews(result.items);
    } catch (err) {
      grid.innerHTML = "";
      pagination.innerHTML = "";
      totalEl.textContent = "0";
      errorMsg.hidden = false;
    } finally {
      grid.removeAttribute("aria-busy");
    }
  }


  document.querySelectorAll('[data-filter="cat"]').forEach((radio) => {
    radio.addEventListener("change", async () => {
      const slug = radio.value;
      state.categoryId = slug ? await CatchCatalog.idBySlug(slug) : null;
      state.page = 0;
      load();
    });
  });


  sortSelect.addEventListener("change", () => {
    state.page = 0;
    load();
  });


  const resetBtn = document.querySelector('[data-action="reset-filter"]');
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      const all = document.querySelector('[data-filter="cat"][value=""]');
      if (all) all.checked = true;
      state.categoryId = null;
      state.page = 0;
      load();
    });
  }


  pagination.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-page]");
    if (!btn || btn.disabled) return;
    state.page = Number(btn.dataset.page);
    load();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });


  grid.addEventListener("click", async (e) => {
    const btn = e.target.closest(".card-like");
    if (!btn) return;
    e.preventDefault();
    const id = Number(btn.dataset.likeId);
    const liked = await CatchProduct.toggleLike(id);
    if (liked === null) return;
    if (liked) {
      likedIds.add(id);
      btn.classList.add("is-liked");
    } else {
      likedIds.delete(id);
      btn.classList.remove("is-liked");
    }
  });


  (async function start() {
    initHeading();

    if (urlCat) state.categoryId = await CatchCatalog.idBySlug(urlCat);
    likedIds = await CatchProduct.loadLikedIds();
    load();
  })();
});
