// my-inquiries.js — 나의 1:1 문의 내역

document.addEventListener("DOMContentLoaded", () => {
  // 로그인 필요 페이지
  if (!window.CatchAuth || !CatchAuth.requireLogin()) return;

  const listEl = document.querySelector('[data-role="inquiry-list"]');
  const emptyEl = document.querySelector('[data-role="inquiry-empty"]');
  const errorEl = document.querySelector('[data-role="inquiry-error"]');
  const totalEl = document.querySelector('[data-role="total"]');

  const pageParams = new URLSearchParams(location.search);
  const redirectTarget = CatchAuth.safeRedirect("my-inquiries.html");

  function detailUrl(inquiryId) {
    const detailParams = new URLSearchParams({
      id: String(inquiryId),
      redirect: redirectTarget,
    });
    return `my-inquiry-detail.html?${detailParams.toString()}`;
  }

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
    const answered = inq.status === "ANSWERED";
    const statusBadge = answered
      ? '<span class="inq-status answered">답변완료</span>'
      : '<span class="inq-status waiting">접수</span>';
    // 문의 내용·주문번호·관리자 답변은 목록에 노출하지 않고
    // 상세 페이지(my-inquiry-detail)에서만 보여준다.
    // 목록에는 유형·상태 배지·작성일과 제목까지만 표시한다.
    // 항목 전체가 상세 페이지로 가는 링크다.
    // 삭제 버튼은 링크(<a>) 바깥에 두어야 클릭 시 상세로 이동하지 않는다.
    return `
      <li class="inquiry-item" data-inquiry-id="${inq.id}">
        <a class="inq-link" href="${detailUrl(inq.id)}">
          <div class="inq-top">
            <span class="inq-category">${categoryLabel(inq.category)}</span>
            ${statusBadge}
            <span class="inq-date">${fmtDate(inq.createdAt)}</span>
          </div>
          <p class="inq-title">${esc(inq.title)}</p>
        </a>
        <div class="inq-actions">
          <button type="button" class="inq-delete" data-action="delete" data-id="${inq.id}"
            ${answered ? 'disabled title="답변이 완료된 문의는 삭제할 수 없습니다."' : ""}>삭제</button>
        </div>
      </li>
    `;
  }

  async function deleteInquiry(inquiryId, buttonEl) {
    if (!confirm("이 문의를 삭제할까요?\n삭제한 문의는 복구할 수 없습니다.")) return;

    buttonEl.disabled = true;
    buttonEl.textContent = "삭제 중…";
    try {
      await CatchApi.del("/customer-center/inquiries/" + encodeURIComponent(inquiryId));
      // 목록을 다시 불러와 총 건수·빈 화면 처리까지 한 번에 반영한다.
      await load();
    } catch (err) {
      alert(err.message || "문의 삭제에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      buttonEl.disabled = false;
      buttonEl.textContent = "삭제";
    }
  }

  // 삭제 버튼은 목록을 다시 그려도 유지되도록 컨테이너에 위임한다.
  listEl.addEventListener("click", (e) => {
    const btn = e.target.closest('[data-action="delete"]');
    if (!btn || btn.disabled) return; // 답변완료 문의는 버튼이 disabled 라 여기서도 무시
    deleteInquiry(btn.dataset.id, btn);
  });

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
