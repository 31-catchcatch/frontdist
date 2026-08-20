(function () {
  "use strict";

  const API_BASE = (window.CATCHCATCH_API_BASE_URL || "/api/v1").replace(/\/$/, "");
  const money = new Intl.NumberFormat("ko-KR");
  const FALLBACK_FREE_SHIPPING_THRESHOLD = 50000;
  const FALLBACK_SHIPPING_FEE = 3000;
  const PENDING_ORDER_KEY = "catchcatch.pendingOrder";
  // [1-3 조치] 주문 대상은 서버가 확정한 초안(draft)으로만 다룬다.
  //   장바구니/상품상세에서 POST /orders/prepare 로 초안을 만들고 그 식별자만 넘겨받는다.
  //   화면이 상품·수량을 직접 들고 있지 않으므로 변조할 대상 자체가 없다.
  const DRAFT_ID = new URLSearchParams(location.search).get("draft");

  const PAYMENT_TYPES = [
    { id: "CARD", label: "카드", detail: "국내외 신용카드와 체크카드로 결제합니다.", enabled: true },
    { id: "VIRTUAL_ACCOUNT", label: "무통장입금", detail: "주문 완료 후 발급되는 전용 계좌로 입금해 주세요.", enabled: false },
    { id: "BANK_TRANSFER", label: "계좌이체", detail: "본인 명의 계좌에서 즉시 이체합니다.", enabled: false },
    { id: "KAKAO_PAY", label: "카카오페이", detail: "카카오페이로 간편하게 결제합니다.", enabled: false },
    { id: "NAVER_PAY", label: "네이버페이", detail: "네이버페이로 간편하게 결제합니다.", enabled: false },
    { id: "TOSS_PAY", label: "토스페이", detail: "토스페이로 간편하게 결제합니다.", enabled: false },
  ];

  const elements = {
    loading: document.getElementById("checkoutLoading"),
    content: document.getElementById("checkoutContent"),
    notice: document.getElementById("checkoutNotice"),
    orderItems: document.getElementById("orderItems"),
    itemCount: document.getElementById("itemCount"),
    emptyCart: document.getElementById("emptyCart"),
    selectedAddress: document.getElementById("selectedAddress"),
    openAddressDialog: document.getElementById("openAddressDialog"),
    addressDialog: document.getElementById("addressDialog"),
    addressOptions: document.getElementById("addressOptions"),
    couponSelect: document.getElementById("couponSelect"),
    couponScope: document.getElementById("couponScope"),
    pointAmount: document.getElementById("pointAmount"),
    availablePoints: document.getElementById("availablePoints"),
    applyPoints: document.getElementById("applyPoints"),
    paymentMethods: document.getElementById("paymentMethods"),
    paymentEmpty: document.getElementById("paymentEmpty"),
    itemTotal: document.getElementById("itemTotal"),
    productDiscountRow: document.getElementById("productDiscountRow"),
    productDiscount: document.getElementById("productDiscount"),
    shippingFee: document.getElementById("shippingFee"),
    couponDiscount: document.getElementById("couponDiscount"),
    pointsUsed: document.getElementById("pointsUsed"),
    finalAmount: document.getElementById("finalAmount"),
    payButton: document.getElementById("payButton"),
    payHelp: document.getElementById("payHelp"),
  };

  const state = {
    ready: false,
    cartItems: [],
    defaults: null,
    addresses: [],
    coupons: [],
    selectedAddressId: null,
    selectedCouponId: "",
    pointAmount: 0,
    selectedPaymentType: "CARD",
    paying: false,
    // 초안은 주문 생성 시 서버에서 소멸한다. 한 번 소진되면 이 화면으로는 다시 결제할 수 없다.
    draftConsumed: false,
  };

  function getAccessToken() {
    // [5-1 조치] 저장 키를 직접 읽지 않는다.
    return window.CatchAuth ? CatchAuth.getToken() : null;
  }

  function unwrapData(payload) {
    return payload && typeof payload === "object" && "data" in payload ? payload.data : payload;
  }

  function formatMoney(value) {
    return `${money.format(Math.max(0, Number(value) || 0))}원`;
  }

  function formatDiscount(value) {
    return `-${formatMoney(value)}`;
  }

  function setNotice(message, type = "error") {
    if (!message) {
      elements.notice.hidden = true;
      elements.notice.textContent = "";
      delete elements.notice.dataset.type;
      return;
    }
    elements.notice.hidden = false;
    elements.notice.dataset.type = type;
    elements.notice.textContent = message;
  }

  async function apiFetch(path, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set("Accept", "application/json");
    if (options.body) headers.set("Content-Type", "application/json");
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);

    const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
    if (response.status === 401) {
      const here = location.pathname.split("/").pop() + location.search;
      location.href = `login.html?redirect=${encodeURIComponent(here)}`;
      throw new Error("로그인이 필요합니다.");
    }

    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;
    if (!response.ok) {
      const detail = unwrapData(payload) || payload || {};
      throw new Error(detail.message || payload?.message || "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
    return unwrapData(payload);
  }

  function getSelectedAddress() {
    return state.addresses.find((address) => String(address.id) === String(state.selectedAddressId)) || null;
  }

  function itemsTotal() {
    return state.cartItems.reduce((sum, item) => sum + (Number(item.totalPrice) || 0), 0);
  }

  /** 상품 할인 전 금액. originalPrice 를 안 내려주는 응답에서는 판매가와 같아져 할인 0으로 보인다. */
  function itemsOriginalTotal() {
    return state.cartItems.reduce((sum, item) => {
      const unit = Number(item.originalPrice ?? item.price) || 0;
      return sum + unit * (Number(item.quantity) || 0);
    }, 0);
  }

  /**
   * 주문 상품을 판매자별 금액으로 모은다.
   * 판매자를 알 수 없는 상품이 하나라도 있으면 범위를 가릴 수 없으므로 null 을 돌려준다.
   */
  function sellerAmounts() {
    const amounts = new Map();
    for (const item of state.cartItems) {
      if (item.sellerId == null) return null;
      const key = String(item.sellerId);
      amounts.set(key, (amounts.get(key) || 0) + (Number(item.totalPrice) || 0));
    }
    return amounts;
  }

  function getSelectedCoupon() {
    return state.coupons.find((coupon) => String(coupon.userCouponId) === String(state.selectedCouponId)) || null;
  }

  /**
   * 쿠폰이 적용되는 범위와 그 금액. 쿠폰은 발행한 판매자의 상품 금액에만 적용된다.
   * 서버 OrderService.placeOrder 와 같은 규칙이라 화면 금액과 서버가 확정하는 금액이 어긋나지 않는다.
   * 최소 주문금액도 전체가 아닌 "적용 대상 금액" 으로 판정한다.
   */
  function couponScope(coupon) {
    if (!coupon) return null;
    const amounts = sellerAmounts();
    // 판매자 정보를 못 받은 응답에서는 예전처럼 전체 금액 기준으로 둔다.
    const wholeOrder = coupon.sellerId == null || amounts === null;
    const amount = wholeOrder ? itemsTotal() : (amounts.get(String(coupon.sellerId)) || 0);
    const minimum = Number(coupon.minimumOrderAmount) || 0;

    let reason = "";
    if (amount <= 0) reason = "해당 판매자 상품 없음";
    else if (amount < minimum) reason = `최소 주문금액 ${money.format(minimum)}원 미달`;

    return { wholeOrder, amount, minimum, usable: reason === "", reason };
  }

  function computeCouponDiscount(coupon, applicableAmount) {
    if (!coupon || applicableAmount <= 0) return 0;

    let discount;
    if (coupon.discountType === "FIXED_AMOUNT") {
      discount = Number(coupon.discountValue) || 0;
    } else {
      discount = Math.floor((applicableAmount * (Number(coupon.discountValue) || 0)) / 100);
      if (coupon.maximumDiscountAmount != null) {
        discount = Math.min(discount, Number(coupon.maximumDiscountAmount));
      }
    }
    return Math.min(discount, applicableAmount);
  }

  /** 실제로 적용 가능한 쿠폰만 돌려준다. 결제 요청도 이걸 기준으로 보낸다. */
  function getUsableSelectedCoupon() {
    const coupon = getSelectedCoupon();
    const scope = couponScope(coupon);
    return scope && scope.usable ? coupon : null;
  }

  function availablePoints() {
    return Math.max(0, Number(state.defaults && state.defaults.availablePoint) || 0);
  }

  /** 이 주문에서 실제로 쓸 수 있는 포인트 상한 (보유 포인트와 결제 금액 중 작은 쪽). */
  function pointLimit() {
    return summary().pointLimit;
  }

  function shippingPolicy() {
    const fee = Number(state.defaults?.shippingFee);
    const threshold = Number(state.defaults?.freeShippingThreshold);
    return {
      fee: Number.isFinite(fee) ? fee : FALLBACK_SHIPPING_FEE,
      threshold: Number.isFinite(threshold) ? threshold : FALLBACK_FREE_SHIPPING_THRESHOLD,
    };
  }

  function summary() {
    const policy = shippingPolicy();
    const itemTotal = itemsTotal();
    const shippingFee = state.cartItems.length === 0 || itemTotal >= policy.threshold ? 0 : policy.fee;
    const coupon = getSelectedCoupon();
    const scope = couponScope(coupon);
    const couponDiscount = scope && scope.usable ? computeCouponDiscount(coupon, scope.amount) : 0;
    // 결제 금액을 넘는 포인트는 서버 placeOrder 가 INVALID_INPUT 으로 거부하므로 상한을 함께 잡는다.
    const usablePoint = Math.max(0, Math.min(availablePoints(), itemTotal + shippingFee - couponDiscount));
    const pointsUsed = Math.max(0, Math.min(state.pointAmount, usablePoint));
    const finalAmount = itemTotal + shippingFee - couponDiscount - pointsUsed;
    const originalTotal = itemsOriginalTotal();
    return {
      itemTotal, shippingFee, couponDiscount, pointsUsed, finalAmount,
      pointLimit: usablePoint,
      originalTotal,
      productDiscount: Math.max(0, originalTotal - itemTotal),
    };
  }

  function renderItems() {
    const items = state.cartItems;
    elements.itemCount.textContent = `(${items.length})`;
    elements.orderItems.hidden = items.length === 0;
    elements.emptyCart.hidden = items.length !== 0;
    elements.orderItems.innerHTML = items.map((item) => {
      const name = item.productName || "상품명 없음";
      // 썸네일이 없는 상품은 기존처럼 상품명 첫 글자를 그린다.
      const thumb = item.thumbnailUrl
        ? `<img src="${esc(item.thumbnailUrl)}" alt="">`
        : `<span aria-hidden="true">${name.charAt(0) || "C"}</span>`;
      return `<article class="order-item">
        <div class="item-thumb">${thumb}</div>
        <div>
          <strong class="item-name">${esc(name)}</strong>
          <p class="item-option">${esc(item.optionName || "옵션 없음")} · ${Number(item.quantity) || 1}개</p>
        </div>
        <strong class="item-price">${formatMoney(item.totalPrice)}</strong>
      </article>`;
    }).join("");
  }

  function formatAddressDetail(address) {
    return [address.zipCode && `(${esc(address.zipCode)})`, esc(address.baseAddress), esc(address.detailAddress)].filter(Boolean).join(" ");
  }

  function renderAddress() {
    const address = getSelectedAddress();
    elements.openAddressDialog.disabled = state.addresses.length === 0;
    if (!address) {
      elements.selectedAddress.innerHTML = '<p class="address-empty">선택할 배송지가 없습니다. 배송지 관리에서 배송지를 등록해 주세요.</p>';
      return;
    }
    elements.selectedAddress.innerHTML = `<strong class="address-name">${esc(address.recipientName)}</strong><span class="address-phone">${esc(address.recipientPhone)}</span><p class="address-detail">${formatAddressDetail(address)}</p>`;
  }

  function renderAddressOptions() {
    elements.addressOptions.innerHTML = state.addresses.map((address) => {
      const checked = String(address.id) === String(state.selectedAddressId) ? " checked" : "";
      return `<label class="address-option">
        <input type="radio" name="address" value="${address.id}"${checked}>
        <span><strong>${esc(address.recipientName)}</strong><span>${esc(address.recipientPhone)}</span><p>${formatAddressDetail(address)}</p></span>
      </label>`;
    }).join("") || '<p class="section-empty">등록된 배송지가 없습니다.</p>';
  }

  function couponOptionLabel(coupon, scope) {
    const discountLabel = coupon.discountType === "FIXED_AMOUNT"
      ? `${money.format(Number(coupon.discountValue) || 0)}원 할인`
      : `${Number(coupon.discountValue) || 0}% 할인`;
    const label = `${coupon.couponName || "쿠폰"} · ${discountLabel}`;
    // 못 쓰는 쿠폰은 사유를 붙여 왜 선택이 안 되는지 알 수 있게 한다.
    return esc(scope.usable ? label : `${label} — ${scope.reason}`);
  }

  function couponSellerLabel(coupon) {
    return coupon.sellerName ? `${coupon.sellerName} 상품` : "해당 판매자 상품";
  }

  /** 선택한 쿠폰이 어디에 적용되는지 - 여러 판매자가 섞인 장바구니에서 특히 중요하다. */
  function renderCouponScope() {
    const coupon = getSelectedCoupon();
    const scope = couponScope(coupon);
    if (!coupon || !scope) {
      elements.couponScope.hidden = true;
      elements.couponScope.textContent = "";
      delete elements.couponScope.dataset.state;
      return;
    }

    elements.couponScope.hidden = false;
    if (!scope.usable) {
      elements.couponScope.dataset.state = "blocked";
      elements.couponScope.textContent = `이 주문에는 사용할 수 없는 쿠폰입니다. (${scope.reason})`;
      return;
    }

    elements.couponScope.dataset.state = "applied";
    elements.couponScope.textContent = scope.wholeOrder
      ? `주문 상품 전체 ${formatMoney(scope.amount)}에 적용됩니다.`
      : `${couponSellerLabel(coupon)} ${formatMoney(scope.amount)}에 적용됩니다.`;
  }

  function renderBenefits() {
    elements.couponSelect.disabled = !state.ready;
    elements.couponSelect.innerHTML = `<option value="">쿠폰을 선택하지 않음</option>${state.coupons.map((coupon) => {
      const scope = couponScope(coupon);
      const selected = String(coupon.userCouponId) === String(state.selectedCouponId) ? " selected" : "";
      const disabled = scope.usable ? "" : " disabled";
      return `<option value="${coupon.userCouponId}"${selected}${disabled}>${couponOptionLabel(coupon, scope)}</option>`;
    }).join("")}`;
    renderPointInput();
  }

  function renderPointInput() {
    const available = availablePoints();
    const limit = pointLimit();
    elements.pointAmount.disabled = !state.ready;
    elements.applyPoints.disabled = !state.ready;
    // 결제 금액이 보유 포인트보다 적으면 그쪽이 상한이다. 입력칸 max 와 안내 문구에 함께 반영한다.
    elements.pointAmount.max = String(limit);
    elements.pointAmount.value = String(state.pointAmount || "");
    elements.availablePoints.textContent = limit < available
      ? `보유 포인트 ${money.format(available)}P · 이 주문 최대 ${money.format(limit)}P`
      : `보유 포인트 ${money.format(available)}P`;
  }

  function renderPayments() {
    const typeOptions = PAYMENT_TYPES.map((type) => {
      const checked = type.id === state.selectedPaymentType ? " checked" : "";
      const disabled = type.enabled ? "" : " disabled";
      const badge = type.enabled ? "" : "<span>준비 중</span>";
      return `<label class="payment-type">
        <input type="radio" name="paymentType" value="${type.id}"${checked}${disabled}>
        <strong>${type.label}</strong>
        ${badge}
      </label>`;
    }).join("");
    const selectedType = PAYMENT_TYPES.find((type) => type.id === state.selectedPaymentType) || PAYMENT_TYPES[0];
    elements.paymentMethods.innerHTML = `<div class="payment-type-grid" role="radiogroup" aria-label="결제수단">${typeOptions}</div><div class="payment-detail"><p>${selectedType.detail}</p></div>`;
    elements.paymentEmpty.hidden = true;
  }

  function renderSummary() {
    renderCouponScope();
    const { originalTotal, productDiscount, shippingFee, couponDiscount, pointsUsed, finalAmount } = summary();
    // '상품 금액' 은 할인 전 금액을 보여주고, 깎인 만큼을 바로 아래 줄에 따로 세운다.
    elements.itemTotal.textContent = formatMoney(originalTotal);
    elements.productDiscountRow.hidden = productDiscount <= 0;
    elements.productDiscount.textContent = formatDiscount(productDiscount);
    elements.shippingFee.textContent = formatMoney(shippingFee);
    elements.couponDiscount.textContent = formatDiscount(couponDiscount);
    elements.pointsUsed.textContent = formatDiscount(pointsUsed);
    elements.finalAmount.textContent = formatMoney(finalAmount);
  }

  function updatePayButton() {
    const hasItems = state.cartItems.length > 0;
    // draftConsumed 를 여기서 함께 본다. 배송지·결제수단을 다시 고르면 이 함수가 또 불리는데,
    // 그때 버튼이 되살아나면 이미 소멸한 초안으로 결제를 다시 시도하게 된다.
    const enabled = state.ready && hasItems && state.selectedAddressId && state.selectedPaymentType
      && !state.paying && !state.draftConsumed;
    elements.payButton.disabled = !enabled;
    if (state.draftConsumed && !state.paying) {
      elements.payButton.textContent = "결제하기";
      elements.payHelp.textContent = "이 주문서는 사용이 끝났습니다. 상품을 다시 선택해 주세요.";
      return;
    }
    if (state.paying) {
      elements.payButton.textContent = "결제를 진행하고 있습니다";
      elements.payHelp.textContent = "결제창을 여는 중입니다. 창을 닫지 마세요.";
    } else {
      elements.payButton.textContent = "결제하기";
      elements.payHelp.textContent = enabled ? "결제 버튼을 누르면 결제창이 열립니다." : "배송지와 결제수단을 선택해 주세요.";
    }
  }

  function renderAll() {
    renderItems();
    renderAddress();
    renderAddressOptions();
    renderBenefits();
    renderPayments();
    renderSummary();
    updatePayButton();
  }

  function validatePointAmount() {
    const raw = elements.pointAmount.value.trim();
    const value = raw === "" ? 0 : Number(raw);
    const available = availablePoints();
    if (!Number.isInteger(value) || value < 0) throw new Error("포인트는 0 이상의 정수로 입력해 주세요.");
    if (value > available) throw new Error(`사용 포인트는 보유 포인트(${money.format(available)}P)를 초과할 수 없습니다.`);
    // 결제 금액을 넘는 만큼은 서버가 받지 않는다. 막지 말고 상한까지만 받아 준다.
    return Math.min(value, pointLimit());
  }

  /** 쿠폰이 바뀌면 결제 금액이 줄어 포인트 상한도 내려간다. 넘친 만큼을 깎고 깎였는지 알려 준다. */
  function clampPointToLimit() {
    const limit = pointLimit();
    if (state.pointAmount <= limit) return false;
    state.pointAmount = limit;
    renderPointInput();
    return true;
  }

  function applyPoints() {
    try {
      const raw = elements.pointAmount.value.trim();
      const requested = raw === "" ? 0 : Number(raw);
      state.pointAmount = validatePointAmount();
      renderPointInput();
      setNotice(
        requested > state.pointAmount
          ? `결제 금액보다 많은 포인트는 사용할 수 없어 ${money.format(state.pointAmount)}P 로 맞췄습니다.`
          : "",
        "info"
      );
      renderSummary();
      updatePayButton();
    } catch (error) {
      setNotice(error.message);
      elements.pointAmount.focus();
    }
  }

  /**
   * [1-3 조치] 서버가 확정해 둔 주문 초안을 화면 표시용으로 가져온다.
   * 금액은 서버가 잡은 unitPrice/lineAmount 를 그대로 쓴다. 화면이 다시 계산하면
   * 결제 금액과 어긋날 수 있으므로 여기서는 받은 값을 옮겨 담기만 한다.
   * originalPrice/sellerId 는 초안이 내려주면 쓰고, 없으면 각각 할인 0·전체 주문 기준으로 폴백한다.
   */
  async function loadDraft() {
    const draft = await apiFetch(`/orders/draft/${encodeURIComponent(DRAFT_ID)}`);
    const items = Array.isArray(draft?.items) ? draft.items : [];
    if (!items.length) {
      throw new Error("주문 정보를 확인할 수 없습니다. 상품을 다시 선택해 주세요.");
    }
    state.cartItems = items.map((item) => {
      const unitPrice = Number(item.unitPrice) || 0;
      const quantity = Number(item.quantity) || 0;
      return {
        cartItemId: item.cartItemId ?? null,
        productId: item.productId,
        sellerId: item.sellerId ?? null,
        sellerName: item.sellerName || null,
        optionId: item.optionId,
        productName: item.productName,
        optionName: item.optionName || "옵션 없음",
        price: unitPrice,
        originalPrice: Number(item.originalUnitPrice ?? unitPrice) || 0,
        quantity: quantity,
        totalPrice: Number(item.lineAmount ?? unitPrice * quantity) || 0,
        thumbnailUrl: item.thumbnailUrl || null,
      };
    });
  }

  function buildOrderName() {
    const first = state.cartItems[0];
    const name = String(first?.productName || "주문 상품");
    const rest = state.cartItems.length - 1;
    const label = rest > 0 ? `${name} 외 ${rest}건` : name;
    return label.length > 100 ? `${label.slice(0, 99)}…` : label;
  }

  async function cancelPendingOrder(orderId, reason) {
    try {
      await apiFetch(`/orders/${encodeURIComponent(orderId)}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      sessionStorage.removeItem(PENDING_ORDER_KEY);
      return true;
    } catch (_) {
      return false;
    }
  }

  function paymentErrorMessage(error, canceled) {
    if (error && error.code === "USER_CANCEL") {
      return canceled
        ? "결제를 취소했습니다."
        : "결제를 취소했습니다. 주문 내역에서 결제되지 않은 주문을 확인해 주세요.";
    }
    const base = (error && (error.message || error.code)) || "결제를 시작하지 못했습니다.";
    return canceled ? `${base} 결제가 완료되지 않아 주문을 취소했습니다.` : base;
  }

  async function submitOrder() {
    if (elements.payButton.disabled || state.paying) return;
    const address = getSelectedAddress();
    if (!address) {
      setNotice("배송지를 선택해 주세요.");
      return;
    }
    if (typeof window.TossPayments !== "function") {
      setNotice("결제 모듈을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.");
      return;
    }

    state.paying = true;
    setNotice("");
    updatePayButton();

    let createdOrder = null;
    try {
      const config = await apiFetch("/payments/config");
      if (!config?.clientKey || !config?.successUrl || !config?.failUrl) {
        throw new Error("결제 설정이 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.");
      }

      const coupon = getUsableSelectedCoupon();

      const order = await apiFetch("/orders", {
        method: "POST",
        body: JSON.stringify({
          // [1-3 조치] 상품·수량은 보내지 않는다. 서버가 draftId 로 확정해 둔 내용만 사용한다.
          draftId: DRAFT_ID,
          couponId: coupon ? coupon.couponId : null,
          usePoint: summary().pointsUsed,
          receiverName: address.recipientName,
          receiverPhone: address.recipientPhone,
          zipCode: address.zipCode,
          address: address.baseAddress,
          addressDetail: address.detailAddress,
          deliveryRequest: "",
        }),
      });

      createdOrder = order;
      // 주문이 만들어진 시점에 서버는 이 초안을 소멸시킨다. 결제가 실패해도 같은 draftId 로
      // 다시 주문할 수 없으므로, 이 뒤로는 화면을 재사용하지 못하게 잠근다.
      state.draftConsumed = true;
      try {
        sessionStorage.setItem(PENDING_ORDER_KEY, JSON.stringify({
          orderId: order.orderId,
          orderNumber: order.orderNumber,
        }));
      } catch (_) { /* 스토리지가 막혀 있어도 결제 자체는 진행한다 */ }

      const toss = window.TossPayments(config.clientKey);
      const payment = toss.payment({ customerKey: window.TossPayments.ANONYMOUS });

      await payment.requestPayment({
        method: "CARD",
        amount: { currency: "KRW", value: Number(order.finalPaymentAmount) },
        orderId: order.orderNumber,
        orderName: buildOrderName(),
        successUrl: config.successUrl,
        failUrl: config.failUrl,
        card: { useEscrow: false, flowMode: "DEFAULT", useCardPoint: false, useAppCardOnly: false },
      });
    } catch (error) {
      const canceled = createdOrder
        ? await cancelPendingOrder(
            createdOrder.orderId,
            error?.code === "USER_CANCEL" ? "결제창에서 결제 취소" : "결제 시작 실패"
          )
        : false;
      state.paying = false;
      setNotice(
        state.draftConsumed
          ? `${paymentErrorMessage(error, canceled)} 상품을 다시 선택해 주세요.`
          : paymentErrorMessage(error, canceled),
        state.draftConsumed ? "info" : "error"
      );
      updatePayButton();
    }
  }

  async function initialize() {
    if (!window.CatchAuth || !window.CatchAuth.requireLogin()) return;

    // [1-3 조치] draftId 없이는 주문서를 열 수 없다. 주소로 직접 들어와도 살 것이 없다.
    if (!DRAFT_ID) {
      elements.loading.hidden = true;
      elements.content.hidden = false;
      renderAll();
      setNotice("주문 정보가 없습니다. 장바구니나 상품 상세에서 다시 선택해 주세요.", "info");
      return;
    }

    try {
      const [defaults, addresses, coupons] = await Promise.all([
        apiFetch("/orders/checkout"),
        apiFetch("/users/me/addresses"),
        apiFetch("/users/me/coupons?size=100"),
        loadDraft(),
      ]);
      state.defaults = defaults;
      state.addresses = Array.isArray(addresses) ? addresses : [];
      state.coupons = Array.isArray(coupons?.content) ? coupons.content : [];
      state.selectedAddressId = (state.addresses.find((address) => address.defaultAddress) || state.addresses[0] || {}).id || null;
      state.ready = true;

      elements.loading.hidden = true;
      elements.content.hidden = false;
      renderAll();
    } catch (error) {
      elements.loading.hidden = true;
      setNotice(error.message);
    }
  }

  elements.openAddressDialog.addEventListener("click", () => elements.addressDialog.showModal());
  elements.addressDialog.addEventListener("click", (event) => { if (event.target === elements.addressDialog) elements.addressDialog.close(); });
  elements.addressOptions.addEventListener("change", (event) => {
    if (!event.target.matches('input[name="address"]')) return;
    state.selectedAddressId = event.target.value;
    elements.addressDialog.close();
    renderAddress();
    updatePayButton();
  });
  elements.couponSelect.addEventListener("change", () => {
    state.selectedCouponId = elements.couponSelect.value;

    // 할인이 늘면 결제 금액이 줄어 이미 넣어 둔 포인트가 상한을 넘길 수 있다.
    if (clampPointToLimit()) {
      setNotice(`쿠폰 할인이 적용되어 사용 포인트를 ${money.format(state.pointAmount)}P 로 맞췄습니다.`, "info");
    }

    renderSummary();
  });
  elements.applyPoints.addEventListener("click", applyPoints);
  elements.pointAmount.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); applyPoints(); } });
  elements.paymentMethods.addEventListener("change", (event) => {
    if (event.target.matches('input[name="paymentType"]')) {
      state.selectedPaymentType = event.target.value;
      renderPayments();
      updatePayButton();
    }
  });
  elements.payButton.addEventListener("click", submitOrder);
  document.addEventListener("DOMContentLoaded", initialize);
})();
