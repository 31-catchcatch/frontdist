/* 관리자 - 1:1 고객문의 조회/답변
   GET  /api/v1/admin/inquiries
   POST /api/v1/admin/inquiries/{id}/answer  { content }
*/
(function () {
  "use strict";

  const STATUS = { ok: "답변완료", wait: "미답변" };
  const CATEGORY = {
    ORDER: "주문", DELIVERY: "배송", EXCHANGE: "교환/반품",
    CANCEL: "취소/환불", PRODUCT: "상품", MEMBER: "회원", ETC: "기타",
  };
  function categoryLabel(code) {
    if (!code) return "기타";
    return CATEGORY[String(code).toUpperCase()] || code;
  }

  const rowsEl = document.getElementById("rows");
  const countEl = document.getElementById("count");
  const qEl = document.getElementById("q");
  const statusEl = document.getElementById("statusFilter");

  let INQUIRIES = [];

  function mapRow(i) {
    return {
      id: i.id,
      category: categoryLabel(i.category),
      title: i.title,
      content: i.content,
      author: `${i.name || ""}(${i.username || ""})`,
      orderNumber: i.orderNumber,
      status: i.status === "ANSWERED" ? "ok" : "wait",
      answer: i.answer,
      answeredAt: i.answeredAt,
      created: (i.createdAt || "").slice(0, 10),
    };
  }

  function render(list, total = list.length) {
    if (!list.length) {
      rowsEl.innerHTML = '<tr class="empty-row"><td colspan="7">조건에 맞는 문의가 없습니다.</td></tr>';
      countEl.textContent = 0;
      return;
    }
    rowsEl.innerHTML = list.map((i) => `
      <tr data-id="${AdminUI.escape(i.id)}">
        <td class="num">${AdminUI.escape(i.id)}</td>
        <td><span class="tag role">${AdminUI.escape(i.category)}</span></td>
        <td class="strong">${AdminUI.escape(i.title)}</td>
        <td>${AdminUI.escape(i.author)}</td>
        <td><span class="tag ${i.status}">${STATUS[i.status]}</span></td>
        <td class="muted">${AdminUI.escape(i.created)}</td>
        <td>
          <div class="row-actions">
            <button class="btn sm" data-act="view">내용 보기</button>
            <button class="btn sm ${i.status === "wait" ? "primary" : ""}" data-act="answer">${i.status === "wait" ? "답변" : "답변 수정"}</button>
          </div>
        </td>
      </tr>`).join("");
    countEl.textContent = total;
  }

  const listController = AdminUI.createListController({ pager: document.querySelector(".pager"), render });

  function applyFilter() {
    const q = qEl.value.trim().toLowerCase();
    const status = statusEl ? statusEl.value : "";
    listController.setItems(INQUIRIES.filter((item) =>
      (!status || item.status === status) &&
      (!q || item.title.toLowerCase().includes(q) || item.author.toLowerCase().includes(q))
    ));
  }
  qEl.addEventListener("input", applyFilter);
  if (statusEl) statusEl.addEventListener("change", applyFilter);

  rowsEl.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const id = btn.closest("tr").dataset.id;
    const item = INQUIRIES.find((x) => String(x.id) === String(id));
    if (!item) return;

    if (btn.dataset.act === "view") {
      const orderRow = item.orderNumber ? `주문번호: ${item.orderNumber}\n\n` : "";
      const answerText = item.answer ? `\n\n[답변]\n${item.answer}` : "\n\n(미답변)";
      AdminUI.confirm({
        title: item.title,
        message: `${orderRow}${item.content}${answerText}`,
        okText: "닫기",
      });
      return;
    }

    if (btn.dataset.act === "answer") {
      const result = await AdminUI.form({
        title: `답변 작성 · ${item.title}`,
        message: `문의: ${item.content}`,
        okText: "답변 등록",
        fields: [
          { type: "textarea", name: "content", label: "답변 내용", placeholder: "고객에게 전달할 답변을 입력하세요.", value: item.answer || "" },
        ],
      });
      if (!result) return; // 취소
      const content = (result.content || "").trim();
      if (!content) {
        AdminUI.toast("답변 내용을 입력해 주세요.");
        return;
      }
      try {
        await AdminApi.post(`/inquiries/${item.id}/answer`, { content });
        // 로컬 상태 갱신
        item.status = "ok";
        item.answer = content;
        applyFilter();
        AdminUI.toast("답변이 등록되었습니다.");
      } catch (err) {
        AdminUI.toast(err.message || "답변 등록에 실패했습니다.");
      }
    }
  });

  async function load() {
    try {
      const data = await AdminApi.list("/inquiries?size=200");
      INQUIRIES = data.map(mapRow);
      applyFilter();
    } catch (err) {
      rowsEl.innerHTML = `<tr class="empty-row"><td colspan="7">${AdminUI.escape(err.message || "목록을 불러오지 못했습니다.")}</td></tr>`;
      countEl.textContent = 0;
    }
  }

  load();
})();
