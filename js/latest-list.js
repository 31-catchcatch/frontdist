// latest-list.js — 최근 본 상품 목록 (U-MY-008, localStorage 방식)
// 데이터 출처: js/recent-products.js (CatchRecent) — 상품 상세 진입 시 기록됨
// 백엔드 API 호출 없음.

document.addEventListener("DOMContentLoaded", () => {

  // 마이페이지 하위 기능이므로 로그인 필요 (정의서 U-MY-008 기준)
  if (
    window.CatchAuth &&
    typeof CatchAuth.requireLogin === "function" &&
    !CatchAuth.requireLogin()
  ) {
    return;
  }

  const listEl = document.querySelector(".product-list");
  if (!listEl) {
    console.error("최근 본 상품 목록 영역(.product-list)을 찾지 못했습니다.");
    return;
  }

  if (!window.CatchRecent) {
    console.error("js/recent-products.js 가 로드되지 않았습니다.");
    listEl.innerHTML = "";
    return;
  }

  const won = (n) =>
    (n == null || Number.isNaN(Number(n)))
      ? "-"
      : Number(n).toLocaleString("ko-KR") + "원";

  const escapeHTML = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  // ISO 문자열 → "2026.07.16 09:32"
  function formatViewedAt(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function renderMessage(html) {
    listEl.innerHTML = `
      <div style="grid-column:1/-1; text-align:center; padding:60px 20px; color:#999;">
        ${html}
      </div>
    `;
  }

  const products = CatchRecent.list();

  if (products.length === 0) {
    renderMessage(`
      최근 본 상품이 없습니다.<br><br>
      <a href="product-list.html" style="color:#333; text-decoration:underline;">상품 둘러보러 가기</a>
    `);
    return;
  }

  listEl.innerHTML = products.map((p) => {
    const thumb = p.thumbnailUrl
      ? escapeHTML(p.thumbnailUrl)
      : "https://placehold.co/600x800/f0f0f0/999?text=NO+IMAGE";

    const priceHtml = (p.discountRate > 0 && p.finalPrice != null)
      ? `<span class="sale-rate" style="color:#e74c3c; margin-right:6px;">${Number(p.discountRate)}%</span>${won(p.finalPrice)}`
      : won(p.finalPrice ?? p.price);

    return `
      <div class="product-item">
        <a href="product-detail.html?id=${Number(p.productId)}" style="text-decoration:none; color:inherit;">
          <div class="product-image">
            <img src="${thumb}" alt="${escapeHTML(p.name)}"
                 onerror="this.src='https://placehold.co/600x800/f0f0f0/999?text=NO+IMAGE'">
          </div>
          <div class="product-info">
            <p class="brand-name">${escapeHTML(p.brandName || "")}</p>
            <h4>${escapeHTML(p.name)}</h4>
            <p class="price">${priceHtml}</p>
            <p class="view-time">방문일시 : ${formatViewedAt(p.viewedAt)}</p>
          </div>
        </a>
      </div>
    `;
  }).join("");
});
