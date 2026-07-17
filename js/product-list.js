// product-list.js — 상품목록/검색 결과 (product-list.html + search.html 공용)
// U-MAIN-001 상품 리스트·검색 결과 조회 → GET /api/v1/products
// URL 파라미터: ?cat=카테고리슬러그  ?q=검색어  ?brand=브랜드id  ?view=best
//
// ⚠️ auth.js → api.js → catalog.js → product.js 다음에 로드된다.

document.addEventListener("DOMContentLoaded", () => {
  // ===== DOM 참조 =====
  const grid = document.querySelector('[data-role="product-grid"]');
  const emptyMsg = document.querySelector('[data-role="empty"]');
  const errorMsg = document.querySelector('[data-role="error"]');
  const pagination = document.querySelector('[data-role="pagination"]');
  const totalEl = document.querySelector('[data-role="total"]');
  const titleEl = document.querySelector('[data-role="page-title"]');
  const sortSelect = document.querySelector('[data-role="sort"]');

  const PER_PAGE = 12;

  // 프론트 정렬값 → 백엔드 sort 파라미터 (안전한 값만)
  // ⚠️ finalPrice 정렬은 백엔드 500. price(정가) 기준으로만 정렬 가능.
  //    타이브레이크로 id,desc 를 함께 보내 페이징 중복/누락 방지.
  const SORT_MAP = {
    new: "createdAt,desc",
    low: "price,asc",
    high: "price,desc",
  };
  function backendSort() {
    const base = SORT_MAP[sortSelect.value] || SORT_MAP.new;
    return [base, "id,desc"]; // URLSearchParams 가 sort 를 두 번 붙이도록 배열로
  }

  // ===== URL 파라미터 =====
  const params = new URLSearchParams(location.search);
  const urlCat = params.get("cat"); // 슬러그
  const urlQuery = params.get("q");
  const urlBrand = params.get("brand"); // 브랜드 id
  const urlView = params.get("view");

  let state = {
    page: 0, // 0-index (백엔드 기준)
    categoryId: null,
    brandId: urlBrand || null,
    keyword: urlQuery || null,
  };
  let likedIds = new Set();

  // 페이지 제목 + 초기 카테고리 라디오 반영
  function initHeading() {
    if (urlQuery) {
      titleEl.textContent = `"${urlQuery}" 검색 결과`;
    } else if (urlBrand) {
      titleEl.textContent = "브랜드 상품";
    } else if (urlCat && CatchCatalog.SLUG_TO_NAME[urlCat]) {
      titleEl.textContent = CatchCatalog.SLUG_TO_NAME[urlCat];
    } else if (urlView === "best") {
      titleEl.textContent = "신상품"; // 베스트 데이터 부재 → 최신순 신상품으로 대체
    } else {
      titleEl.textContent = "전체 상품";
    }
    // 카테고리 라디오 선택 반영
    const radio = document.querySelector(`[data-filter="cat"][value="${urlCat || ""}"]`);
    if (radio) radio.checked = true;
  }

  // ===== 카드 HTML =====
  function starHTML(avg) {
    const full = Math.round(avg);
    let s = "";
    for (let i = 1; i <= 5; i++) s += i <= full ? "★" : "☆";
    return s;
  }

  function cardHTML(p) {
    const esc = CatchApi.escape;
    const brand = p.brandName ? `<p class="card-brand">${esc(p.brandName)}</p>` : "";
    const discount =
      p.discountRate > 0
        ? `<span class="card-origin"><s>${CatchApi.won(p.price)}</s></span> <span class="card-rate">${p.discountRate}%</span>`
        : "";
    const liked = likedIds.has(p.productId) ? " is-liked" : "";
    return `
      <div class="product-card">
        <a href="${p.detailUrl}">
          <div class="card-thumb">
            <img src="${esc(CatchApi.thumb(p.thumbnailUrl))}" alt="${esc(p.name)}"
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

  // 별점·리뷰수를 카드별로 비동기 채우기 (페이지당 12회 병렬)
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

  // ===== 페이지네이션 (1-index 표기, 내부는 0-index) =====
  function renderPagination(totalPages, current0) {
    const cur = current0 + 1; // 표기용 1-index
    let html = `<button data-page="${current0 - 1}" ${current0 === 0 ? "disabled" : ""}>‹</button>`;
    for (let i = 1; i <= totalPages; i++) {
      html += `<button data-page="${i - 1}" class="${i === cur ? "is-active" : ""}">${i}</button>`;
    }
    html += `<button data-page="${current0 + 1}" ${cur >= totalPages ? "disabled" : ""}>›</button>`;
    pagination.innerHTML = html;
  }

  // ===== 조회 + 렌더 =====
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

  // ===== 이벤트 =====
  // 카테고리 라디오 → categoryId 재계산 후 1페이지부터
  document.querySelectorAll('[data-filter="cat"]').forEach((radio) => {
    radio.addEventListener("change", async () => {
      const slug = radio.value;
      state.categoryId = slug ? await CatchCatalog.idBySlug(slug) : null;
      state.page = 0;
      load();
    });
  });

  // 정렬 변경
  sortSelect.addEventListener("change", () => {
    state.page = 0;
    load();
  });

  // 필터 초기화
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

  // 페이지 클릭 (이벤트 위임)
  pagination.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-page]");
    if (!btn || btn.disabled) return;
    state.page = Number(btn.dataset.page);
    load();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // 찜 버튼 (이벤트 위임)
  grid.addEventListener("click", async (e) => {
    const btn = e.target.closest(".card-like");
    if (!btn) return;
    e.preventDefault();
    const id = Number(btn.dataset.likeId);
    const liked = await CatchProduct.toggleLike(id); // 비로그인 시 로그인 이동 + null
    if (liked === null) return;
    if (liked) {
      likedIds.add(id);
      btn.classList.add("is-liked");
    } else {
      likedIds.delete(id);
      btn.classList.remove("is-liked");
    }
  });

  // ===== 시작 =====
  (async function start() {
    initHeading();
    // 슬러그 → categoryId 선변환 (URL 로 진입한 경우)
    if (urlCat) state.categoryId = await CatchCatalog.idBySlug(urlCat);
    likedIds = await CatchProduct.loadLikedIds();
    load();
  })();
});
