// orders.js — 주문 내역/배송추적/구매확정/교환환불 (U-ORDER-005~010)  URL: ?orderId=

(function () {
  "use strict";

  if (!window.CatchAuth || !CatchAuth.requireLogin()) return;

  const API_BASE = (window.CATCHCATCH_API_BASE_URL || "/api/v1").replace(/\/$/, "");

  const STATUS_LABEL = {
    PAYMENT_COMPLETED: "결제완료",
    PREPARING: "상품준비중",
    SHIPPING: "배송중",
    DELIVERED: "배송완료",
    CONFIRMED: "구매확정",
    CANCELED: "취소됨",
    RETURN_REQUESTED: "반품신청중",
    EXCHANGE_REQUESTED: "교환신청중",
    REFUNDED: "반품완료"
  };
  const STATUS_CLASS = { SHIPPING: "shipping", DELIVERED: "delivered", CONFIRMED: "confirmed" };

  let rows = [];
  let activeMonths = 3;
  let selectedRow = null;
  const list = document.getElementById('orderList');
  const emptyState = document.getElementById('emptyState');
  const count = document.getElementById('orderCount');
  const dialog = document.getElementById('detailDialog');
  const dialogKicker = document.getElementById('dialogKicker');
  const dialogTitle = document.getElementById('dialogTitle');
  const dialogContent = document.getElementById('dialogContent');
  const money = new Intl.NumberFormat('ko-KR');

  function getAccessToken() {
    return sessionStorage.getItem("catchcatch.accessToken") || localStorage.getItem("catchcatch.accessToken");
  }

  async function apiFetch(path, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set("Accept", "application/json");
    if (options.body) headers.set("Content-Type", "application/json");
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);

    const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;
    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.message || "요청을 처리하지 못했습니다.");
    }
    return payload?.data ?? payload;
  }

  function formatDate(value) {
    if (!value) return "";
    return value.slice(0, 10).replaceAll("-", ".");
  }

  function flattenOrders(orders) {
    const flattened = [];
    orders.forEach((order) => {
      (order.orderDetails || []).forEach((detail) => {
        flattened.push({
          orderId: order.orderId,
          orderNumber: order.orderNumber,
          createdAt: order.createdAt,
          orderDetailId: detail.orderDetailId,
          productId: detail.productId,
          productName: detail.productName,
          thumbnailUrl: detail.thumbnailUrl,
          quantity: detail.quantity,
          totalPrice: detail.totalPrice,
          deliveryStatus: detail.deliveryStatus,
          // 주문 단위 합계(배송비 포함) — 주문 마지막 상품 뒤 요약 줄에 쓴다.
          orderFinalAmount: order.finalPaymentAmount
        });
      });
    });
    return flattened;
  }

  function rowCard(row) {
    const statusLabel = STATUS_LABEL[row.deliveryStatus] || row.deliveryStatus;
    const statusClass = STATUS_CLASS[row.deliveryStatus] || "";
    let action = `<button type="button" class="text-btn" data-action="claim" data-id="${row.orderDetailId}">교환/반품 신청</button>`;
    if (row.deliveryStatus === "DELIVERED") {
      action = `<button class="btn btn-dark" data-action="confirm" data-id="${row.orderDetailId}">구매 확정</button><button class="btn" data-action="claim" data-id="${row.orderDetailId}">교환/반품 신청</button>`;
    } else if (row.deliveryStatus === "CONFIRMED") {
      action = `<a class="btn btn-dark" href="review-write.html?orderDetailId=${row.orderDetailId}&productId=${row.productId}">리뷰 작성</a>`;
    } else if (row.deliveryStatus === "CANCELED" || row.deliveryStatus === "REFUNDED") {
      action = "";
    }
    // 썸네일이 없는 상품은 기존처럼 CSS로 그린 회색 박스를 유지한다.
    const thumb = row.thumbnailUrl
      ? `<img src="${esc(row.thumbnailUrl)}" alt="">`
      : `<span></span>`;
    return `<article class="order-card" id="order-${row.orderDetailId}" data-order-id="${row.orderId}" data-order-detail-id="${row.orderDetailId}">
      <header class="order-card-head"><div><time>${formatDate(row.createdAt)}</time><span class="order-no">주문번호 ${row.orderNumber}</span></div><a href="#" data-action="order-detail" data-id="${row.orderDetailId}">주문 상세 <span aria-hidden="true">›</span></a></header>
      <div class="order-product"><div class="product-thumb" aria-hidden="true">${thumb}</div><div class="product-info"><strong>${esc(row.productName)}</strong><p>${row.quantity}개</p><b>${money.format(row.orderFinalAmount)}원</b></div><span class="status ${statusClass}">${statusLabel}</span></div>
      <div class="order-actions"><div class="document-actions"><button type="button" class="text-btn" data-action="delivery" data-id="${row.orderDetailId}">배송 조회</button><button type="button" class="text-btn" data-action="receipt" data-id="${row.orderDetailId}">전자 영수증</button><button type="button" class="text-btn" data-action="statement" data-id="${row.orderDetailId}">거래명세서</button></div><div class="primary-actions">${action}</div></div>
    </article>`;
  }

  function renderRows() {
    const now = Date.now();
    const shown = activeMonths === 'all'
      ? rows
      : rows.filter((row) => {
          if (!row.createdAt) return true;
          const ageMs = now - new Date(row.createdAt).getTime();
          return ageMs <= Number(activeMonths) * 31 * 24 * 60 * 60 * 1000;
        });
    list.innerHTML = shown.map(rowCard).join('');
    count.textContent = `총 ${shown.length}건의 주문이 있습니다.`;
    emptyState.hidden = shown.length > 0;
    list.hidden = shown.length === 0;
    highlightRequestedOrder();
  }

  function findRow(orderDetailId) { return rows.find((row) => String(row.orderDetailId) === String(orderDetailId)); }

  function showToast(message) { const toast = document.getElementById('toast'); toast.textContent = message; toast.classList.add('show'); window.setTimeout(() => toast.classList.remove('show'), 3200); }

  async function openDialog(type, row) {
    selectedRow = row;
    const summary = `<div class="dialog-order-summary"><span>${formatDate(row.createdAt)} · 주문번호 ${row.orderNumber}</span><strong>${esc(row.productName)}</strong></div>`;

    try {
      if (type === 'delivery') {
        dialogKicker.textContent = 'DELIVERY TRACKING'; dialogTitle.textContent = '배송 조회';
        const deliveries = await apiFetch(`/orders/${row.orderId}/delivery`);
        const info = (Array.isArray(deliveries) ? deliveries : []).find((d) => String(d.orderDetailId) === String(row.orderDetailId));
        if (!info || (!info.courierCompany && !info.trackingNumber)) {
          dialogContent.innerHTML = `${summary}<p class="dialog-note">아직 등록된 배송 정보가 없습니다.</p>`;
        } else {
          dialogContent.innerHTML = `${summary}<div class="tracking-number"><span>${esc(info.courierCompany || "-")}</span><b>${esc(info.trackingNumber || "-")}</b></div><p class="dialog-note">배송 상태: ${STATUS_LABEL[info.deliveryStatus] || info.deliveryStatus}</p>`;
        }
      } else if (type === 'receipt') {
        dialogKicker.textContent = 'ELECTRONIC RECEIPT'; dialogTitle.textContent = '전자 영수증';
        const receipt = await apiFetch(`/orders/${row.orderId}/receipt`);
        dialogContent.innerHTML = `${summary}<dl class="receipt-list"><div><dt>결제 금액</dt><dd>${money.format(receipt.amount)}원</dd></div><div><dt>결제 수단</dt><dd>${esc(receipt.payMethod || "-")}</dd></div><div><dt>승인 일시</dt><dd>${(receipt.paidAt || "").toString().replace("T", " ").slice(0, 16)}</dd></div><div><dt>거래 ID</dt><dd>${esc(receipt.pgTransactionId || "-")}</dd></div></dl><p class="dialog-note">전자 영수증은 결제 내역 확인용으로 제공됩니다.</p>`;
      } else if (type === 'statement') {
        dialogKicker.textContent = 'TRANSACTION STATEMENT'; dialogTitle.textContent = '거래명세서';
        const order = await apiFetch(`/orders/${row.orderId}/statement`);

        // 최종 결제 금액은 전자 영수증(결제 승인액)을 기준으로 통일한다.
        // 영수증 조회가 안 되면 주문의 최종 결제 금액으로 폴백.
        let finalAmount = order.finalPaymentAmount;
        try {
          const receipt = await apiFetch(`/orders/${row.orderId}/receipt`);
          if (receipt && receipt.amount != null) finalAmount = receipt.amount;
        } catch (_) { /* 폴백 유지 */ }

        // 품목은 주문 전체(모든 상품)를 나열한다 → 상품 금액 합계로 이어진다.
        const items = (order.orderDetails || [])
          .map((d) => `<div><dt>${esc(d.productName)}</dt><dd>${d.quantity}개 / ${money.format(d.totalPrice)}원</dd></div>`)
          .join("");
        const discount = order.couponDiscountAmount > 0
          ? `<div><dt>쿠폰 할인</dt><dd>-${money.format(order.couponDiscountAmount)}원</dd></div>` : "";
        const point = order.usedPointAmount > 0
          ? `<div><dt>포인트 사용</dt><dd>-${money.format(order.usedPointAmount)}원</dd></div>` : "";

        dialogContent.innerHTML = `${summary}<div class="statement-box"><div class="statement-title">거 래 명 세 서</div><dl><div><dt>공급자</dt><dd>CATCHCATCH STORE</dd></div>${items}<div><dt>상품 금액</dt><dd>${money.format(order.totalProductAmount)}원</dd></div><div><dt>배송비</dt><dd>${money.format(order.shippingFee)}원</dd></div>${discount}${point}<div><dt>최종 결제 금액</dt><dd>${money.format(finalAmount)}원</dd></div></dl></div><button type="button" class="btn btn-dark full" data-action="print">인쇄하기</button>`;
      } else if (type === 'claim') {
        dialogKicker.textContent = 'EXCHANGE / RETURN'; dialogTitle.textContent = '교환/반품 신청';
        dialogContent.innerHTML = `${summary}<form id="claimForm" class="claim-form"><label>신청 유형<select name="type" required><option value="EXCHANGE">교환</option><option value="RETURN">반품</option></select></label><label>상세 사유<textarea name="reason" required placeholder="상세 사유를 입력해 주세요."></textarea></label><p class="dialog-note">구매 확정 전 주문 상품에 한해 신청할 수 있습니다.</p><button type="submit" class="btn btn-dark full">신청하기</button></form>`;
      } else {
        dialogKicker.textContent = 'ORDER DETAIL'; dialogTitle.textContent = '주문 상세';
        // 주문 전체를 불러와 상품별 금액과 배송비 포함 합계를 함께 보여준다.
        const order = await apiFetch(`/orders/${row.orderId}`);

        // 최종 결제 금액은 거래명세서와 동일하게 전자 영수증(결제 승인액)을 기준으로 통일한다.
        // 영수증 조회가 안 되면 주문의 최종 결제 금액으로 폴백.
        let finalAmount = order.finalPaymentAmount;
        try {
          const receipt = await apiFetch(`/orders/${row.orderId}/receipt`);
          if (receipt && receipt.amount != null) finalAmount = receipt.amount;
        } catch (_) { /* 폴백 유지 */ }

        const items = (order.orderDetails || [])
          .map((d) => `<div><dt>${esc(d.productName)} · ${d.quantity}개 <em>(${STATUS_LABEL[d.deliveryStatus] || d.deliveryStatus})</em></dt><dd>${money.format(d.totalPrice)}원</dd></div>`)
          .join("");
        const discount = order.couponDiscountAmount > 0
          ? `<div><dt>쿠폰 할인</dt><dd>-${money.format(order.couponDiscountAmount)}원</dd></div>` : "";
        const point = order.usedPointAmount > 0
          ? `<div><dt>포인트 사용</dt><dd>-${money.format(order.usedPointAmount)}원</dd></div>` : "";
        dialogContent.innerHTML = `${summary}<dl class="receipt-list">${items}<div class="detail-sum"><dt>상품 금액</dt><dd>${money.format(order.totalProductAmount)}원</dd></div><div><dt>배송비</dt><dd>${money.format(order.shippingFee)}원</dd></div>${discount}${point}<div class="detail-total"><dt>최종 결제 금액</dt><dd>${money.format(finalAmount)}원</dd></div></dl>`;
      }
    } catch (error) {
      dialogContent.innerHTML = `${summary}<p class="dialog-note">${esc(error.message)}</p>`;
    }
    dialog.showModal();
  }

  async function confirmPurchase(row) {
    if (!window.confirm('구매를 확정하시겠습니까?\n구매 확정 후에는 교환·반품 신청이 제한됩니다.')) return;
    try {
      await apiFetch(`/orders/${row.orderDetailId}/confirm`, { method: 'PUT' });
      row.deliveryStatus = 'CONFIRMED';
      renderRows();
      showToast('구매가 확정되었습니다. 구매액의 1%가 포인트로 적립되었습니다. 리뷰를 작성해 보세요.');
    } catch (error) {
      showToast(error.message);
    }
  }

  function highlightRequestedOrder() {
    const orderId = new URLSearchParams(location.search).get('orderId');
    if (!orderId) return;
    const target = list.querySelector(`[data-order-id="${orderId}"]`);
    if (target) { target.classList.add('requested'); target.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  }

  document.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if (action === 'print') { window.print(); return; }
    if (action === 'order-detail') event.preventDefault();
    const row = findRow(target.dataset.id);
    if (!row) return;
    if (action === 'confirm') confirmPurchase(row);
    else openDialog(action, row);
  });

  document.querySelectorAll('.period').forEach((button) => button.addEventListener('click', () => {
    activeMonths = button.dataset.months;
    document.querySelectorAll('.period').forEach((tab) => tab.classList.toggle('on', tab === button));
    renderRows();
  }));
  document.querySelector('[data-close-dialog]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('submit', async (event) => {
    if (event.target.id !== 'claimForm') return;
    event.preventDefault();
    const form = event.target;
    try {
      await apiFetch(`/orders/${selectedRow.orderId}/claims`, {
        method: 'POST',
        body: JSON.stringify({
          orderDetailId: selectedRow.orderDetailId,
          type: form.elements.type.value,
          reason: form.elements.reason.value.trim()
        })
      });
      dialog.close();
      selectedRow.deliveryStatus = form.elements.type.value === 'EXCHANGE' ? 'EXCHANGE_REQUESTED' : 'RETURN_REQUESTED';
      renderRows();
      showToast('교환/반품 신청이 접수되었습니다.');
    } catch (error) {
      showToast(error.message);
    }
  });

  async function initialize() {
    count.textContent = '주문을 불러오는 중입니다.';
    try {
      const data = await apiFetch('/orders?size=100');
      rows = flattenOrders(Array.isArray(data?.orders) ? data.orders : []);
      renderRows();
    } catch (error) {
      count.textContent = '';
      list.innerHTML = '';
      emptyState.hidden = false;
      emptyState.querySelector('strong').textContent = error.message;
    }
  }

  initialize();
})();
