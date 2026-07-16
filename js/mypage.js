// mypage.js — 회원 유형에 맞는 회원정보 수정 페이지 연결 및 쇼핑 정보 요약 조회
document.addEventListener("DOMContentLoaded", () => {
  const accountEditLink = document.querySelector('[data-role="account-edit-link"]');
  const summaryGrid = document.querySelector(".summary-grid");
  const summaryElements = {
    coupons: document.querySelector('[data-role="summary-coupons"]'),
    points: document.querySelector('[data-role="summary-points"]'),
    recentProducts: document.querySelector('[data-role="summary-recent-products"]'),
    reviews: document.querySelector('[data-role="summary-reviews"]')
  };

  const loginType = sessionStorage.getItem("catchcatch.loginType");
  if (accountEditLink) {
    accountEditLink.href = loginType === "seller"
      ? "seller-mypage-edit.html"
      : "mypage-edit.html";
  }

  if (!summaryGrid || !window.CatchAuth || !CatchAuth.requireLogin()) return;

  const API_BASE = (window.CATCHCATCH_API_BASE_URL || "/api/v1").replace(/\/$/, "");
  const endpoints = {
    coupons: "/users/me/coupons",
    points: "/users/me/points",
    reviews: "/users/me/reviews"
  };

  // 최근 본 상품(U-MY-008)은 localStorage 방식으로 확정되어 API를 호출하지 않는다.
  // js/recent-products.js(CatchRecent)가 있으면 그 개수를, 없으면 키를 직접 읽는다.
  function getRecentProductCount() {
    try {
      if (window.CatchRecent) return CatchRecent.count();
      const raw = localStorage.getItem("catchcatch.recentProducts");
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch (_) {
      return 0;
    }
  }

  function getBody(data) {
    return data?.data ?? data ?? {};
  }

  function getFirstValue(source, keys) {
    for (const key of keys) {
      const value = source?.[key];
      if (value !== null && value !== undefined && value !== "") return value;
    }
    return undefined;
  }

  function toNumber(value) {
    if (typeof value === "object") return undefined;
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
  }

  function getCollectionCount(data, countKeys, collectionKeys) {
    const body = getBody(data);
    const count = toNumber(getFirstValue(body, countKeys));
    if (count !== undefined) return Math.max(0, Math.trunc(count));

    for (const key of collectionKeys) {
      const items = body?.[key];
      if (Array.isArray(items)) return items.length;
    }

    return Array.isArray(body) ? body.length : undefined;
  }

  function getPointBalance(data) {
    const body = getBody(data);
    const value = getFirstValue(body, [
      "pointBalance",
      "availablePoints",
      "availablePoint",
      "balance",
      "totalPoints",
      "totalPoint",
      "points",
      "point"
    ]);
    return toNumber(value);
  }

  async function fetchSummaryData(path) {
    const response = await fetch(`${API_BASE}${path}`, {
      method: "GET",
      credentials: "include"
    });

    if (response.status === 401 || response.status === 403) {
      CatchAuth.logout();
      throw new Error("UNAUTHORIZED");
    }

    let data = {};
    try {
      data = await response.json();
    } catch (_) {
      // 오류 응답이 JSON이 아닌 경우에도 상태 코드로 처리한다.
    }

    if (!response.ok) throw new Error(data.message || "SUMMARY_LOAD_FAILED");
    return data;
  }

  function renderValue(element, value, suffix) {
    if (!element) return;
    if (value === undefined) {
      element.textContent = "-";
      element.removeAttribute("title");
      return;
    }

    element.textContent = `${value.toLocaleString("ko-KR")}${suffix}`;
    element.removeAttribute("title");
  }

  async function loadShoppingSummary() {
    const results = await Promise.allSettled(
      Object.entries(endpoints).map(async ([key, path]) => [key, await fetchSummaryData(path)])
    );

    const dataByKey = Object.fromEntries(
      results
        .filter((result) => result.status === "fulfilled")
        .map((result) => result.value)
    );

    renderValue(
      summaryElements.coupons,
      getCollectionCount(dataByKey.coupons, ["availableCouponCount", "couponCount", "totalElements", "count"], ["coupons", "items", "content", "list"]),
      "장"
    );
    renderValue(summaryElements.points, getPointBalance(dataByKey.points), "P");
    renderValue(
      summaryElements.recentProducts,
      getRecentProductCount(),
      "개"
    );
    renderValue(
      summaryElements.reviews,
      getCollectionCount(dataByKey.reviews, ["reviewCount", "totalElements", "count"], ["reviews", "items", "content", "list"]),
      "개"
    );

    summaryGrid.setAttribute("aria-busy", "false");
  }

  loadShoppingSummary().catch(() => {
    summaryGrid.setAttribute("aria-busy", "false");
  });
});
