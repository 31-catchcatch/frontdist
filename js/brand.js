// brand.js — 브랜드 목록 페이지 mock 스크립트
// ※ 기능정의서 보완 — 입점 브랜드 조회
// 조회: GET /api/v1/brands (제안)
// 찜:   POST /api/v1/brands/{brandId}/like (제안)

document.addEventListener("DOMContentLoaded", () => {

  // ===== 가짜 브랜드 데이터 =====
  // TODO: GET /api/v1/brands
  //   initial = 초성/알파벳 필터용 (ㄱ,ㄴ,ㄷ... 또는 A-Z)
  let brands = [
    { brandId: 1, name: "캐치베이직", en: "CATCH BASIC", initial: "ㅋ", count: 128, liked: false, logo: "https://placehold.co/200x200/e8e8e8/999?text=CB" },
    { brandId: 2, name: "무드로우", en: "MOODROW", initial: "ㅁ", count: 84, liked: false, logo: "https://placehold.co/200x200/f0f0f0/999?text=MR" },
    { brandId: 3, name: "온더코너", en: "ON THE CORNER", initial: "ㅇ", count: 56, liked: false, logo: "https://placehold.co/200x200/e0e0e0/999?text=OC" },
    { brandId: 4, name: "레이어드", en: "LAYERED", initial: "ㄹ", count: 42, liked: false, logo: "https://placehold.co/200x200/eaeaea/999?text=LY" },
    { brandId: 5, name: "폴리시", en: "POLICY", initial: "ㅍ", count: 37, liked: false, logo: "https://placehold.co/200x200/e5e5e5/999?text=PL" },
    { brandId: 6, name: "그레이톤", en: "GRAYTONE", initial: "ㄱ", count: 29, liked: false, logo: "https://placehold.co/200x200/ededed/999?text=GT" },
    { brandId: 7, name: "네이처핏", en: "NATUREFIT", initial: "ㄴ", count: 24, liked: false, logo: "https://placehold.co/200x200/e2e2e2/999?text=NF" },
    { brandId: 8, name: "данText", en: "DAILYTONE", initial: "ㄷ", count: 18, liked: false, logo: "https://placehold.co/200x200/f2f2f2/999?text=DT" },
    { brandId: 9, name: "ATELIER", en: "ATELIER", initial: "A-Z", count: 61, liked: false, logo: "https://placehold.co/200x200/e6e6e6/999?text=AT" },
  ];

  const $ = (sel) => document.querySelector(sel);

  let currentFilter = "all";

  // ===== 브랜드 카드 HTML =====
  function cardHTML(b) {
    return `
      <div class="brand-card" data-id="${b.brandId}">
        <a href="product-list.html?brand=${b.brandId}" class="brand-logo">
          <img src="${b.logo}" alt="${b.name}">
        </a>
        <a href="product-list.html?brand=${b.brandId}" class="brand-name">${b.name}</a>
        <p class="brand-en">${b.en}</p>
        <p class="brand-count">상품 ${b.count.toLocaleString("ko-KR")}개</p>
        <button type="button" class="brand-like${b.liked ? " is-liked" : ""}" data-action="like">
          <svg viewBox="0 0 24 24"><path d="M12 20s-7-4.6-7-9.3A3.7 3.7 0 0 1 12 8a3.7 3.7 0 0 1 7 2.7C19 15.4 12 20 12 20Z"/></svg>
          <span>${b.liked ? "찜함" : "찜하기"}</span>
        </button>
      </div>
    `;
  }

  // ===== 화면 그리기 =====
  function render() {
    let list = [...brands];

    // 필터 적용
    if (currentFilter !== "all") {
      list = list.filter((b) => b.initial === currentFilter);
    }

    $('[data-role="total"]').textContent = brands.length;

    if (list.length === 0) {
      $('[data-role="brand-grid"]').innerHTML = "";
      $('[data-role="brand-empty"]').hidden = false;
      return;
    }

    $('[data-role="brand-empty"]').hidden = true;
    $('[data-role="brand-grid"]').innerHTML = list.map(cardHTML).join("");
  }

  // ===== 필터 클릭 =====
  $('[data-role="filter"]').addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-initial]");
    if (!btn) return;

    currentFilter = btn.dataset.initial;
    document.querySelectorAll("[data-initial]").forEach((b) => {
      b.classList.toggle("is-active", b === btn);
    });
    render();
  });

  // ===== 찜 버튼 (이벤트 위임) =====
  $('[data-role="brand-grid"]').addEventListener("click", (e) => {
    const btn = e.target.closest('[data-action="like"]');
    if (!btn) return;

    // 로그인 체크
    if (!CatchAuth.requireLogin()) return;

    const card = btn.closest(".brand-card");
    const id = Number(card.dataset.id);
    const brand = brands.find((b) => b.brandId === id);

    brand.liked = !brand.liked;
    // TODO: POST /api/v1/brands/{brandId}/like
    render();
  });

  // ===== 시작 =====
  render();

});