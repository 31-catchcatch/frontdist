document.addEventListener("DOMContentLoaded", () => {

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

      await load();
    } catch (err) {
      alert(err.message || "문의 삭제에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      buttonEl.disabled = false;
      buttonEl.textContent = "삭제";
    }
  }


  listEl.addEventListener("click", (e) => {
    const btn = e.target.closest('[data-action="delete"]');
    if (!btn || btn.disabled) return;
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
