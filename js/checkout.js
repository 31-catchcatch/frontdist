(function () {
  "use strict";

  const API_BASE = (window.CATCHCATCH_API_BASE_URL || "/api/v1").replace(/\/$/, "");
  const money = new Intl.NumberFormat("ko-KR");
  // 배송비 정책의 SSOT는 백엔드(OrderService)다. GET /orders/checkout 응답의
  // shippingFee / freeShippingThreshold 를 쓰고, 아래 값은 그 응답을 못 받았을 때만 쓰는 폴백이다.
  const FALLBACK_FREE_SHIPPING_THRESHOLD = 50000;
  const FALLBACK_SHIPPING_FEE = 3000;
  const DIRECT_CHECKOUT_KEY = "catchcatch.directCheckoutItem";
  const CART_CHECKOUT_IDS_KEY = "catchcatch.checkoutCartItemIds";
  // 결제창으로 넘어가기 직전 주문의 { orderId(DB PK), orderNumber }.
  // 결제 실패 랜딩(payment-fail.js)이 어떤 주문을 되돌려야 하는지 알아내는 데 쓴다.
  // 토스는 failUrl 로 주문번호만 돌려주는데 취소 API 는 DB PK 를 받기 때문이다.
  const PENDING_ORDER_KEY = "catchcatch.pendingOrder";
  const DIRECT_CHECKOUT_MODE = new URLSearchParams(location.search).get("mode") === "direct";

  // 현재 연동 범위는 카드 결제뿐이다. 나머지는 백엔드 연동(가상계좌 입금통보 웹훅 등)이
  // 없어 선택할 수 없게 두되, 배열에서 빼지는 않는다 — 나중에 되살릴 자리를 남겨둔다.
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
    pointAmount: document.getElementById("pointAmount"),
    availablePoints: document.getElementById("availablePoints"),
    applyPoints: document.getElementById("applyPoints"),
    paymentMethods: document.getElementById("paymentMethods"),
    paymentEmpty: document.getElementById("paymentEmpty"),
    itemTotal: document.getElementById("itemTotal"),
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
  };

  function getAccessToken() {
    return sessionStorage.getItem("catchcatch.accessToken") || localStorage.getItem("catchcatch.accessToken");
  }

  function unwrapData(payload) {
    return payload && typeof payload === "object" && "data" in payload ? payload.data : payload;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'\"]/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;",
    }[character]));
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

  // 장바구니 페이지(shoppingcart.js)가 "선택 상품 주문하기" 클릭 시 저장해 둔 cartItemId 목록
  function getSelectedCartItemIds() {
    try {
      const raw = sessionStorage.getItem(CART_CHECKOUT_IDS_KEY);
      const ids = raw ? JSON.parse(raw) : [];
      return Array.isArray(ids) ? ids.map(String) : [];
    } catch (_) {
      return [];
    }
  }

  // 상품 상세의 바로구매가 저장한 최소 식별값. 이름·가격·재고는 API에서 다시 확인한다.
  function getDirectCheckoutItem() {
    if (!DIRECT_CHECKOUT_MODE) return null;
    try {
      const raw = sessionStorage.getItem(DIRECT_CHECKOUT_KEY);
      const item = raw ? JSON.parse(raw) : null;
      const productId = Number(item?.productId);
      const optionId = item?.optionId == null ? null : Number(item.optionId);
      const quantity = Number(item?.quantity);
      if (!Number.isInteger(productId) || productId <= 0) return null;
      if (optionId !== null && (!Number.isInteger(optionId) || optionId <= 0)) return null;
      if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 10) return null;
      return { productId, optionId, quantity };
    } catch (_) {
      return null;
    }
  }

  function getSelectedAddress() {
    return state.addresses.find((address) => String(address.id) === String(state.selectedAddressId)) || null;
  }

  function getSelectedCoupon() {
    return state.coupons.find((coupon) => String(coupon.userCouponId) === String(state.selectedCouponId)) || null;
  }

  function computeCouponDiscount(coupon, itemTotal) {
    if (!coupon) return 0;
    if (itemTotal < Number(coupon.minimumOrderAmount || 0)) return 0;

    let discount;
    if (coupon.discountType === "FIXED_AMOUNT") {
      discount = Number(coupon.discountValue) || 0;
    } else {
      discount = Math.floor((itemTotal * (Number(coupon.discountValue) || 0)) / 100);
      if (coupon.maximumDiscountAmount != null) {
        discount = Math.min(discount, Number(coupon.maximumDiscountAmount));
      }
    }
    return Math.min(discount, itemTotal);
  }

  /** 서버가 내려준 배송비 정책. 없으면 폴백 상수. */
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
    const itemTotal = state.cartItems.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);
    const shippingFee = state.cartItems.length === 0 || itemTotal >= policy.threshold ? 0 : policy.fee;
    const couponDiscount = computeCouponDiscount(getSelectedCoupon(), itemTotal);
    const pointsUsed = Math.max(0, Math.min(state.pointAmount, itemTotal + shippingFee - couponDiscount));
    const finalAmount = itemTotal + shippingFee - couponDiscount - pointsUsed;
    return { itemTotal, shippingFee, couponDiscount, pointsUsed, finalAmount };
  }

  function renderItems() {
    const items = state.cartItems;
    elements.itemCount.textContent = `(${items.length})`;
    elements.orderItems.hidden = items.length === 0;
    elements.emptyCart.hidden = items.length !== 0;
    elements.orderItems.innerHTML = items.map((item) => {
      const name = escapeHtml(item.productName || "상품명 없음");
      // 썸네일이 없는 상품은 기존처럼 상품명 첫 글자를 그린다.
      const thumb = item.thumbnailUrl
        ? `<img src="${escapeHtml(item.thumbnailUrl)}" alt="">`
        : `<span aria-hidden="true">${escapeHtml(name.charAt(0) || "C")}</span>`;
      return `<article class="order-item">
        <div class="item-thumb">${thumb}</div>
        <div>
          <strong class="item-name">${name}</strong>
          <p class="item-option">${escapeHtml(item.optionName || "옵션 없음")} · ${Number(item.quantity) || 1}개</p>
        </div>
        <strong class="item-price">${formatMoney(item.totalPrice)}</strong>
      </article>`;
    }).join("");
  }

  function formatAddressDetail(address) {
    return [address.zipCode && `(${address.zipCode})`, address.baseAddress, address.detailAddress].filter(Boolean).join(" ");
  }

  function renderAddress() {
    const address = getSelectedAddress();
    elements.openAddressDialog.disabled = state.addresses.length === 0;
    if (!address) {
      elements.selectedAddress.innerHTML = '<p class="address-empty">선택할 배송지가 없습니다. 배송지 관리에서 배송지를 등록해 주세요.</p>';
      return;
    }
    elements.selectedAddress.innerHTML = `<strong class="address-name">${escapeHtml(address.recipientName)}</strong><span class="address-phone">${escapeHtml(address.recipientPhone)}</span><p class="address-detail">${escapeHtml(formatAddressDetail(address))}</p>`;
  }

  function renderAddressOptions() {
    elements.addressOptions.innerHTML = state.addresses.map((address) => {
      const checked = String(address.id) === String(state.selectedAddressId) ? " checked" : "";
      return `<label class="address-option">
        <input type="radio" name="address" value="${escapeHtml(address.id)}"${checked}>
        <span><strong>${escapeHtml(address.recipientName)}</strong><span>${escapeHtml(address.recipientPhone)}</span><p>${escapeHtml(formatAddressDetail(address))}</p></span>
      </label>`;
    }).join("") || '<p class="section-empty">등록된 배송지가 없습니다.</p>';
  }

  function couponOptionLabel(coupon) {
    const discountLabel = coupon.discountType === "FIXED_AMOUNT"
      ? `${money.format(Number(coupon.discountValue) || 0)}원 할인`
      : `${Number(coupon.discountValue) || 0}% 할인`;
    return `${coupon.couponName || "쿠폰"} · ${discountLabel}`;
  }

  function renderBenefits() {
    elements.couponSelect.disabled = !state.ready;
    elements.couponSelect.innerHTML = `<option value="">쿠폰을 선택하지 않음</option>${state.coupons.map((coupon) => {
      const selected = String(coupon.userCouponId) === String(state.selectedCouponId) ? " selected" : "";
      return `<option value="${escapeHtml(coupon.userCouponId)}"${selected}>${escapeHtml(couponOptionLabel(coupon))}</option>`;
    }).join("")}`;

    const availablePoints = Number(state.defaults && state.defaults.availablePoint) || 0;
    elements.pointAmount.disabled = !state.ready;
    elements.applyPoints.disabled = !state.ready;
    elements.pointAmount.max = String(availablePoints);
    elements.pointAmount.value = String(state.pointAmount || "");
    elements.availablePoints.textContent = `보유 포인트 ${money.format(availablePoints)}P`;
  }

  function renderPayments() {
    const typeOptions = PAYMENT_TYPES.map((type) => {
      const checked = type.id === state.selectedPaymentType ? " checked" : "";
      const disabled = type.enabled ? "" : " disabled";
      const badge = type.enabled ? "" : "<span>준비 중</span>";
      return `<label class="payment-type">
        <input type="radio" name="paymentType" value="${type.id}"${checked}${disabled}>
        <strong>${escapeHtml(type.label)}</strong>
        ${badge}
      </label>`;
    }).join("");
    const selectedType = PAYMENT_TYPES.find((type) => type.id === state.selectedPaymentType) || PAYMENT_TYPES[0];
    elements.paymentMethods.innerHTML = `<div class="payment-type-grid" role="radiogroup" aria-label="결제수단">${typeOptions}</div><div class="payment-detail"><p>${escapeHtml(selectedType.detail)}</p></div>`;
    elements.paymentEmpty.hidden = true;
  }

  function renderSummary() {
    const { itemTotal, shippingFee, couponDiscount, pointsUsed, finalAmount } = summary();
    elements.itemTotal.textContent = formatMoney(itemTotal);
    elements.shippingFee.textContent = formatMoney(shippingFee);
    elements.couponDiscount.textContent = formatDiscount(couponDiscount);
    elements.pointsUsed.textContent = formatDiscount(pointsUsed);
    elements.finalAmount.textContent = formatMoney(finalAmount);
  }

  function updatePayButton() {
    const hasItems = state.cartItems.length > 0;
    const enabled = state.ready && hasItems && state.selectedAddressId && state.selectedPaymentType && !state.paying;
    elements.payButton.disabled = !enabled;
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
    const available = Number(state.defaults && state.defaults.availablePoint) || 0;
    if (!Number.isInteger(value) || value < 0) throw new Error("포인트는 0 이상의 정수로 입력해 주세요.");
    if (value > available) throw new Error(`사용 포인트는 보유 포인트(${money.format(available)}P)를 초과할 수 없습니다.`);
    return value;
  }

  function applyPoints() {
    try {
      state.pointAmount = validatePointAmount();
      setNotice("");
      renderSummary();
      updatePayButton();
    } catch (error) {
      setNotice(error.message);
      elements.pointAmount.focus();
    }
  }

  async function loadCartItems() {
    const selectedIds = getSelectedCartItemIds();
    if (!selectedIds.length) {
      state.cartItems = [];
      return;
    }
    const allItems = await apiFetch("/carts");
    state.cartItems = (Array.isArray(allItems) ? allItems : [])
      .filter((item) => selectedIds.includes(String(item.cartItemId)));
  }

  async function loadDirectItem(requestedItem) {
    const product = await apiFetch(`/products/${encodeURIComponent(requestedItem.productId)}`);
    const options = Array.isArray(product?.options) ? product.options : [];
    const option = requestedItem.optionId == null
      ? null
      : options.find((candidate) => Number(candidate.optionId) === requestedItem.optionId);

    if (!option && (options.length > 0 || requestedItem.optionId !== null)) {
      throw new Error("선택한 상품 옵션을 확인할 수 없습니다. 상품 상세에서 다시 선택해 주세요.");
    }
    if (option && (option.soldOut || Number(option.stockQuantity) < requestedItem.quantity)) {
      throw new Error("선택한 상품의 재고가 부족합니다. 수량을 다시 선택해 주세요.");
    }

    // 주문 API가 계산하는 금액(product.price + option.additionalPrice)과 동일하게 표시한다.
    const unitPrice = Number(product.price || 0) + Number(option?.additionalPrice || 0);
    state.cartItems = [{
      cartItemId: null,
      productId: requestedItem.productId,
      optionId: requestedItem.optionId,
      productName: product.name,
      optionName: option?.optionName || "옵션 없음",
      price: unitPrice,
      quantity: requestedItem.quantity,
      totalPrice: unitPrice * requestedItem.quantity,
      // 장바구니 경유(GET /carts)와 필드명을 맞춘다. renderItems()가 이 값 하나만 본다.
      thumbnailUrl: product.thumbnailUrl || null,
    }];
  }

  // 토스 결제창에 그대로 노출되는 주문명. 토스 제한은 100자다.
  function buildOrderName() {
    const first = state.cartItems[0];
    const name = String(first?.productName || "주문 상품");
    const rest = state.cartItems.length - 1;
    const label = rest > 0 ? `${name} 외 ${rest}건` : name;
    return label.length > 100 ? `${label.slice(0, 99)}…` : label;
  }

  /*
   * 결제가 성사되지 않은 주문을 되돌린다.
   *
   * 주문을 만드는 시점에 재고·쿠폰·포인트가 이미 빠져나가기 때문에, 결제창을 닫으면
   * 그냥 두는 것만으로 그 자원이 잠긴다. 되돌리기에 실패해도 결제 흐름을 막지는 않는다.
   */
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
      // 결제 설정을 주문 생성보다 먼저 받는다. 여기서 실패했는데 주문을 이미 만들었다면
      // 결제창도 못 띄운 채 재고만 잠긴 주문이 남는다.
      const config = await apiFetch("/payments/config");
      if (!config?.clientKey || !config?.successUrl || !config?.failUrl) {
        throw new Error("결제 설정이 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.");
      }

      const coupon = getSelectedCoupon();

      const order = await apiFetch("/orders", {
        method: "POST",
        body: JSON.stringify({
          items: state.cartItems.map((item) => ({
            productId: item.productId,
            optionId: item.optionId,
            quantity: item.quantity,
          })),
          couponId: coupon ? coupon.couponId : null,
          usePoint: state.pointAmount,
          receiverName: address.recipientName,
          receiverPhone: address.recipientPhone,
          zipCode: address.zipCode,
          address: address.baseAddress,
          addressDetail: address.detailAddress,
          deliveryRequest: "",
        }),
      });

      createdOrder = order;
      try {
        sessionStorage.setItem(PENDING_ORDER_KEY, JSON.stringify({
          orderId: order.orderId,
          orderNumber: order.orderNumber,
        }));
      } catch (_) { /* 스토리지가 막혀 있어도 결제 자체는 진행한다 */ }

      /*
       * 토스 결제창 호출. 여기서 페이지를 떠나고, 결제 승인은 successUrl 로 돌아온
       * payment-success.js 가 POST /payments/confirm 으로 마무리한다.
       *
       * 그래서 여기서는 sessionStorage 를 지우지 않는다 — 결제에 실패해 주문서로
       * 돌아왔을 때 장바구니 선택이 남아 있어야 한다. 정리는 승인이 확정된 뒤
       * payment-success.js 가 한다.
       *
       * amount 와 orderId 는 반드시 서버가 준 값을 쓴다.
       *  - amount  : POST /orders 응답의 finalPaymentAmount. 프론트 계산값을 쓰면
       *              승인 단계에서 금액 불일치로 전부 거절된다.
       *  - orderId : order.orderNumber. DB PK(order.orderId)는 1~2자라 토스의
       *              6~64자 제약에 걸린다.
       */
      const toss = window.TossPayments(config.clientKey);
      // 카드 단건 결제라 회원 식별이 필요 없다(백엔드도 customerKey 를 쓰지 않는다).
      // 간편결제·빌링키를 붙일 때 회원 키로 교체해야 한다.
      const payment = toss.payment({ customerKey: window.TossPayments.ANONYMOUS });

      await payment.requestPayment({
        // 결제수단 라디오는 CARD 외 전부 disabled 다. DOM 을 고쳐 다른 값을 넣어도
        // 연동돼 있지 않으므로 여기서 CARD 로 고정한다.
        method: "CARD",
        amount: { currency: "KRW", value: Number(order.finalPaymentAmount) },
        orderId: order.orderNumber,
        orderName: buildOrderName(),
        successUrl: config.successUrl,
        failUrl: config.failUrl,
        card: { useEscrow: false, flowMode: "DEFAULT", useCardPoint: false, useAppCardOnly: false },
      });
    } catch (error) {
      // 주문만 만들어지고 결제가 시작되지 못했으면(결제창을 닫은 경우 포함) 주문을 되돌린다.
      // 주문 생성 전에 실패했다면 되돌릴 것이 없다.
      const canceled = createdOrder
        ? await cancelPendingOrder(
            createdOrder.orderId,
            error?.code === "USER_CANCEL" ? "결제창에서 결제 취소" : "결제 시작 실패"
          )
        : false;
      setNotice(paymentErrorMessage(error, canceled));
      state.paying = false;
      updatePayButton();
    }
  }

  async function initialize() {
    if (!window.CatchAuth || !window.CatchAuth.requireLogin()) return;

    const directItem = getDirectCheckoutItem();
    const selectedCartItemIds = getSelectedCartItemIds();
    const hasCheckoutItems = DIRECT_CHECKOUT_MODE
      ? Boolean(directItem)
      : selectedCartItemIds.length > 0;
    if (!hasCheckoutItems) {
      elements.loading.hidden = true;
      elements.content.hidden = false;
      renderAll();
      setNotice(
        DIRECT_CHECKOUT_MODE
          ? "바로구매 상품 정보가 없습니다. 상품 상세에서 다시 선택해 주세요."
          : "장바구니에서 주문할 상품을 선택해 주세요.",
        "info"
      );
      return;
    }

    try {
      const [defaults, addresses, coupons] = await Promise.all([
        apiFetch("/orders/checkout"),
        apiFetch("/users/me/addresses"),
        apiFetch("/users/me/coupons?size=100"),
        DIRECT_CHECKOUT_MODE ? loadDirectItem(directItem) : loadCartItems(),
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
