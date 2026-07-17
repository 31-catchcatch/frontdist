// my-inquiries.js — 나의 1:1 문의 내역
//   GET /api/v1/customer-center/inquiries (본인 문의, 로그인 필요)
//
// ⚠️ auth.js → api.js 다음에 로드된다.

document.addEventListener("DOMContentLoaded", () => {
  // 로그인 필요 페이지
  if (!window.CatchAuth || !CatchAuth.requireLogin()) return;

  const listEl = document.querySelector('[data-role="inquiry-list"]');
  const emptyEl = document.querySelector('[data-role="inquiry-empty"]');
  const errorEl = document.querySelector('[data-role="inquiry-error"]');
  const totalEl = document.querySelector('[data-role="total"]');

  // 문의 유형 코드 → 한글 (customercenter.js 의 유형과 정합)
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

  function fmtDate(iso) {
    if (!iso) return "";
    return String(iso).slice(0, 10).replace(/-/g, ".");
  }

  function itemHTML(inq) {
    const esc = CatchApi.escape;
    const answered = inq.status === "ANSWERED";
    const statusBadge = answered
      ? '<span class="inq-status answered">답변완료</span>'
      : '<span class="inq-status waiting">접수</span>';
    const orderRow = inq.orderNumber
      ? `<span class="inq-order">주문번호 ${esc(inq.orderNumber)}</span>`
      : "";
    const answerBlock = answered && inq.answer
      ? `<div class="inq-answer">
           <div class="inq-answer-head"><b>판매자 답변</b><span class="inq-answer-date">${fmtDate(inq.answeredAt)}</span></div>
           <p>${esc(inq.answer)}</p>
         </div>`
      : "";
    return `
      <li class="inquiry-item">
        <div class="inq-top">
          <span class="inq-category">${esc(categoryLabel(inq.category))}</span>
          ${statusBadge}
          <span class="inq-date">${fmtDate(inq.createdAt)}</span>
        </div>
        <p class="inq-title">${esc(inq.title)}</p>
        ${orderRow}
        <p class="inq-content">${esc(inq.content)}</p>
        ${answerBlock}
      </li>
    `;
  }

  async function load() {
    errorEl.hidden = true;
    emptyEl.hidden = true;
    try {
      const result = await CatchApi.page("/customer-center/inquiries", { page: 0, size: 100 });
      totalEl.textContent = result.totalElements.toLocaleString("ko-KR");

      if (result.content.length === 0) {
        listEl.innerHTML = "";
        emptyEl.hidden = false;
        return;
      }
      listEl.innerHTML = result.content.map(itemHTML).join("");
    } catch (err) {
      listEl.innerHTML = "";
      totalEl.textContent = "0";
      errorEl.hidden = false;
    }
  }

  load();
});
