document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = (window.CATCHCATCH_API_BASE_URL || "/api/v1").replace(/\/$/, "");
  const DASHBOARD_API = `${API_BASE}/seller/dashboard`;
  const COUPON_REQUEST_API = `${API_BASE}/seller/coupons/request`;
  const FILE_PREVIEW_MODE = location.protocol === "file:";

  const form = document.getElementById("couponRequestForm");
  const message = document.getElementById("couponMessage");
  const submitButton = document.getElementById("couponRequestSubmit");
  const dashboardMessage = document.getElementById("dashboardMessage");
  const dashboardSummary = document.querySelector(".dashboard-summary");
  const dashboardDate = document.getElementById("dashboardDate");
  const todaySales = document.getElementById("todaySales");
  const salesChangeRate = document.getElementById("salesChangeRate");
  const todayOrderCount = document.getElementById("todayOrderCount");
  const unansweredQnaCount = document.getElementById("unansweredQnaCount");
  const pendingClaimCount = document.getElementById("pendingClaimCount");

  const money = new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0
  });

  function isSellerLoggedIn() {
    const loggedIn =
      sessionStorage.getItem("catchcatch.loggedIn") === "true" ||
      Boolean(sessionStorage.getItem("catchcatch.accessToken")) ||
      Boolean(localStorage.getItem("catchcatch.accessToken"));

    return loggedIn && sessionStorage.getItem("catchcatch.loginType") === "seller";
  }

  function moveToSellerLogin() {
    location.replace("login.html?type=seller&redirect=seller-dashboard.html");
  }

  function clearLoginState() {
    sessionStorage.removeItem("catchcatch.loggedIn");
    sessionStorage.removeItem("catchcatch.loginType");
    sessionStorage.removeItem("catchcatch.accessToken");
    localStorage.removeItem("catchcatch.accessToken");
  }

  if (!FILE_PREVIEW_MODE && !isSellerLoggedIn()) {
    moveToSellerLogin();
    return;
  }

  function showCouponMessage(text, type = "error") {
    message.textContent = text;
    message.classList.toggle("success", type === "success");
  }

  function showDashboardMessage(text) {
    dashboardMessage.textContent = text;
    dashboardMessage.hidden = !text;
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

  function formatCount(value) {
    return value === undefined
      ? "-"
      : `${Math.max(0, Math.trunc(value)).toLocaleString("ko-KR")}건`;
  }

  function formatDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return `${value} 기준`;

    const formatted = new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(date).replaceAll(". ", ".").replace(/\.$/, "");

    return `${formatted} 기준`;
  }

  function formatRate(value) {
    if (value === undefined) return "전일 대비 -";
    const rounded = Math.round(value * 10) / 10;
    return `전일 대비 ${rounded > 0 ? "+" : ""}${rounded.toLocaleString("ko-KR")}%`;
  }

  async function request(url, options = {}) {
    const response = await fetch(url, {
      credentials: "include",
      ...options
    });

    if (response.status === 401 || response.status === 403) {
      clearLoginState();
      moveToSellerLogin();
      throw new Error("UNAUTHORIZED");
    }

    let data = {};
    try {
      data = await response.json();
    } catch (_) {
      // 응답 본문이 없거나 JSON이 아닌 경우에도 상태 코드로 처리한다.
    }

    if (!response.ok) {
      throw new Error(data.message || "요청을 처리하지 못했습니다.");
    }

    return data;
  }

  function renderDashboard(data) {
    const body = getBody(data);
    const summary = body.summary ?? body.dashboard ?? body;
    const salesAmount = toNumber(getFirstValue(summary, ["todaySalesAmount", "todaySales", "salesAmount", "sales"]));
    const salesRate = toNumber(getFirstValue(summary, ["salesChangeRate", "dayOverDaySalesRate", "salesGrowthRate"]));
    const orderCount = toNumber(getFirstValue(summary, ["todayOrderCount", "newOrderCount", "orderCount"]));
    const qnaCount = toNumber(getFirstValue(summary, ["unansweredQnaCount", "pendingQnaCount", "unansweredQuestionCount"]));
    const claimCount = toNumber(getFirstValue(summary, ["pendingClaimCount","claimCount"]));
    const asOfDate = getFirstValue(summary, ["asOfDate", "summaryDate", "date", "today"]);

    todaySales.textContent = salesAmount === undefined ? "-" : money.format(salesAmount);
    salesChangeRate.textContent = formatRate(salesRate);
    todayOrderCount.textContent = formatCount(orderCount);
    unansweredQnaCount.textContent = formatCount(qnaCount);
    pendingClaimCount.textContent = formatCount(claimCount);
    dashboardDate.textContent = formatDate(asOfDate);
  }

  async function loadDashboard() {
    dashboardSummary.setAttribute("aria-busy", "true");
    showDashboardMessage("");

    try {
      const data = await request(DASHBOARD_API);
      renderDashboard(data);
    } catch (error) {
      if (error.message !== "UNAUTHORIZED") {
        showDashboardMessage(error.message || "판매 현황을 불러오지 못했습니다.");
      }
    } finally {
      dashboardSummary.setAttribute("aria-busy", "false");
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const requiredFields = ["couponName", "discount", "minPrice", "quantity", "startDate", "endDate"];
    const missingField = requiredFields
      .map((id) => document.getElementById(id))
      .find((field) => !field.value.trim());

    if (missingField) {
      showCouponMessage("쿠폰 발행에 필요한 항목을 모두 입력해주세요.");
      missingField.focus();
      return;
    }

    const startDate = document.getElementById("startDate").value;
    const endDate = document.getElementById("endDate").value;
    if (startDate >= endDate) {
      showCouponMessage("사용 종료일은 시작일보다 이후여야 합니다.");
      document.getElementById("endDate").focus();
      return;
    }

    const maxDiscount = document.getElementById("maxDiscount").value;
    const payload = {
      couponName: document.getElementById("couponName").value.trim(),
      discountType: document.getElementById("couponType").value,
      discountValue: Number(document.getElementById("discount").value),
      minimumOrderAmount: Number(document.getElementById("minPrice").value),
      maximumDiscountAmount: maxDiscount ? Number(maxDiscount) : 0,
      totalQuantity: Number(document.getElementById("quantity").value),
      validFrom: startDate,
      validUntil: endDate
};

    try {
      submitButton.disabled = true;
      submitButton.textContent = "요청 등록 중...";
      await request(COUPON_REQUEST_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      form.reset();
      showCouponMessage("쿠폰 발행 승인 요청이 등록되었습니다.", "success");
      await loadDashboard();
    } catch (error) {
      if (error.message !== "UNAUTHORIZED") {
        showCouponMessage(error.message || "쿠폰 발행 승인 요청에 실패했습니다.");
      }
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "쿠폰 발행 승인 요청";
    }
  });

  loadDashboard();
});
