(() => {
  "use strict";

  const COUPON_API = "/api/v1/coupons";
  const FILE_PREVIEW_MODE = location.protocol === "file:";

  const couponList = document.getElementById("couponList");
  const couponCount = document.getElementById("availableCouponCount");
  const couponSort = document.getElementById("couponSort");
  const pageMessage = document.getElementById("pageMessage");

  let coupons = [];

  const previewCoupons = [
    {
      couponId: 101,
      couponName: "신규 회원 환영 쿠폰",
      discountType: "PERCENT",
      discountValue: 15,
      minimumOrderAmount: 30000,
      maximumDiscountAmount: 15000,
      validFrom: "2026-07-01",
      validUntil: "2026-07-31",
      applicableTarget: "전체 상품"
    },
    {
      couponId: 102,
      couponName: "여름 데일리룩 할인",
      discountType: "FIXED",
      discountValue: 5000,
      minimumOrderAmount: 50000,
      maximumDiscountAmount: null,
      validFrom: "2026-07-10",
      validUntil: "2026-08-10",
      applicableTarget: "상의·팬츠 카테고리"
    },
    {
      couponId: 103,
      couponName: "주말 특별 할인 쿠폰",
      discountType: "PERCENT",
      discountValue: 10,
      minimumOrderAmount: 70000,
      maximumDiscountAmount: 10000,
      validFrom: "2026-07-15",
      validUntil: "2026-08-31",
      applicableTarget: "일부 상품 제외"
    }
  ];

  function isLoggedIn() {
    return (
      sessionStorage.getItem("catchcatch.loggedIn") === "true" ||
      Boolean(sessionStorage.getItem("catchcatch.accessToken")) ||
      Boolean(localStorage.getItem("catchcatch.accessToken"))
    );
  }

  function moveToLogin() {
    location.replace(
      `login.html?redirect=${encodeURIComponent("mypage-coupons.html")}`
    );
  }

  function clearLoginState() {
    sessionStorage.removeItem("catchcatch.loggedIn");
    sessionStorage.removeItem("catchcatch.loginType");
    sessionStorage.removeItem("catchcatch.accessToken");
    localStorage.removeItem("catchcatch.accessToken");
  }

  if (!FILE_PREVIEW_MODE && !isLoggedIn()) {
    moveToLogin();
    return;
  }

  function handleUnauthorized(response) {
    if (response.status !== 401 && response.status !== 403) {
      return false;
    }

    clearLoginState();
    moveToLogin();
    return true;
  }

  function showMessage(message) {
    pageMessage.textContent = message;
    pageMessage.classList.add("show");
  }

  function clearMessage() {
    pageMessage.textContent = "";
    pageMessage.classList.remove("show");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatPrice(value) {
    return `${Number(value || 0).toLocaleString("ko-KR")}원`;
  }

  function formatDate(value) {
    if (!value) return "-";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(date);
  }

  function normalizeCoupon(raw) {
    const coupon = raw?.coupon ?? raw ?? {};
    const type = String(
      coupon.discountType ?? coupon.type ?? ""
    ).toUpperCase();

    return {
      couponId:
        coupon.couponId ??
        coupon.userCouponId ??
        coupon.id ??
        "",
      couponName:
        coupon.couponName ??
        coupon.name ??
        coupon.title ??
        "쿠폰",
      discountType:
        ["PERCENT", "PERCENTAGE", "RATE"].includes(type)
          ? "PERCENT"
          : "FIXED",
      discountValue: Number(
        coupon.discountValue ??
        coupon.discountAmount ??
        coupon.discountRate ??
        coupon.value ??
        0
      ),
      minimumOrderAmount: Number(
        coupon.minimumOrderAmount ??
        coupon.minOrderAmount ??
        coupon.minimumPurchaseAmount ??
        0
      ),
      maximumDiscountAmount:
        coupon.maximumDiscountAmount ??
        coupon.maxDiscountAmount ??
        coupon.discountLimit ??
        null,
      validFrom:
        coupon.validFrom ??
        coupon.startDate ??
        coupon.issuedAt ??
        "",
      validUntil:
        coupon.validUntil ??
        coupon.expiredAt ??
        coupon.expirationDate ??
        coupon.endDate ??
        "",
      applicableTarget:
        coupon.applicableTarget ??
        coupon.targetDescription ??
        coupon.applicableProducts ??
        coupon.conditionDescription ??
        "사용 조건에 맞는 상품"
    };
  }

  function extractCoupons(data) {
    const body = data?.data ?? data ?? {};
    const items =
      body.coupons ??
      body.items ??
      body.content ??
      body.list ??
      (Array.isArray(body) ? body : []);

    return Array.isArray(items)
      ? items.map(normalizeCoupon)
      : [];
  }

  function getDiscountText(coupon) {
    return coupon.discountType === "PERCENT"
      ? `${coupon.discountValue}%`
      : formatPrice(coupon.discountValue);
  }

  function getConditionText(coupon) {
    const conditions = [];

    if (coupon.minimumOrderAmount > 0) {
      conditions.push(
        `${formatPrice(coupon.minimumOrderAmount)} 이상 구매 시`
      );
    }

    if (
      coupon.discountType === "PERCENT" &&
      Number(coupon.maximumDiscountAmount) > 0
    ) {
      conditions.push(
        `최대 ${formatPrice(coupon.maximumDiscountAmount)} 할인`
      );
    }

    if (coupon.applicableTarget) {
      conditions.push(coupon.applicableTarget);
    }

    return conditions.join(" · ") || "사용 조건 없음";
  }

  function getRemainingDays(validUntil) {
    if (!validUntil) return null;

    const endDate = new Date(validUntil);
    if (Number.isNaN(endDate.getTime())) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    return Math.ceil(
      (endDate.getTime() - today.getTime()) /
      (1000 * 60 * 60 * 24)
    );
  }

  function getSortedCoupons() {
    const sorted = [...coupons];

    if (couponSort.value === "discount") {
      return sorted.sort((a, b) => {
        const aValue =
          a.discountType === "PERCENT"
            ? a.discountValue * 1000
            : a.discountValue;
        const bValue =
          b.discountType === "PERCENT"
            ? b.discountValue * 1000
            : b.discountValue;
        return bValue - aValue;
      });
    }

    if (couponSort.value === "name") {
      return sorted.sort((a, b) =>
        a.couponName.localeCompare(b.couponName, "ko")
      );
    }

    return sorted.sort((a, b) => {
      const aDate = new Date(a.validUntil).getTime();
      const bDate = new Date(b.validUntil).getTime();

      if (Number.isNaN(aDate)) return 1;
      if (Number.isNaN(bDate)) return -1;
      return aDate - bDate;
    });
  }

  function renderCoupons() {
    const sortedCoupons = getSortedCoupons();

    couponCount.textContent =
      coupons.length.toLocaleString("ko-KR");

    if (!sortedCoupons.length) {
      couponList.innerHTML = `
        <p class="coupon-state">
          현재 사용할 수 있는 쿠폰이 없습니다.
        </p>
      `;
      return;
    }

    couponList.innerHTML = sortedCoupons.map((coupon) => {
      const remainingDays = getRemainingDays(coupon.validUntil);
      const remainingText =
        remainingDays === null
          ? ""
          : remainingDays < 0
            ? "기간 만료"
            : remainingDays === 0
              ? "오늘까지"
              : `D-${remainingDays}`;

      const expiryClass =
        remainingDays !== null && remainingDays <= 7
          ? "expiry-soon"
          : "";

      return `
        <article class="coupon-card">
          <div class="coupon-benefit">
            <strong>${escapeHtml(getDiscountText(coupon))}</strong>
            <span>
              ${coupon.discountType === "PERCENT"
                ? "할인"
                : "금액 할인"}
            </span>
          </div>

          <div class="coupon-content">
            <span class="coupon-label">사용 가능</span>

            <h3 title="${escapeHtml(coupon.couponName)}">
              ${escapeHtml(coupon.couponName)}
            </h3>

            <p class="coupon-condition">
              ${escapeHtml(getConditionText(coupon))}
            </p>

            <p class="coupon-date">
              유효기간
              <strong>
                ${escapeHtml(formatDate(coupon.validFrom))}
                –
                ${escapeHtml(formatDate(coupon.validUntil))}
              </strong>
              ${
                remainingText
                  ? `<span class="${expiryClass}">
                      · ${escapeHtml(remainingText)}
                    </span>`
                  : ""
              }
            </p>
          </div>
        </article>
      `;
    }).join("");
  }

  async function loadCoupons() {
    clearMessage();

    if (FILE_PREVIEW_MODE) {
      coupons = previewCoupons.map(normalizeCoupon);
      renderCoupons();
      return;
    }

    try {
      const response = await fetch(COUPON_API, {
        method: "GET",
        credentials: "include"
      });

      if (handleUnauthorized(response)) return;

      let data = {};
      try {
        data = await response.json();
      } catch (_) {}

      if (!response.ok) {
        throw new Error(
          data.message || "보유 쿠폰을 불러오지 못했습니다."
        );
      }

      coupons = extractCoupons(data);
      renderCoupons();
    } catch (error) {
      couponList.innerHTML = `
        <p class="coupon-state">
          보유 쿠폰을 불러오지 못했습니다.
        </p>
      `;

      showMessage(
        error instanceof TypeError
          ? "쿠폰 조회 서버에 연결할 수 없습니다."
          : error.message
      );
    }
  }

  couponSort.addEventListener("change", renderCoupons);
  loadCoupons();
})();
