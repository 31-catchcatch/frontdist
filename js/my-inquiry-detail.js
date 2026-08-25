document.addEventListener("DOMContentLoaded", () => {

  if (!window.CatchAuth || !CatchAuth.requireLogin()) return;

  const PAGE_SIZE = 50;
  const MAX_PAGES = 20;

  const params = new URLSearchParams(location.search);
  const inquiryId = Number(params.get("id"));
  const redirectTarget = CatchAuth.safeRedirect("my-inquiries.html");


  const $ = (sel) => document.querySelector(sel);

  const loadingEl = $('[data-role="loading"]');
  const detailEl = $('[data-role="detail"]');
  const errorEl = $('[data-role="error"]');

  document.querySelectorAll("[data-redirect-back]").forEach((link) => {
    link.href = redirectTarget;
    link.addEventListener("click", (event) => {
      event.preventDefault();
      location.href = redirectTarget;
    });
  });


  const CATEGORY = {
    ORDER: "주문",
    DELIVERY: "배송",
    EXCHANGE: "교환/반품",
    CANCEL: "취소/환불",
    PRODUCT: "상품",
    MEMBER: "회원",
    ETC: "기타",
  };

  function categoryLabel(code) {
    if (!code) return "기타";
    return CATEGORY[String(code).toUpperCase()] || code;
  }


  function fmtDateTime(iso) {
    if (!iso) return "";
    const text = String(iso);
    const date = text.slice(0, 10).replace(/-/g, ".");
    const time = text.slice(11, 16);
    return time ? `${date} ${time}` : date;
  }

  function showError(message) {
    loadingEl.hidden = true;
    detailEl.hidden = true;
    $('[data-role="error-message"]').textContent = message;
    errorEl.hidden = false;
  }

  function render(inquiry) {
    const answered = inquiry.status === "ANSWERED";

    $('[data-role="category"]').textContent = categoryLabel(inquiry.category);

    const statusEl = $('[data-role="status"]');
    statusEl.textContent = answered ? "답변완료" : "접수";
    statusEl.classList.add(answered ? "answered" : "waiting");

    $('[data-role="date"]').textContent = fmtDateTime(inquiry.createdAt);
    $('[data-role="title"]').textContent = inquiry.title || "";
    $('[data-role="inquiry-id"]').textContent = inquiry.id;
    $('[data-role="content"]').textContent = inquiry.content || "";

    if (inquiry.orderNumber) {
      $('[data-role="order-number"]').textContent = inquiry.orderNumber;
      $('[data-role="order-row"]').hidden = false;
    }


    if (answered && inquiry.answer) {
      $('[data-role="answer"]').textContent = inquiry.answer;
      $('[data-role="answered-at"]').textContent = fmtDateTime(inquiry.answeredAt);
      $('[data-role="answer-block"]').hidden = false;
    } else {
      $('[data-role="waiting-block"]').hidden = false;
    }


    if (inquiry.title) document.title = `${inquiry.title} — 캐치캐치`;

    loadingEl.hidden = true;
    errorEl.hidden = true;
    detailEl.hidden = false;
  }

  async function findInquiry(id) {
    for (let page = 0; page < MAX_PAGES; page++) {
      const result = await CatchApi.page("/customer-center/inquiries", {
        page: page,
        size: PAGE_SIZE,
      });
      const found = result.content.find((item) => Number(item.id) === id);
      if (found) return found;
      if (result.last || result.content.length === 0) return null;
    }
    return null;
  }

  (async function start() {
    if (!inquiryId) {
      showError("잘못된 접근입니다. 문의를 찾을 수 없습니다.");
      return;
    }
    let inquiry;
    try {
      inquiry = await findInquiry(inquiryId);
    } catch (err) {
      showError(err.message || "문의 내용을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      return;
    }
    if (!inquiry) {
      showError("존재하지 않거나 조회할 수 없는 문의입니다.");
      return;
    }
    render(inquiry);
  })();
});
