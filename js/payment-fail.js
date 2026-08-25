(function () {
  "use strict";

  const API_BASE = (window.CATCHCATCH_API_BASE_URL || "/api/v1").replace(/\/$/, "");
  const PENDING_ORDER_KEY = "catchcatch.pendingOrder";


  const FRIENDLY_MESSAGE = {
    PAY_PROCESS_CANCELED: "결제를 취소하셨습니다. 다시 주문하시려면 상품을 선택해 주세요.",
    PAY_PROCESS_ABORTED: "결제 진행 중 오류가 발생해 결제가 중단되었습니다.",
    REJECT_CARD_COMPANY: "카드사에서 결제를 거절했습니다. 다른 카드로 시도하거나 카드사에 문의해 주세요.",
    INVALID_CARD_EXPIRATION: "카드 유효기간이 올바르지 않습니다.",
    EXCEED_MAX_CARD_INSTALLMENT_PLAN: "선택하신 할부 개월 수는 사용할 수 없습니다.",
    NOT_SUPPORTED_INSTALLMENT_PLAN_CARD_OR_MERCHANT: "이 카드로는 할부 결제를 사용할 수 없습니다.",
    EXCEED_MAX_PAYMENT_AMOUNT: "결제 한도를 초과했습니다.",
    USER_CANCEL: "결제를 취소하셨습니다. 다시 주문하시려면 상품을 선택해 주세요.",
  };

  const el = {
    lead: document.getElementById("failLead"),
    notice: document.getElementById("failNotice"),
    orderNumber: document.getElementById("failOrderNumber"),
    code: document.getElementById("failCode"),
  };


  function setText(node, value) {
    if (node) node.textContent = value;
  }

  function findPendingOrder(orderNumberFromToss) {
    try {
      const raw = sessionStorage.getItem(PENDING_ORDER_KEY);
      const saved = raw ? JSON.parse(raw) : null;
      if (!saved || saved.orderId == null) return null;
      if (orderNumberFromToss && String(saved.orderNumber) !== String(orderNumberFromToss)) return null;
      return saved;
    } catch (_) {
      return null;
    }
  }

  async function cancelOrder(orderId, code) {
    try {
      const response = await fetch(`${API_BASE}/orders/${encodeURIComponent(orderId)}/cancel`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: `결제 실패/취소 (${code || "사유 미상"})` }),
      });
      if (!response.ok) return false;
      sessionStorage.removeItem(PENDING_ORDER_KEY);
      return true;
    } catch (_) {
      return false;
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const query = new URLSearchParams(location.search);
    const code = query.get("code") || "";
    const message = query.get("message") || "";
    const orderId = query.get("orderId") || "";

    setText(el.orderNumber, orderId || "-");
    setText(el.code, code || "-");

    const text =
      FRIENDLY_MESSAGE[code] ||
      message ||
      "결제가 완료되지 않았습니다. 잠시 후 다시 시도해 주세요.";

    if (el.notice) {
      el.notice.hidden = false;
      el.notice.textContent = text;
    }

    if (code === "PAY_PROCESS_CANCELED" || code === "USER_CANCEL") {
      setText(el.lead, "결제를 취소하셨습니다. 주문은 아직 확정되지 않았습니다.");
    }


    const pending = findPendingOrder(orderId);
    if (pending) {
      cancelOrder(pending.orderId, code).then((canceled) => {
        if (canceled && el.notice) {
          el.notice.textContent = `${text} 주문이 취소되어 재고와 혜택이 복구되었습니다.`;
        }
      });
    }
  });
})();
