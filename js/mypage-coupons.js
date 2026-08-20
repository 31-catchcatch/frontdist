(() => {
  "use strict";

  const CLAIMABLE_API = "/api/v1/coupons";        // 받을 수 있는(아직 안 받은) 쿠폰 목록
  const MINE_API = "/api/v1/users/me/coupons";    // 내가 보유한 쿠폰 목록
  const FILE_PREVIEW_MODE = location.protocol === "file:";

  const couponList = document.getElementById("couponList");
  const couponCount = document.getElementById("availableCouponCount");
  const couponSort = document.getElementById("couponSort");
  const pageMessage = document.getElementById("pageMessage");
  const couponTabs = document.querySelectorAll(".coupon-tab");
  const panelTitle = document.getElementById("couponPanelTitle");
  const panelDesc = document.getElementById("couponPanelDesc");

  let coupons = [];
  let claimableCount = 0;   // 탭 배지·빈 화면 안내에 쓴다
  let currentTab = "mine"; // 'mine'(보유) | 'claimable'(받을 수 있는)
  let mineCount = 0;       // 상단 '사용 가능 쿠폰' 개수 = 보유 쿠폰 수 (탭 무관)

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
    // [5-1 조치] 토큰 저장 키를 직접 읽지 않고 공용 인증 모듈에 위임한다.
    return Boolean(window.CatchAuth && CatchAuth.isLoggedIn());
  }

  function moveToLogin() {
    location.replace(
      `login.html?redirect=${encodeURIComponent("mypage-coupons.html")}`
    );
  }

  function clearLoginState() {
    // [5-1 조치] 저장 키 직접 접근 제거. 화면 이동은 기존처럼 각 호출부가 담당한다.
    if (window.CatchAuth) CatchAuth.clearSession();
  }

  if (!FILE_PREVIEW_MODE && !isLoggedIn()) {
    moveToLogin();
    return;
  }
  if (!FILE_PREVIEW_MODE && window.CatchAuth) { CatchAuth.requireRole(); }

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
        "",
      // 쿠폰이 어느 판매자 것인지. 관리자가 발행한 플랫폼 쿠폰은 둘 다 null 이라
      // 사용 범위가 주문 전체다.
      sellerId: coupon.sellerId ?? null,
      sellerName: coupon.sellerName ?? null
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

  /* 이 쿠폰을 어디에 쓸 수 있는지. 쿠폰은 발행한 판매자의 상품에만 적용된다. */
  function getScopeText(coupon) {
    return coupon.sellerName || "해당 판매자 상품";
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
      conditions.push(esc(coupon.applicableTarget));
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

  /* 받기 탭에 개수 배지를 붙인다.
     기본 탭이 '보유 쿠폰'이라, 새로 발행된 쿠폰이 있어도 탭을 눌러보기 전엔 알 수가 없었다. */
  function updateClaimableBadge() {
    const tab = [...couponTabs].find((t) => t.dataset.tab === "claimable");
    if (!tab) return;
    const base = "받을 수 있는 쿠폰";
    tab.textContent = claimableCount > 0 ? `${base} ${claimableCount}` : base;
    tab.classList.toggle("has-badge", claimableCount > 0);
  }

  function renderCoupons() {
    const sortedCoupons = getSortedCoupons();

    // 상단 '사용 가능 쿠폰' = 보유 쿠폰 개수(항상). 받기 탭 목록 길이가 아니라 보유 수를 표시한다.
    couponCount.textContent =
      mineCount.toLocaleString("ko-KR");

    if (!sortedCoupons.length) {
      // 보유 쿠폰이 없어도 받을 게 있으면 그쪽으로 안내한다 (그냥 "없습니다"로 끝내면
      // 발행된 쿠폰이 있는 줄도 모르고 나가게 된다)
      const hasClaimable = currentTab !== "claimable" && claimableCount > 0;
      couponList.innerHTML = `
        <p class="coupon-state">
          ${currentTab === "claimable"
            ? "받을 수 있는 쿠폰이 없습니다."
            : "보유한 쿠폰이 없습니다."}
          ${hasClaimable
            ? `<br><button type="button" class="coupon-state-link" data-action="go-claimable">
                 지금 받을 수 있는 쿠폰 ${claimableCount}장 보기
               </button>`
            : ""}
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
            <strong>${getDiscountText(coupon)}</strong>
            <span>
              ${coupon.discountType === "PERCENT"
                ? "할인"
                : "금액 할인"}
            </span>
          </div>

          <div class="coupon-content">
            <span class="coupon-label">${currentTab === "claimable" ? "받기 가능" : "사용 가능"}</span>
            <span class="coupon-seller">${esc(getScopeText(coupon))}</span>

            <h3 title="${esc(coupon.couponName)}">
              ${esc(coupon.couponName)}
            </h3>

            <p class="coupon-condition">
              ${getConditionText(coupon)}
            </p>

            <p class="coupon-date">
              유효기간
              <strong>
                ${formatDate(coupon.validFrom)}
                –
                ${formatDate(coupon.validUntil)}
              </strong>
              ${
                remainingText
                  ? `<span class="${expiryClass}">
                      · ${remainingText}
                    </span>`
                  : ""
              }
            </p>

            ${
              currentTab === "claimable"
                ? `<button type="button" class="coupon-claim-btn" data-coupon-id="${coupon.couponId}">쿠폰 받기</button>`
                : ""
            }
          </div>
        </article>
      `;
    }).join("");
  }

  /* 받기 가능 개수만 따로 센다. 보유 탭을 보고 있을 때도 배지를 띄워야 하기 때문이다.
     실패해도 화면은 그대로 두고 배지만 생략한다. */
  async function refreshClaimableCount() {
    if (FILE_PREVIEW_MODE) return;
    try {
      const response = await fetch(CLAIMABLE_API, { method: "GET", credentials: "include" });
      if (!response.ok) return;
      const data = await response.json();
      claimableCount = extractCoupons(data).length;
      updateClaimableBadge();

      // 개수는 목록보다 늦게 도착한다. 보유 탭이 비어 있는 상태였다면
      // 안내 문구를 넣기 위해 한 번 더 그린다.
      if (currentTab !== "claimable" && coupons.length === 0) {
        renderCoupons();
      }
    } catch (_) {
      /* 배지는 부가 정보라 조용히 넘어간다 */
    }
  }

  async function loadCoupons() {
    clearMessage();

    const isClaimable = currentTab === "claimable";

    // 패널 제목/설명을 탭에 맞게 갱신
    if (panelTitle) panelTitle.textContent = isClaimable ? "받을 수 있는 쿠폰" : "보유 쿠폰";
    if (panelDesc) {
      panelDesc.textContent = isClaimable
        ? "'쿠폰 받기'를 누르면 보유 쿠폰으로 이동합니다."
        : "유효기간이 가까운 순서로 표시됩니다.";
    }

    if (FILE_PREVIEW_MODE) {
      coupons = previewCoupons.map(normalizeCoupon);
      renderCoupons();
      return;
    }

    couponList.innerHTML = `<p class="coupon-state">쿠폰을 불러오는 중입니다.</p>`;

    try {
      const response = await fetch(isClaimable ? CLAIMABLE_API : MINE_API, {
        method: "GET",
        credentials: "include"
      });

      if (handleUnauthorized(response)) return;

      let data = {};
      try {
        data = await response.json();
      } catch (_) {}

      if (!response.ok) {
        throw new Error(data.message || "쿠폰을 불러오지 못했습니다.");
      }

      coupons = extractCoupons(data);
      // 보유 탭을 로드할 때만 '사용 가능 쿠폰(보유)' 개수를 실제 목록으로 동기화한다.
      if (!isClaimable) mineCount = coupons.length;
      else {
        claimableCount = coupons.length;   // 받기 탭을 보고 있으면 그 결과가 곧 최신 개수
        updateClaimableBadge();
      }
      renderCoupons();
    } catch (error) {
      couponList.innerHTML = `
        <p class="coupon-state">
          쿠폰을 불러오지 못했습니다.
        </p>
      `;

      showMessage(
        error instanceof TypeError
          ? "쿠폰 조회 서버에 연결할 수 없습니다."
          : error.message
      );
    }
  }

  // '쿠폰 받기' 버튼 → 발급(claim) → 목록에서 제거(받기 목록 갱신)
  async function claimCoupon(couponId, buttonEl) {
    clearMessage();
    if (buttonEl) {
      buttonEl.disabled = true;
      buttonEl.textContent = "받는 중…";
    }

    try {
      const response = await fetch(`/api/v1/coupons/${encodeURIComponent(couponId)}/claim`, {
        method: "POST",
        credentials: "include"
      });

      if (handleUnauthorized(response)) return;

      let data = {};
      try {
        data = await response.json();
      } catch (_) {}

      if (!response.ok) {
        // 이미 받았거나(409) 소진 등 → 메시지 노출 후 목록 갱신
        throw new Error(data.message || "쿠폰을 받지 못했습니다.");
      }

      mineCount += 1; // 받았으니 보유 쿠폰이 하나 늘어남 → 상단 '사용 가능 쿠폰' 증가
      showMessage("쿠폰을 받았습니다. '보유 쿠폰' 탭에서 확인할 수 있습니다.");
      loadCoupons(); // 받기 목록 재조회 → 방금 받은 쿠폰은 제외되어 사라짐
    } catch (error) {
      showMessage(
        error instanceof TypeError
          ? "쿠폰 서버에 연결할 수 없습니다."
          : error.message
      );
      if (buttonEl) {
        buttonEl.disabled = false;
        buttonEl.textContent = "쿠폰 받기";
      }
    }
  }

  // 탭 전환
  couponTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const next = tab.dataset.tab;
      if (!next || next === currentTab) return;
      currentTab = next;

      couponTabs.forEach((t) => {
        const active = t.dataset.tab === currentTab;
        t.classList.toggle("is-active", active);
        t.setAttribute("aria-selected", active ? "true" : "false");
      });

      loadCoupons();
    });
  });

  // 받기 버튼 이벤트 위임
  couponList.addEventListener("click", (event) => {
    const btn = event.target.closest(".coupon-claim-btn");
    if (!btn) return;
    claimCoupon(btn.dataset.couponId, btn);
  });

  couponSort.addEventListener("change", renderCoupons);

  // 빈 화면에서 '받을 수 있는 쿠폰 보기'를 누르면 탭을 옮긴다
  couponList.addEventListener("click", (event) => {
    if (!event.target.closest('[data-action="go-claimable"]')) return;
    const tab = [...couponTabs].find((t) => t.dataset.tab === "claimable");
    if (tab) tab.click();
  });
  loadCoupons();
  refreshClaimableCount();
})();
