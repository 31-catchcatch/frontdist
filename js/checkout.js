(function () {
  "use strict";

  const API_BASE = (window.CATCHCATCH_API_BASE_URL || "/api/v1").replace(/\/$/, "");
  const isPreview = new URLSearchParams(location.search).get("preview") === "1" || location.protocol === "file:";
  const money = new Intl.NumberFormat("ko-KR");
  const PAYMENT_TYPES = [
    { id: "CARD", label: "신용/체크카드", detail: "국내외 신용카드와 체크카드로 결제합니다.", supportsSavedMethod: true },
    { id: "VIRTUAL_ACCOUNT", label: "무통장입금", detail: "주문 완료 후 발급되는 전용 계좌로 입금해 주세요.", supportsSavedMethod: false },
    { id: "BANK_TRANSFER", label: "실시간 계좌이체", detail: "본인 명의 계좌에서 즉시 이체합니다.", supportsSavedMethod: false },
    { id: "KAKAO_PAY", label: "카카오페이", detail: "카카오페이로 간편하게 결제합니다.", supportsSavedMethod: true },
    { id: "NAVER_PAY", label: "네이버페이", detail: "네이버페이로 간편하게 결제합니다.", supportsSavedMethod: true },
    { id: "TOSS_PAY", label: "토스페이", detail: "토스페이로 간편하게 결제합니다.", supportsSavedMethod: true },
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
    checkout: null,
    addresses: [],
    payments: [],
    selectedAddressId: null,
    selectedPaymentType: "CARD",
    selectedPaymentId: null,
    selectedCouponId: "",
    pointAmount: 0,
    recalculating: false,
    paying: false,
    checkoutController: null,
    idempotencyKey: createIdempotencyKey(),
  };

  function createIdempotencyKey() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    return `checkout-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

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
      const error = new Error(detail.message || "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      error.code = detail.code;
      error.field = detail.field;
      throw error;
    }
    return unwrapData(payload);
  }

  function checkoutPath() {
    const parameters = new URLSearchParams({ pointAmount: String(state.pointAmount) });
    if (state.selectedCouponId) parameters.set("couponId", state.selectedCouponId);
    if (state.selectedAddressId) parameters.set("addressId", state.selectedAddressId);
    return `/orders/checkout?${parameters.toString()}`;
  }

  function getSelectedAddress() {
    return state.addresses.find((address) => String(address.id) === String(state.selectedAddressId)) || null;
  }

  function selectedSummary() {
    return state.checkout && state.checkout.summary ? state.checkout.summary : {};
  }

  function createPreviewCheckout() {
    const itemTotal = 109000;
    const shippingFee = 3000;
    const couponDiscount = state.selectedCouponId === "welcome-7000" ? 7000 : 0;
    const pointsUsed = Math.min(state.pointAmount, itemTotal + shippingFee - couponDiscount);
    return {
      checkoutId: "preview-checkout-001",
      items: [
        { brand: "STANDARD", name: "릴렉스 코튼 반팔 티셔츠", optionLabel: "오프화이트 / M", quantity: 1, unitPrice: 19900, linePrice: 19900 },
        { brand: "STANDARD", name: "와이드 핏 데님 팬츠", optionLabel: "딥블루 / 30", quantity: 1, unitPrice: 89100, linePrice: 89100 },
      ],
      availableCoupons: [
        { id: "welcome-7000", name: "첫 구매 감사 쿠폰", discountLabel: "7,000원 할인", eligible: true },
        { id: "outer-10000", name: "아우터 전용 쿠폰", discountLabel: "10,000원 할인", eligible: false },
      ],
      availablePoints: 12000,
      defaultAddressId: "address-home",
      summary: {
        itemTotal,
        shippingFee,
        couponDiscount,
        pointsUsed,
        finalAmount: itemTotal + shippingFee - couponDiscount - pointsUsed,
      },
    };
  }

  function previewAddresses() {
    return [
      { id: "address-home", recipient: "김캐치", phone: "010-1234-5678", postalCode: "04782", address1: "서울특별시 성동구 연무장길 24", address2: "101동 1203호", isDefault: true },
      { id: "address-office", recipient: "김캐치", phone: "010-1234-5678", postalCode: "06164", address1: "서울특별시 강남구 테헤란로 123", address2: "캐치빌딩 8층", isDefault: false },
    ];
  }

  function previewPayments() {
    return [
      { id: "payment-card", provider: "신용카드", label: "현대카드", maskedNumber: "1234-****-****-5678", isDefault: true },
      { id: "payment-kakao", provider: "간편결제", label: "카카오페이", maskedNumber: "등록된 결제수단", isDefault: false },
    ];
  }

  function renderItems() {
    const items = Array.isArray(state.checkout && state.checkout.items) ? state.checkout.items : [];
    elements.itemCount.textContent = `(${items.length})`;
    elements.orderItems.hidden = items.length === 0;
    elements.emptyCart.hidden = items.length !== 0;
    elements.orderItems.innerHTML = items.map((item) => {
      const name = escapeHtml(item.name || item.productName || "상품명 없음");
      const thumbnail = item.thumbnailUrl
        ? `<img src="${escapeHtml(item.thumbnailUrl)}" alt="${name}">`
        : `<span aria-hidden="true">${escapeHtml(name.charAt(0) || "C")}</span>`;
      const quantity = Number(item.quantity) || 1;
      const price = item.linePrice ?? item.totalPrice ?? ((Number(item.unitPrice) || 0) * quantity);
      return `<article class="order-item">
        <div class="item-thumb">${thumbnail}</div>
        <div>
          <span class="item-brand">${escapeHtml(item.brand || item.sellerName || "CATCHCATCH")}</span>
          <strong class="item-name">${name}</strong>
          <p class="item-option">${escapeHtml(item.optionLabel || item.option || "옵션 정보 없음")} · ${quantity}개</p>
        </div>
        <strong class="item-price">${formatMoney(price)}</strong>
      </article>`;
    }).join("");
  }

  function renderAddress() {
    const address = getSelectedAddress();
    elements.openAddressDialog.disabled = state.addresses.length === 0;
    if (!address) {
      elements.selectedAddress.innerHTML = '<p class="address-empty">선택할 배송지가 없습니다. 배송지 관리에서 배송지를 등록해 주세요.</p>';
      return;
    }
    const detail = [address.postalCode && `(${address.postalCode})`, address.address1, address.address2].filter(Boolean).join(" ");
    elements.selectedAddress.innerHTML = `<strong class="address-name">${escapeHtml(address.recipient)}</strong><span class="address-phone">${escapeHtml(address.phone)}</span><p class="address-detail">${escapeHtml(detail)}</p>`;
  }

  function renderAddressOptions() {
    elements.addressOptions.innerHTML = state.addresses.map((address) => {
      const checked = String(address.id) === String(state.selectedAddressId) ? " checked" : "";
      const detail = [address.postalCode && `(${address.postalCode})`, address.address1, address.address2].filter(Boolean).join(" ");
      return `<label class="address-option">
        <input type="radio" name="address" value="${escapeHtml(address.id)}"${checked}>
        <span><strong>${escapeHtml(address.recipient)}</strong><span>${escapeHtml(address.phone)}</span><p>${escapeHtml(detail)}</p></span>
      </label>`;
    }).join("") || '<p class="section-empty">등록된 배송지가 없습니다.</p>';
  }

  function renderBenefits() {
    const coupons = Array.isArray(state.checkout && state.checkout.availableCoupons) ? state.checkout.availableCoupons : [];
    const validCoupon = coupons.some((coupon) => coupon.eligible !== false && String(coupon.id) === String(state.selectedCouponId));
    if (!validCoupon) state.selectedCouponId = "";
    elements.couponSelect.disabled = !state.checkout || state.recalculating;
    elements.couponSelect.innerHTML = `<option value="">쿠폰을 선택하지 않음</option>${coupons.map((coupon) => {
      const disabled = coupon.eligible === false ? " disabled" : "";
      const selected = String(coupon.id) === String(state.selectedCouponId) ? " selected" : "";
      const suffix = coupon.discountLabel ? ` · ${coupon.discountLabel}` : "";
      return `<option value="${escapeHtml(coupon.id)}"${disabled}${selected}>${escapeHtml(coupon.name || "쿠폰")}${escapeHtml(suffix)}${coupon.eligible === false ? " (사용 불가)" : ""}</option>`;
    }).join("")}`;
    const availablePoints = Number(state.checkout && state.checkout.availablePoints) || 0;
    elements.pointAmount.disabled = !state.checkout || state.recalculating;
    elements.applyPoints.disabled = !state.checkout || state.recalculating;
    elements.pointAmount.max = String(availablePoints);
    elements.pointAmount.value = String(state.pointAmount || "");
    elements.availablePoints.textContent = `보유 포인트 ${money.format(availablePoints)}P`;
  }

  function renderPayments() {
    const methods = state.payments;
    if (state.selectedPaymentId && !methods.some((method) => String(method.id) === String(state.selectedPaymentId))) {
      state.selectedPaymentId = null;
    }
    const selectedType = PAYMENT_TYPES.find((type) => type.id === state.selectedPaymentType) || PAYMENT_TYPES[0];
    const typeOptions = PAYMENT_TYPES.map((type) => {
      const checked = type.id === selectedType.id ? " checked" : "";
      const shortLabel = type.label.replace("신용/체크", "카드").replace("실시간 ", "");
      return `<label class="payment-type">
        <input type="radio" name="paymentType" value="${type.id}"${checked}>
        <strong>${escapeHtml(shortLabel)}</strong><span>${escapeHtml(type.id === "VIRTUAL_ACCOUNT" ? "가상계좌" : type.id === "BANK_TRANSFER" ? "계좌이체" : "간편 결제")}</span>
      </label>`;
    }).join("");
    const savedSelector = selectedType.supportsSavedMethod && methods.length
      ? `<label class="saved-payment-select">등록 결제수단 (선택)
          <select name="savedPaymentMethod">
            <option value="">새 결제수단으로 진행</option>
            ${methods.map((method) => `<option value="${escapeHtml(method.id)}"${String(method.id) === String(state.selectedPaymentId) ? " selected" : ""}>${escapeHtml(method.label || method.provider || "등록 결제수단")} ${escapeHtml(method.maskedNumber || "")}</option>`).join("")}
          </select>
        </label>`
      : "";
    elements.paymentMethods.innerHTML = `<div class="payment-type-grid" role="radiogroup" aria-label="결제수단">${typeOptions}</div><div class="payment-detail"><p>${escapeHtml(selectedType.detail)}</p>${savedSelector}</div>`;
    if (selectedType.supportsSavedMethod && !methods.length) {
      elements.paymentEmpty.hidden = false;
      elements.paymentEmpty.textContent = "등록된 결제수단이 없어도 새 결제수단으로 진행할 수 있습니다.";
    } else {
      elements.paymentEmpty.hidden = true;
      elements.paymentEmpty.textContent = "";
    }
  }

  function renderSummary() {
    const summary = selectedSummary();
    elements.itemTotal.textContent = formatMoney(summary.itemTotal);
    elements.shippingFee.textContent = formatMoney(summary.shippingFee);
    elements.couponDiscount.textContent = formatDiscount(summary.couponDiscount);
    elements.pointsUsed.textContent = formatDiscount(summary.pointsUsed);
    elements.finalAmount.textContent = formatMoney(summary.finalAmount);
  }

  function updatePayButton() {
    const hasItems = Array.isArray(state.checkout && state.checkout.items) && state.checkout.items.length > 0;
    const enabled = hasItems && state.selectedAddressId && state.selectedPaymentType && !state.recalculating && !state.paying;
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
    const available = Number(state.checkout && state.checkout.availablePoints) || 0;
    if (!Number.isInteger(value) || value < 0) throw new Error("포인트는 0 이상의 정수로 입력해 주세요.");
    if (value > available) throw new Error(`사용 포인트는 보유 포인트(${money.format(available)}P)를 초과할 수 없습니다.`);
    return value;
  }

  async function refreshCheckout() {
    if (!state.checkout) return;
    if (isPreview) {
      state.recalculating = true;
      renderAll();
      state.checkout = createPreviewCheckout();
      state.idempotencyKey = createIdempotencyKey();
      state.recalculating = false;
      renderAll();
      return;
    }
    if (state.checkoutController) state.checkoutController.abort();
    const controller = new AbortController();
    state.checkoutController = controller;
    state.recalculating = true;
    setNotice("", "info");
    renderAll();
    try {
      const checkout = await apiFetch(checkoutPath(), { signal: controller.signal });
      if (controller.signal.aborted) return;
      state.checkout = checkout;
      state.idempotencyKey = createIdempotencyKey();
      if (!state.selectedAddressId) state.selectedAddressId = checkout.defaultAddressId || state.addresses.find((address) => address.isDefault)?.id || null;
      renderAll();
    } catch (error) {
      if (error.name !== "AbortError") setNotice(error.message);
    } finally {
      if (!controller.signal.aborted) {
        state.recalculating = false;
        renderAll();
      }
    }
  }

  async function applyPoints() {
    try {
      state.pointAmount = validatePointAmount();
      await refreshCheckout();
    } catch (error) {
      setNotice(error.message);
      elements.pointAmount.focus();
    }
  }

  async function submitOrder() {
    if (elements.payButton.disabled || state.paying || !state.checkout) return;
    if (isPreview) {
      setNotice("확인용 미리보기에서는 실제 결제가 진행되지 않습니다.", "info");
      return;
    }
    state.paying = true;
    setNotice("");
    updatePayButton();
    try {
      const result = await apiFetch("/orders", {
        method: "POST",
        body: JSON.stringify({
          checkoutId: state.checkout.checkoutId,
          addressId: state.selectedAddressId,
          couponId: state.selectedCouponId || null,
          pointAmount: state.pointAmount,
          paymentMethodType: state.selectedPaymentType,
          paymentMethodId: state.selectedPaymentId || null,
          idempotencyKey: state.idempotencyKey,
        }),
      });
      if (!result || !result.orderId || !result.payment || result.payment.status !== "APPROVED") {
        throw new Error("결제 승인 결과를 확인하지 못했습니다. 주문 내역에서 다시 확인해 주세요.");
      }
      location.href = `orders.html?orderId=${encodeURIComponent(result.orderId)}`;
    } catch (error) {
      setNotice(error.message);
      state.paying = false;
      updatePayButton();
    }
  }

  async function initialize() {
    if (isPreview) {
      state.checkout = createPreviewCheckout();
      state.addresses = previewAddresses();
      state.payments = previewPayments();
      state.selectedAddressId = state.checkout.defaultAddressId;
      state.selectedPaymentId = state.payments.find((method) => method.isDefault)?.id || null;
      elements.loading.hidden = true;
      elements.content.hidden = false;
      setNotice("확인용 미리보기입니다. 실제 로그인·결제 API는 호출하지 않습니다.", "info");
      renderAll();
      return;
    }
    if (!window.CatchAuth || !window.CatchAuth.requireLogin()) return;
    try {
      const [checkout, addresses, payments] = await Promise.all([
        apiFetch("/orders/checkout?pointAmount=0"),
        apiFetch("/users/me/addresses"),
        apiFetch("/users/me/payments"),
      ]);
      state.checkout = checkout;
      state.addresses = Array.isArray(addresses) ? addresses : [];
      state.payments = Array.isArray(payments) ? payments : [];
      state.selectedAddressId = checkout.defaultAddressId || state.addresses.find((address) => address.isDefault)?.id || null;
      state.selectedPaymentId = state.payments.find((method) => method.isDefault)?.id || state.payments[0]?.id || null;
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
  elements.addressOptions.addEventListener("change", async (event) => {
    if (!event.target.matches('input[name="address"]')) return;
    state.selectedAddressId = event.target.value;
    elements.addressDialog.close();
    await refreshCheckout();
  });
  elements.couponSelect.addEventListener("change", async () => {
    state.selectedCouponId = elements.couponSelect.value;
    await refreshCheckout();
  });
  elements.applyPoints.addEventListener("click", applyPoints);
  elements.pointAmount.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); applyPoints(); } });
  elements.paymentMethods.addEventListener("change", (event) => {
    if (event.target.matches('input[name="paymentType"]')) {
      state.selectedPaymentType = event.target.value;
      const paymentType = PAYMENT_TYPES.find((type) => type.id === state.selectedPaymentType);
      if (!paymentType || !paymentType.supportsSavedMethod) state.selectedPaymentId = null;
      renderPayments();
      updatePayButton();
    }
    if (event.target.matches('select[name="savedPaymentMethod"]')) {
      state.selectedPaymentId = event.target.value;
      updatePayButton();
    }
  });
  elements.payButton.addEventListener("click", submitOrder);
  document.addEventListener("DOMContentLoaded", initialize);
})();
