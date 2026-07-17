// latest-list.js — 최근 본 상품 (localStorage 기반, API 아님)
//   백엔드 설계상 최근 본 상품은 RDB 가 아니라 localStorage 로 구현하기로 결정됨.
//   데이터는 product-detail.js 의 CatchProduct.pushRecentlyViewed() 가 쌓는다.
//
// ⚠️ auth.js → api.js → product.js 다음에 로드된다.

document.addEventListener("DOMContentLoaded", () => {
  const grid = document.querySelector('[data-role="recent-grid"]');
  const empty = document.querySelector('[data-role="recent-empty"]');

  function fmtTime(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, "0");
    return (
      `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ` +
      `${pad(d.getHours())}:${pad(d.getMinutes())}`
    );
  }

  function itemHTML(p) {
    const esc = CatchApi.escape;
    const brand = p.brandName
      ? `<p class="brand-name">${esc(p.brandName)}</p>`
      : `<p class="brand-name">&nbsp;</p>`;
    const detailUrl = "product-detail.html?id=" + p.productId +
      (p.brandName ? "&brand=" + encodeURIComponent(p.brandName) : "");
    return `
      <div class="product-item" data-href="${esc(detailUrl)}">
        <div class="product-image">
          <img src="${esc(CatchApi.thumb(p.thumbnailUrl))}" alt="${esc(p.name)}"
               onerror="this.onerror=null;this.src=CatchApi.PLACEHOLDER">
        </div>
        <div class="product-info">
          ${brand}
          <h4>${esc(p.name)}</h4>
          <p class="price">${CatchApi.won(p.finalPrice)}</p>
          <p class="view-time">방문일시 : ${fmtTime(p.viewedAt)}</p>
        </div>
      </div>
    `;
  }

  function render() {
    const items = CatchProduct.getRecentlyViewed();
    if (!items.length) {
      grid.innerHTML = "";
      grid.hidden = true;
      if (empty) empty.hidden = false;
      return;
    }
    grid.hidden = false;
    if (empty) empty.hidden = true;
    grid.innerHTML = items.map(itemHTML).join("");
  }

  // 카드 클릭 → 상세 이동
  grid.addEventListener("click", (e) => {
    const item = e.target.closest(".product-item[data-href]");
    if (item) location.href = item.dataset.href;
  });

  render();
});
