// product-list.js — 상품목록 페이지 mock 스크립트
// U-MAIN-001 상품 리스트·검색 결과 조회 → GET /api/v1/products
// 받는 파라미터: ?cat=카테고리  ?q=검색어

document.addEventListener("DOMContentLoaded", () => {

  // ===== 가짜 상품 데이터 (백엔드 나오면 API로 교체) =====
  const CATEGORY_NAME = {
    outer: "아우터", top: "상의", shirts: "셔츠", knit: "니트",
    pants: "팬츠", denim: "데님", shoes: "신발", bag: "가방",
    acc: "액세서리", underwear: "언더웨어", sale: "SALE",
  };

  const BRANDS = ["캐치베이직", "무드로우", "온더코너", "레이어드", "폴리시"];
  const NAMES = [
    "오버핏 울 블렌드 코트", "베이직 크루넥 니트", "와이드 데님 팬츠",
    "레귤러 옥스포드 셔츠", "코튼 후드 집업", "슬림 슬랙스",
    "숏 패딩 점퍼", "케이블 니트 가디건", "스트레이트 진",
    "린넨 블렌드 셔츠", "미니멀 크로스백", "레더 스니커즈",
  ];

  // 상품 48개 자동 생성
  const ALL_PRODUCTS = [];
  const catKeys = Object.keys(CATEGORY_NAME).filter((c) => c !== "sale");
  for (let i = 1; i <= 48; i++) {
    const price = (Math.floor(Math.random() * 18) + 2) * 5000; // 1만~9.5만
    const discount = [0, 0, 10, 20, 30, 50][Math.floor(Math.random() * 6)];
    ALL_PRODUCTS.push({
      id: i,
      brand: BRANDS[i % BRANDS.length],
      name: NAMES[i % NAMES.length],
      cat: catKeys[i % catKeys.length],
      price: price,
      discount: discount,
      finalPrice: Math.round(price * (1 - discount / 100)),
      review: Math.floor(Math.random() * 500),
      liked: false,
    });
  }

  // ===== DOM 참조 =====
  const grid = document.querySelector('[data-role="product-grid"]');
  const emptyMsg = document.querySelector('[data-role="empty"]');
  const pagination = document.querySelector('[data-role="pagination"]');
  const totalEl = document.querySelector('[data-role="total"]');
  const titleEl = document.querySelector('[data-role="page-title"]');
  const sortSelect = document.querySelector('[data-role="sort"]');

  const PER_PAGE = 12;
  let currentPage = 1;

  // ===== URL 파라미터 읽기 (?cat=outer  ?q=니트) =====
  const params = new URLSearchParams(location.search);
  const urlCat = params.get("cat");
  const urlQuery = params.get("q");

  // 페이지 제목 세팅
  if (urlQuery) {
    titleEl.textContent = `"${urlQuery}" 검색 결과`;
  } else if (urlCat && CATEGORY_NAME[urlCat]) {
    titleEl.textContent = CATEGORY_NAME[urlCat];
    // URL 카테고리를 필터 체크박스에 자동 반영
    const cb = document.querySelector(`[data-filter="cat"][value="${urlCat}"]`);
    if (cb) cb.checked = true;
  } else {
    titleEl.textContent = "전체 상품";
  }

  // ===== 필터링 =====
  function getFiltered() {
    let list = [...ALL_PRODUCTS];

    // 검색어
    if (urlQuery) {
      const q = urlQuery.toLowerCase();
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q)
      );
    }

    // 카테고리 필터
    const cats = [...document.querySelectorAll('[data-filter="cat"]:checked')].map((el) => el.value);
    if (cats.length) list = list.filter((p) => cats.includes(p.cat));

    // 가격 필터
    const prices = [...document.querySelectorAll('[data-filter="price"]:checked')].map((el) => el.value);
    if (prices.length) {
      list = list.filter((p) =>
        prices.some((range) => {
          const [min, max] = range.split("-");
          const lo = Number(min);
          const hi = max ? Number(max) : Infinity;
          return p.finalPrice >= lo && p.finalPrice < hi;
        })
      );
    }

    // 정렬
    const sort = sortSelect.value;
    if (sort === "low") list.sort((a, b) => a.finalPrice - b.finalPrice);
    else if (sort === "high") list.sort((a, b) => b.finalPrice - a.finalPrice);
    else if (sort === "review") list.sort((a, b) => b.review - a.review);
    else if (sort === "new") list.sort((a, b) => b.id - a.id);

    return list;
  }

  // ===== 상품 카드 HTML 만들기 =====
  function cardHTML(p) {
    const won = (n) => n.toLocaleString("ko-KR");
    return `
      <div class="product-card">
        <a href="product-detail.html?id=${p.id}">
          <div class="card-thumb">
            <img src="https://placehold.co/300x400/f5f5f5/999?text=${encodeURIComponent(p.brand)}" alt="${p.name}">
            ${p.discount ? `<span class="card-badge">${p.discount}%</span>` : ""}
          </div>
          <p class="card-brand">${p.brand}</p>
          <p class="card-name">${p.name}</p>
          <div class="card-price">
            ${p.discount ? `<span class="card-sale">${p.discount}%</span>` : ""}
            <span class="card-final">${won(p.finalPrice)}원</span>
            ${p.discount ? `<span class="card-origin">${won(p.price)}원</span>` : ""}
          </div>
          <p class="card-review">리뷰 ${won(p.review)}</p>
        </a>
        <button type="button" class="card-like${p.liked ? " is-liked" : ""}" data-like-id="${p.id}" aria-label="찜하기">
          <svg viewBox="0 0 24 24"><path d="M12 20s-7-4.6-7-9.3A3.7 3.7 0 0 1 12 8a3.7 3.7 0 0 1 7 2.7C19 15.4 12 20 12 20Z"/></svg>
        </button>
      </div>
    `;
  }

  // ===== 화면 그리기 =====
  function render() {
    const list = getFiltered();
    totalEl.textContent = list.length.toLocaleString("ko-KR");

    // 결과 없음
    if (list.length === 0) {
      grid.innerHTML = "";
      pagination.innerHTML = "";
      emptyMsg.hidden = false;
      return;
    }
    emptyMsg.hidden = true;

    // 현재 페이지만 잘라내기
    const totalPages = Math.ceil(list.length / PER_PAGE);
    if (currentPage > totalPages) currentPage = 1;
    const start = (currentPage - 1) * PER_PAGE;
    const pageList = list.slice(start, start + PER_PAGE);

    grid.innerHTML = pageList.map(cardHTML).join("");
    renderPagination(totalPages);
  }

  // ===== 페이지네이션 =====
  function renderPagination(totalPages) {
    let html = `<button data-page="${currentPage - 1}" ${currentPage === 1 ? "disabled" : ""}>‹</button>`;
    for (let i = 1; i <= totalPages; i++) {
      html += `<button data-page="${i}" class="${i === currentPage ? "is-active" : ""}">${i}</button>`;
    }
    html += `<button data-page="${currentPage + 1}" ${currentPage === totalPages ? "disabled" : ""}>›</button>`;
    pagination.innerHTML = html;
  }

  // ===== 이벤트 =====

  // 필터 변경 → 1페이지로 리셋 후 다시 그리기
  document.querySelectorAll("[data-filter]").forEach((cb) => {
    cb.addEventListener("change", () => {
      currentPage = 1;
      render();
    });
  });

  // 정렬 변경
  sortSelect.addEventListener("change", () => {
    currentPage = 1;
    render();
  });

  // 필터 초기화
  document.querySelector('[data-action="reset-filter"]').addEventListener("click", () => {
    document.querySelectorAll("[data-filter]").forEach((cb) => (cb.checked = false));
    currentPage = 1;
    render();
  });

  // 페이지 클릭 (이벤트 위임)
  pagination.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-page]");
    if (!btn || btn.disabled) return;
    currentPage = Number(btn.dataset.page);
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

// 찜 버튼 (이벤트 위임)
  grid.addEventListener("click", (e) => {
    const btn = e.target.closest(".card-like");
    if (!btn) return;
    e.preventDefault();

    // 로그인 체크 (U-PROD-004는 인증 필요)
    if (!CatchAuth.requireLogin()) return;

    const id = Number(btn.dataset.likeId);

    // TODO: POST /api/v1/products/{productId}/like  (U-PROD-004)
  });

  // ===== 시작 =====
  // TODO: 실제로는 GET /api/v1/products?cat=&q=&sort=&page= 호출해서 데이터 받기
  render();

});