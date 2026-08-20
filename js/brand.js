document.addEventListener("DOMContentLoaded", () => {
  const $ = (sel) => document.querySelector(sel);
  const gridEl = $('[data-role="brand-grid"]');
  const emptyEl = $('[data-role="brand-empty"]');
  const totalEl = $('[data-role="total"]');

  let brands = [];
  let currentFilter = "all";

  // 로고 없을 때 이니셜 2글자 뱃지로 폴백
  function logoFallback(name) {
    const text = (name || "").slice(0, 2);
    return (
      '<div class="brand-logo-fallback" aria-hidden="true" ' +
      'style="width:100%;aspect-ratio:1;display:flex;align-items:center;justify-content:center;' +
      'background:#f0f0f0;color:#999;font-weight:700;font-size:20px">' +
      text +
      "</div>"
    );
  }

  function cardHTML(b) {
    const logo = b.logoUrl
      ? `<img src="${esc(b.logoUrl)}" alt="${esc(b.name)}" ` +
        `onerror="this.onerror=null;this.src=CatchApi.PLACEHOLDER">`
      : logoFallback(b.name);
    return `
      <div class="brand-card" data-id="${b.id}">
        <a href="product-list.html?brand=${b.id}" class="brand-logo">${logo}</a>
        <a href="product-list.html?brand=${b.id}" class="brand-name">${esc(b.name)}</a>
      </div>
    `;
  }

  function render() {
    let list = brands;
    if (currentFilter !== "all") {
      list = brands.filter((b) => b.initial === currentFilter);
    }
    totalEl.textContent = brands.length;

    if (list.length === 0) {
      gridEl.innerHTML = "";
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;
    gridEl.innerHTML = list.map(cardHTML).join("");
  }

  // 초성 필터 클릭
  $('[data-role="filter"]').addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-initial]");
    if (!btn) return;
    currentFilter = btn.dataset.initial;
    document.querySelectorAll("[data-initial]").forEach((b) => {
      b.classList.toggle("is-active", b === btn);
    });
    render();
  });

  // ===== 시작 =====
  (async function start() {
    const raw = await CatchCatalog.brands();
    brands = raw.map((b) => ({
      id: b.id,
      name: b.name,
      logoUrl: b.logoUrl || "",
      initial: CatchCatalog.initial(b.name),
    }));
    render();
  })();
});
