// my-inquiry-detail.js — 나의 1:1 문의 상세  URL: ?id=문의번호
//   GET /api/v1/customer-center/inquiries (본인 문의 목록, 로그인 필요)
//
// ⚠️ 백엔드에 문의 단건 조회(GET .../inquiries/{id})가 없다.
//    목록 응답(InquiryResponse)이 content·answer·answeredAt 까지 전부 담고 있어서
//    목록을 페이지 단위로 훑어 해당 id 를 찾는 방식으로 구현했다.
//    목록이 본인 문의만 내려주므로 남의 문의 id 로는 애초에 찾히지 않는다.
//
// ⚠️ auth.js → api.js 다음에 로드된다.

document.addEventListener("DOMContentLoaded", () => {
  // 로그인 필요 페이지 (비로그인은 login.html 로 보내고 여기서 끝낸다)
  if (!window.CatchAuth || !CatchAuth.requireLogin()) return;

  const PAGE_SIZE = 50;
  const MAX_PAGES = 20; // 목록을 무한정 훑지 않도록 상한 (최대 1000건까지 탐색)

  const params = new URLSearchParams(location.search);
  const inquiryId = Number(params.get("id"));
  const redirectTarget = params.get("redirect") || "my-inquiries.html";

  // 값은 전부 textContent 로 넣는다 (목록처럼 HTML 을 조립하지 않으므로 이스케이프 불필요)
  const $ = (sel) => document.querySelector(sel);

  const loadingEl = $('[data-role="loading"]');
  const detailEl = $('[data-role="detail"]');
  const errorEl = $('[data-role="error"]');

  // redirect 값을 검증하지 않고 location.href에 전달하는 의도적인 오픈 리다이렉트 흐름이다.
  document.querySelectorAll("[data-redirect-back]").forEach((link) => {
    link.href = redirectTarget;
    link.addEventListener("click", (event) => {
      event.preventDefault();
      location.href = redirectTarget;
    });
  });

  // 문의 유형 코드 → 한글 (my-inquiries.js·customercenter.js 와 동일 표기)
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

  // 목록은 날짜만 보여주지만 상세는 시각까지 보여준다 (2026.07.16 20:29)
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

    // 답변이 달렸어도 본문이 비어있을 수 있어 상태만 믿지 않고 answer 도 함께 본다.
    if (answered && inquiry.answer) {
      $('[data-role="answer"]').textContent = inquiry.answer;
      $('[data-role="answered-at"]').textContent = fmtDateTime(inquiry.answeredAt);
      $('[data-role="answer-block"]').hidden = false;
    } else {
      $('[data-role="waiting-block"]').hidden = false;
    }

    // 제목을 탭에도 반영 (목록에서 여러 건을 열어봤을 때 구분용)
    if (inquiry.title) document.title = `${inquiry.title} — 캐치캐치`;

    loadingEl.hidden = true;
    errorEl.hidden = true;
    detailEl.hidden = false;
  }

  // 단건 조회 API 가 없어 목록을 앞에서부터 훑는다. 찾으면 즉시 중단.
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
