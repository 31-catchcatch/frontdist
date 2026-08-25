(function () {
  "use strict";

  const API_BASE = (window.CATCHCATCH_API_BASE_URL || "/api/v1").replace(/\/$/, "");
  const money = new Intl.NumberFormat("ko-KR");
  const FALLBACK_FREE_SHIPPING_THRESHOLD = 50000;
  const FALLBACK_SHIPPING_FEE = 3000;
  const PENDING_ORDER_KEY = "catchcatch.pendingOrder";


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

    draftConsumed: false,
  };

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


  function itemsOriginalTotal() {
    return state.cartItems.reduce((sum, item) => {
      const unit = Number(item.originalPrice ?? item.price) || 0;
      return sum + unit * (Number(item.quantity) || 0);
    }, 0);
  }


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


  function couponScope(coupon) {
    if (!coupon) return null;
    const amounts = sellerAmounts();

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


  function getUsableSelectedCoupon() {
    const coupon = getSelectedCoupon();
    const scope = couponScope(coupon);
    return scope && scope.usable ? coupon : null;
  }

  function availablePoints() {
    return Math.max(0, Number(state.defaults && state.defaults.availablePoint) || 0);
  }


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

    return esc(scope.usable ? label : `${label} — ${scope.reason}`);
  }

  function couponSellerLabel(coupon) {
    return coupon.sellerName ? `${coupon.sellerName} 상품` : "해당 판매자 상품";
  }


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

    return Math.min(value, pointLimit());
  }


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


      state.draftConsumed = true;
      try {
        sessionStorage.setItem(PENDING_ORDER_KEY, JSON.stringify({
          orderId: order.orderId,
          orderNumber: order.orderNumber,
        }));
      } catch (_) {  }

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
