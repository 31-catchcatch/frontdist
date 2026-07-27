/* =========================================================
   결제 실패 랜딩 (payment-fail.html) — 토스 failUrl

   토스 결제창에서 결제가 중단되면 code / message 를 쿼리스트링으로 실어 이 페이지로 보낸다.
   (사용자가 결제창을 닫아 취소한 경우에는 orderId 가 오지 않을 수 있다)

   승인 요청 자체가 없었으므로 청구된 금액은 없다. 다만 **주문은 이미 만들어져 있고**
   그 시점에 재고·쿠폰·포인트가 함께 빠져나갔기 때문에, 그냥 두면 아무도 못 쓰는 자원이
   잠긴다. 그래서 이 페이지가 주문 취소 API 를 호출해 되돌린다.
   (checkout.js 도 결제창을 닫았을 때 같은 API 를 부른다. 취소는 멱등이라 겹쳐도 안전하다.)

   ⚠️ sessionStorage(장바구니 선택 정보)를 지우지 않는다.
      여기서 지우면 "주문서로 돌아가기"를 눌렀을 때 주문할 상품이 사라진다.
   ========================================================= */
(function () {
  "use strict";

  const API_BASE = (window.CATCHCATCH_API_BASE_URL || "/api/v1").replace(/\/$/, "");
  // checkout.js 가 결제창으로 넘어가기 직전에 심어둔 { orderId, orderNumber }
  const PENDING_ORDER_KEY = "catchcatch.pendingOrder";

  // 토스가 내려주는 대표 코드만 우리 문구로 바꿔준다. 나머지는 토스 메시지를 그대로 보여준다.
  // 참고: https://docs.tosspayments.com/reference/error-codes
  const FRIENDLY_MESSAGE = {
    PAY_PROCESS_CANCELED: "결제를 취소하셨습니다. 다시 결제하시려면 주문서로 돌아가 주세요.",
    PAY_PROCESS_ABORTED: "결제 진행 중 오류가 발생해 결제가 중단되었습니다.",
    REJECT_CARD_COMPANY: "카드사에서 결제를 거절했습니다. 다른 카드로 시도하거나 카드사에 문의해 주세요.",
    INVALID_CARD_EXPIRATION: "카드 유효기간이 올바르지 않습니다.",
    EXCEED_MAX_CARD_INSTALLMENT_PLAN: "선택하신 할부 개월 수는 사용할 수 없습니다.",
    NOT_SUPPORTED_INSTALLMENT_PLAN_CARD_OR_MERCHANT: "이 카드로는 할부 결제를 사용할 수 없습니다.",
    EXCEED_MAX_PAYMENT_AMOUNT: "결제 한도를 초과했습니다.",
    USER_CANCEL: "결제를 취소하셨습니다. 다시 결제하시려면 주문서로 돌아가 주세요.",
  };

  const el = {
    lead: document.getElementById("failLead"),
    notice: document.getElementById("failNotice"),
    orderNumber: document.getElementById("failOrderNumber"),
    code: document.getElementById("failCode"),
  };

  // 쿼리스트링은 사용자가 조작할 수 있으므로 반드시 textContent 로 넣는다 (innerHTML 금지).
  function setText(node, value) {
    if (node) node.textContent = value;
  }

  /*
   * 되돌릴 주문을 찾는다.
   *
   * 토스가 failUrl 로 주는 orderId 는 주문번호(문자열)인데 취소 API 는 DB PK 를 받는다.
   * 둘을 잇는 정보가 checkout.js 가 남긴 pendingOrder 뿐이라, 저장값의 주문번호와
   * 토스가 준 주문번호가 같을 때만 취소한다. 다른 주문을 건드리지 않기 위한 대조다.
   * (사용자가 결제창을 닫으면 orderId 가 아예 안 오는데, 그때는 저장값을 그대로 쓴다.)
   */
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
    const token = window.CatchAuth && window.CatchAuth.getToken();
    if (!token) return false; // 비로그인 상태에서는 취소할 수 없다. 실패 안내는 그대로 보여준다.

    try {
      const response = await fetch(`${API_BASE}/orders/${encodeURIComponent(orderId)}/cancel`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
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
    const orderId = query.get("orderId") || ""; // 사용자가 결제창을 닫으면 없을 수 있다

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

    // 결제되지 않은 주문을 되돌린다. 결과는 안내 문구에만 반영하고 화면 흐름은 바꾸지 않는다.
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
