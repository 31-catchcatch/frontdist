// home.js — 메인 페이지 (index.html)
//   - 신상품 8개: GET /api/v1/products?sort=createdAt,desc (최신순)
//   - 히어로 배너 자동 슬라이드 (기존 로직 이관, 데이터 변경 없음)
//
// ⚠️ auth.js → api.js → product.js 다음에 로드된다.

document.addEventListener("DOMContentLoaded", () => {
  // ===== 신상품 그리드 =====
  const grid = document.getElementById("grid");

  // 썸네일이 없을 때 쓰는 기존 SVG 아트 시스템 (디자인 유지)
  const tiles = ["var(--tile-1)", "var(--tile-2)", "var(--tile-3)", "var(--tile-4)"];
  const garments = ["g-tee", "g-hoodie", "g-pants", "g-jacket", "g-cap", "g-bag"];

  let likedIds = new Set();

  function thumbHTML(p, i) {
    if (p.thumbnailUrl) {
      return (
        `<img class="thumb-img" src="${CatchApi.escape(p.thumbnailUrl)}" alt="${CatchApi.escape(p.name)}"` +
        ` onerror="this.onerror=null;this.src=CatchApi.PLACEHOLDER">`
      );
    }
    // 썸네일 없으면 기존 garment SVG 아트로 폴백
    const g = garments[i % garments.length];
    return (
      `<div class="art" style="background:${tiles[i % tiles.length]}"></div>` +
      `<svg class="garment" viewBox="0 0 130 110"><use href="#${g}"/></svg>`
    );
  }

  function card(p, i) {
    const liked = likedIds.has(p.productId) ? " is-liked" : "";
    const brand = p.brandName
      ? `<span class="brand-nm">${CatchApi.escape(p.brandName)}</span>`
      : `<span class="brand-nm">&nbsp;</span>`;
    return `<article class="card" tabindex="0" data-id="${p.productId}" data-href="${CatchApi.escape(p.detailUrl)}">
      <div class="thumb">
        ${thumbHTML(p, i)}
        <button class="like${liked}" data-like-id="${p.productId}" aria-label="찜하기"><svg viewBox="0 0 24 24"><path d="M12 20s-7-4.6-7-9.3A3.7 3.7 0 0 1 12 8a3.7 3.7 0 0 1 7 2.7C19 15.4 12 20 12 20Z"/></svg></button>
      </div>
      <div class="meta">
        ${brand}
        <span class="prod-nm">${CatchApi.escape(p.name)}</span>
        <div class="price-row"><span class="price tnum">${CatchApi.won(p.finalPrice)}</span></div>
      </div>
    </article>`;
  }

  async function loadNewArrivals() {
    try {
      const result = await CatchProduct.fetchList({ page: 0, size: 8, sort: "createdAt,desc" });
      if (result.items.length === 0) {
        grid.innerHTML = '<p class="empty-preview" style="grid-column:1/-1;color:#999">등록된 상품이 없습니다.</p>';
        return;
      }
      grid.innerHTML = result.items.map(card).join("");
    } catch (err) {
      grid.innerHTML =
        '<p class="empty-preview" style="grid-column:1/-1;color:#999">상품을 불러오지 못했습니다.</p>';
    }
  }

  // 카드 클릭 → 상세 이동 / 찜 버튼 → 토글
  grid.addEventListener("click", async (e) => {
    const likeBtn = e.target.closest(".like");
    if (likeBtn) {
      e.stopPropagation();
      const id = Number(likeBtn.dataset.likeId);
      const liked = await CatchProduct.toggleLike(id);
      if (liked === null) return;
      likeBtn.classList.toggle("is-liked", liked);
      if (liked) likedIds.add(id);
      else likedIds.delete(id);
      return;
    }
    const cardEl = e.target.closest(".card[data-href]");
    if (cardEl) location.href = cardEl.dataset.href;
  });

  // 키보드 접근성: 카드에서 Enter → 상세
  grid.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const cardEl = e.target.closest(".card[data-href]");
    if (cardEl) location.href = cardEl.dataset.href;
  });

  (async function start() {
    likedIds = await CatchProduct.loadLikedIds();
    loadNewArrivals();
  })();

  // ===== 히어로 배너 슬라이드 (기존 로직 그대로) =====
  (function initSlider() {
    const slider = document.getElementById("adSlider");
    const track = document.getElementById("adTrack");
    const dots = Array.from(document.querySelectorAll(".slider-dot"));
    if (!slider || !track || dots.length === 0) return;
    const slideCount = dots.length;
    let index = 0;
    let timer = null;

    function moveTo(nextIndex) {
      index = (nextIndex + slideCount) % slideCount;
      track.style.transform = `translateX(-${index * 100}%)`;
      dots.forEach((dot, i) => dot.classList.toggle("on", i === index));
    }
    function startAutoSlide() {
      stopAutoSlide();
      timer = window.setInterval(() => moveTo(index + 1), 4000);
    }
    function stopAutoSlide() {
      if (timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
    }
    dots.forEach((dot, i) => {
      dot.addEventListener("click", () => {
        moveTo(i);
        startAutoSlide();
      });
    });
    slider.addEventListener("mouseenter", stopAutoSlide);
    slider.addEventListener("mouseleave", startAutoSlide);
    slider.addEventListener("focusin", stopAutoSlide);
    slider.addEventListener("focusout", startAutoSlide);
    moveTo(0);
    startAutoSlide();
  })();
});
