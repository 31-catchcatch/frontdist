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
    const brand = p.brandName
      ? `<p class="brand-name">${esc(p.brandName)}</p>`
      : `<p class="brand-name">&nbsp;</p>`;
    const detailUrl = "product-detail.html?id=" + p.productId +
      (p.brandName ? "&brand=" + encodeURIComponent(p.brandName) : "");
    return `
      <div class="product-item" data-href="${detailUrl}">
        <div class="product-image">
          <img src="${SafeUrl(p.thumbnailUrl || CatchApi.PLACEHOLDER)}" alt="${esc(p.name)}"
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
