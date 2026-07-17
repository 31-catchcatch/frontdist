document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = (
    window.CATCHCATCH_API_BASE_URL || "/api/v1"
  ).replace(/\/$/, "");

  const DASHBOARD_API = `${API_BASE}/seller/dashboard`;
  const SALES_API = `${API_BASE}/seller/sales`;
  const QNA_API = `${API_BASE}/seller/qna`;

  const FILE_PREVIEW_MODE = location.protocol === "file:";


  const dashboardMessage =
    document.getElementById("dashboardMessage");

  const dashboardSummary =
    document.querySelector(".dashboard-summary");

  const dashboardDate =
    document.getElementById("dashboardDate");

  const todaySales =
    document.getElementById("todaySales");

  const todayOrderCount =
    document.getElementById("todayOrderCount");

  const unansweredQnaCount =
    document.getElementById("unansweredQnaCount");

  const pendingClaimCount =
    document.getElementById("pendingClaimCount");

  const money = new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0
  });

  function isSellerLoggedIn() {
    const loggedIn =
      sessionStorage.getItem("catchcatch.loggedIn") === "true" ||
      Boolean(
        sessionStorage.getItem("catchcatch.accessToken")
      ) ||
      Boolean(
        localStorage.getItem("catchcatch.accessToken")
      );

    const loginType =
      sessionStorage.getItem("catchcatch.loginType");

    return loggedIn && loginType === "seller";
  }

  function moveToSellerLogin() {
    location.replace(
      "login.html?type=seller&redirect=seller-dashboard.html"
    );
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


  function showDashboardMessage(text) {
    if (!dashboardMessage) return;

    dashboardMessage.textContent = text;
    dashboardMessage.hidden = !text;
  }

  function getBody(result) {
    return result?.data ?? result ?? {};
  }

  function formatCount(value) {
    return `${Math.max(
      0,
      Math.trunc(Number(value ?? 0))
    ).toLocaleString("ko-KR")}건`;
  }

  function getToday() {
    const now = new Date();

    const year = now.getFullYear();

    const month = String(
      now.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
      now.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function getTodayLabel() {
    const now = new Date();

    const year = now.getFullYear();

    const month = String(
      now.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
      now.getDate()
    ).padStart(2, "0");

    return `${year}.${month}.${day} 기준`;
  }

  async function getErrorMessage(
    response,
    defaultMessage
  ) {
    try {
      const result = await response.json();

      return (
        result?.message ||
        result?.data?.message ||
        defaultMessage
      );
    } catch {
      return defaultMessage;
    }
  }

  async function request(url, options = {}) {
    const response = await fetch(url, {
      credentials: "include",
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body
          ? { "Content-Type": "application/json" }
          : {}),
        ...(options.headers || {})
      }
    });

    if (
      response.status === 401 ||
      response.status === 403
    ) {
      clearLoginState();
      moveToSellerLogin();
      throw new Error("UNAUTHORIZED");
    }

    if (!response.ok) {
      const errorMessage =
        await getErrorMessage(
          response,
          `요청을 처리하지 못했습니다. (${response.status})`
        );

      throw new Error(errorMessage);
    }

    try {
      return await response.json();
    } catch {
      return {};
    }
  }

  async function loadTodaySales() {
    const today = getToday();

    const params = new URLSearchParams({
      startDate: today,
      endDate: today
    });

    const result = await request(
      `${SALES_API}?${params.toString()}`
    );

    const data = getBody(result);

    return {
      totalSalesAmount: Number(
        data.totalSalesAmount ?? 0
      ),

      orderCount: Number(
        data.orderCount ?? 0
      ),

      totalSoldQuantity: Number(
        data.totalSoldQuantity ?? 0
      )
    };
  }

  async function loadUnansweredQnaCount() {
    const params = new URLSearchParams({
      answered: "false",
      page: "0",
      size: "1"
    });

    const result = await request(
      `${QNA_API}?${params.toString()}`
    );

    const data = getBody(result);

    return Number(
      data.totalElements ?? 0
    );
  }

  async function loadPendingClaimCount() {
    const result = await request(
      DASHBOARD_API
    );

    const data = getBody(result);

    return Number(
      data.pendingClaimCount ?? 0
    );
  }

  function renderDashboard({
    sales,
    qnaCount,
    claimCount
  }) {
    if (todaySales) {
      todaySales.textContent =
        money.format(
          sales.totalSalesAmount
        );
    }

    if (todayOrderCount) {
      todayOrderCount.textContent =
        formatCount(
          sales.orderCount
        );
    }

    if (unansweredQnaCount) {
      unansweredQnaCount.textContent =
        formatCount(qnaCount);
    }

    if (pendingClaimCount) {
      pendingClaimCount.textContent =
        formatCount(claimCount);
    }

    if (dashboardDate) {
      dashboardDate.textContent =
        getTodayLabel();
    }
  }

  async function loadDashboard() {
    if (dashboardSummary) {
      dashboardSummary.setAttribute(
        "aria-busy",
        "true"
      );
    }

    showDashboardMessage("");

    try {
      const [
        sales,
        qnaCount,
        claimCount
      ] = await Promise.all([
        loadTodaySales(),
        loadUnansweredQnaCount(),
        loadPendingClaimCount()
      ]);

      renderDashboard({
        sales,
        qnaCount,
        claimCount
      });
    } catch (error) {
      console.error(
        "판매자 대시보드 조회 오류:",
        error
      );

      if (error.message !== "UNAUTHORIZED") {
        showDashboardMessage(
          error.message ||
          "판매 현황을 불러오지 못했습니다."
        );
      }
    } finally {
      if (dashboardSummary) {
        dashboardSummary.setAttribute(
          "aria-busy",
          "false"
        );
      }
    }
  }


  loadDashboard();
});
