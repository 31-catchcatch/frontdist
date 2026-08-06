/* =========================================================
   결제 성공 랜딩 (payment-success.html) — 토스 successUrl

   토스 결제창이 승인 가능한 상태가 되면 이 페이지로 리다이렉트하면서
   paymentKey / orderId / amount 를 쿼리스트링에 실어 보낸다.
   **여기서 서버에 승인을 요청해야 실제로 결제가 확정된다.**
   이 페이지에 도달한 것만으로는 아직 돈이 빠져나가지 않았다.

   ⚠️ 토스는 리다이렉트 후 10분 안에 승인을 요청해야 한다.
   ========================================================= */
(function () {
  "use strict";

  const API_BASE = (window.CATCHCATCH_API_BASE_URL || "/api/v1").replace(/\/$/, "");
  const money = new Intl.NumberFormat("ko-KR");

  // checkout.js 가 주문서로 넘길 때 심어둔 값. 결제가 확정된 뒤에만 지운다.
  // (실패 후 주문서로 되돌아왔을 때 장바구니 선택이 남아 있어야 하므로 checkout.js 에서 지우지 않는다)
  const CART_CHECKOUT_IDS_KEY = "catchcatch.checkoutCartItemIds";
  const DIRECT_CHECKOUT_KEY = "catchcatch.directCheckoutItem";
  // 결제 실패 시 되돌릴 주문을 가리키는 값. 결제가 확정됐으면 되돌릴 일이 없으므로 함께 지운다.
  const PENDING_ORDER_KEY = "catchcatch.pendingOrder";

  const el = {
    title: document.getElementById("resultTitle"),
    lead: document.getElementById("resultLead"),
    notice: document.getElementById("resultNotice"),
    loading: document.getElementById("resultLoading"),
    panel: document.getElementById("resultPanel"),
    failActions: document.getElementById("failActions"),
    orderNumber: document.getElementById("resultOrderNumber"),
    method: document.getElementById("resultMethod"),
    amount: document.getElementById("resultAmount"),
    goOrders: document.getElementById("goOrders"),
  };

  // 쿼리스트링 값은 사용자가 조작할 수 있으므로 innerHTML 로 넣지 않는다.
  function setText(node, value) {
    if (node) node.textContent = value;
  }

  function setNotice(message, type) {
    if (!el.notice) return;
    if (!message) {
      el.notice.hidden = true;
      return;
    }
    el.notice.hidden = false;
    el.notice.dataset.type = type || "error";
    el.notice.textContent = message;
  }

  function showSuccess(title, lead, detail) {
    setText(el.title, title);
    setText(el.lead, lead);
    setText(el.orderNumber, detail.orderNumber || "-");
    setText(el.amount, `${money.format(detail.amount || 0)}원`);

    // 중복 승인(409)처럼 결제수단을 알 수 없는 경우에는 "-" 를 남기지 말고 줄 자체를 감춘다.
    if (el.method && el.method.parentElement) {
      const known = Boolean(detail.method);
      el.method.parentElement.hidden = !known;
      if (known) setText(el.method, detail.method);
    }
    if (el.goOrders && detail.orderId) {
      el.goOrders.href = `orders.html?orderId=${encodeURIComponent(detail.orderId)}`;
    }
    el.loading.hidden = true;
    el.panel.hidden = false;
  }

  function showFailure(title, lead, message) {
    setText(el.title, title);
    setText(el.lead, lead);
    setNotice(message);
    el.loading.hidden = true;
    el.failActions.hidden = false;
  }

  // 결제가 확정된 뒤에만 주문서로 넘겼던 선택 정보를 정리한다.
  function clearCheckoutSelection() {
    try {
      sessionStorage.removeItem(CART_CHECKOUT_IDS_KEY);
      sessionStorage.removeItem(DIRECT_CHECKOUT_KEY);
      sessionStorage.removeItem(PENDING_ORDER_KEY);
    } catch (_) { /* 스토리지 접근이 막혀도 결제 결과에는 영향이 없다 */ }
  }

  async function confirmPayment(paymentKey, orderId, amount) {
    const headers = new Headers({
      Accept: "application/json",
      "Content-Type": "application/json",
    });
    const token = window.CatchAuth && window.CatchAuth.getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);

    const response = await fetch(`${API_BASE}/payments/confirm`, {
      method: "POST",
      headers,
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });

    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch (_) { /* JSON 이 아닌 응답(프록시 오류 페이지 등) */ }

    return { status: response.status, ok: response.ok, payload };
  }

  async function run() {
    // 비로그인이면 로그인 페이지로 보낸다. requireLogin 이 location.search 를 통째로
    // redirect 파라미터에 실어주므로 로그인 후 paymentKey 를 유지한 채 이 페이지로 돌아온다.
    if (!window.CatchAuth || !window.CatchAuth.requireLogin()) return;

    const query = new URLSearchParams(location.search);
    const paymentKey = query.get("paymentKey");
    const orderId = query.get("orderId"); // = Order.orderNumber
    const amount = Number(query.get("amount"));

    if (!paymentKey || !orderId || !Number.isFinite(amount) || amount <= 0) {
      showFailure(
        "결제 정보를 확인할 수 없습니다",
        "결제창에서 전달된 정보가 올바르지 않습니다.",
        "결제 정보가 없어 승인을 진행할 수 없습니다. 주문서에서 다시 시도해 주세요."
      );
      return;
    }

    let result;
    try {
      result = await confirmPayment(paymentKey, orderId, amount);
    } catch (error) {
      // 네트워크 자체가 실패한 경우. 승인 요청이 서버에 닿았는지 알 수 없으므로
      // 재결제를 권하지 말고 주문 내역 확인을 안내한다.
      showFailure(
        "결제 결과를 확인하지 못했습니다",
        "네트워크 오류로 승인 결과를 받지 못했습니다.",
        "결제가 처리되었을 수 있으니 주문 내역에서 상태를 먼저 확인해 주세요. 중복 결제를 막기 위해 바로 다시 결제하지 마세요."
      );
      if (el.failActions) {
        const first = el.failActions.querySelector("a");
        if (first) {
          first.href = "orders.html";
          first.textContent = "주문 내역 확인하기";
        }
      }
      return;
    }

    const data = result.payload && result.payload.data ? result.payload.data : null;

    if (result.ok) {
      clearCheckoutSelection();
      showSuccess("결제가 완료되었습니다", "주문해 주셔서 감사합니다.", {
        orderNumber: orderId,
        orderId: data ? data.orderId : null,
        method: data ? data.payMethod : null,
        amount: data && typeof data.amount === "number" ? data.amount : amount,
      });
      return;
    }

    if (result.status === 401) {
      const here = location.pathname.split("/").pop() + location.search;
      location.href = `login.html?redirect=${encodeURIComponent(here)}`;
      return;
    }

    // 409 는 서버의 PAYMENT-004(이미 결제가 완료된 주문). 이 페이지를 새로고침하면 여기로 온다.
    // 응답 봉투에 에러코드 필드가 없어 상태코드로 구분한다.
    if (result.status === 409) {
      clearCheckoutSelection();
      showSuccess("이미 결제가 완료된 주문입니다", "중복 승인은 처리되지 않았습니다.", {
        orderNumber: orderId,
        orderId: null,
        method: null,
        amount,
      });
      return;
    }

    const message =
      (result.payload && result.payload.message) ||
      "결제 승인에 실패했습니다. 잠시 후 다시 시도해 주세요.";
    showFailure("결제가 완료되지 않았습니다", "결제 승인이 거절되었습니다.", message);
  }

  document.addEventListener("DOMContentLoaded", run);
})();
