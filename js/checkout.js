(function () {
  "use strict";

  const API_BASE = (window.CATCHCATCH_API_BASE_URL || "/api/v1").replace(/\/$/, "");
  const money = new Intl.NumberFormat("ko-KR");
  const FREE_SHIPPING_THRESHOLD = 50000;
  const SHIPPING_FEE = 3000;

  const PAYMENT_TYPES = [
    { id: "CARD", label: "카드", detail: "국내외 신용카드와 체크카드로 결제합니다." },
    { id: "VIRTUAL_ACCOUNT", label: "무통장입금", detail: "주문 완료 후 발급되는 전용 계좌로 입금해 주세요." },
    { id: "BANK_TRANSFER", label: "계좌이체", detail: "본인 명의 계좌에서 즉시 이체합니다." },
    { id: "KAKAO_PAY", label: "카카오페이", detail: "카카오페이로 간편하게 결제합니다." },
    { id: "NAVER_PAY", label: "네이버페이", detail: "네이버페이로 간편하게 결제합니다." },
    { id: "TOSS_PAY", label: "토스페이", detail: "토스페이로 간편하게 결제합니다." },
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
      const raw = sessionStorage.getItem("catchcatch.checkoutCartItemIds");
      const ids = raw ? JSON.parse(raw) : [];
      return Array.isArray(ids) ? ids.map(String) : [];
    } catch (_) {
      return [];
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

  function summary() {
    const itemTotal = state.cartItems.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);
    const shippingFee = state.cartItems.length === 0 || itemTotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
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
      return `<article class="order-item">
        <div class="item-thumb"><span aria-hidden="true">${escapeHtml(name.charAt(0) || "C")}</span></div>
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
      return `<label class="payment-type">
        <input type="radio" name="paymentType" value="${type.id}"${checked}>
        <strong>${escapeHtml(type.label)}</strong>
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
      elements.payHelp.textContent = "결제 승인 결과를 확인하고 있습니다.";
    } else {
      elements.payButton.textContent = "결제하기";
      elements.payHelp.textContent = enabled ? "결제 버튼을 누르면 주문이 완료됩니다." : "배송지와 결제수단을 선택해 주세요.";
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

  async function submitOrder() {
    if (elements.payButton.disabled || state.paying) return;
    const address = getSelectedAddress();
    if (!address) {
      setNotice("배송지를 선택해 주세요.");
      return;
    }

    state.paying = true;
    setNotice("");
    updatePayButton();

    try {
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

      /*
       * 가상 결제 승인 (토스페이먼츠 SDK 연동 전 임시 처리).
       * 실제 PG를 호출하지 않고 /payments/verify 를 바로 호출해 결제를 승인 처리한다.
       * 토스 연동 시: 아래 pgTransactionId를 토스 결제위젯이 돌려주는 실제 paymentKey로 교체하면 됨
       * (백엔드 /payments/verify 계약은 그대로 재사용).
       */
      await apiFetch("/payments/verify", {
        method: "POST",
        body: JSON.stringify({
          orderId: order.orderId,
          pgTransactionId: `MOCK_${order.orderId}_${Date.now()}`,
          payMethod: state.selectedPaymentType,
          pgProvider: "MOCK",
          amount: order.finalPaymentAmount,
        }),
      });

      sessionStorage.removeItem("catchcatch.checkoutCartItemIds");
      location.href = `orders.html?orderId=${encodeURIComponent(order.orderId)}`;
    } catch (error) {
      setNotice(error.message);
      state.paying = false;
      updatePayButton();
    }
  }

  async function initialize() {
    if (!window.CatchAuth || !window.CatchAuth.requireLogin()) return;

    if (!getSelectedCartItemIds().length) {
      elements.loading.hidden = true;
      elements.content.hidden = false;
      renderAll();
      setNotice("장바구니에서 주문할 상품을 선택해 주세요.", "info");
      return;
    }

    try {
      const [defaults, addresses, coupons] = await Promise.all([
        apiFetch("/orders/checkout"),
        apiFetch("/users/me/addresses"),
        apiFetch("/users/me/coupons?size=100"),
        loadCartItems(),
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
