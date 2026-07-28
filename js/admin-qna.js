/* 관리자 - 전체 Q&A 모니터링 (GET /admin/qna)
   ※ 백엔드 QnaResponse에는 작성자 이름이 없어 사용자#ID로, 판매자 칸은 상품명으로 대체.
     문의 유형은 상품문의만 존재. */
(function () {
  "use strict";

  const STATUS = { ok: "답변완료", wait: "미답변" };

  const rowsEl = document.getElementById("rows");
  const countEl = document.getElementById("count");
  const qEl = document.getElementById("q");
  const typeEl = document.getElementById("typeFilter");
  const statusEl = document.getElementById("statusFilter");

  let QNA = [];

  function mapRow(q) {
    return {
      id: q.qnaId,
      title: q.secret ? `🔒 ${q.title}` : q.title,
      content: q.content,
      author: `사용자#${q.userId}`,
      product: q.productName,
      status: q.answered ? "ok" : "wait",
      created: (q.createdAt || "").slice(0, 10),
      answer: q.answer,
    };
  }

  function render(list, total = list.length) {
    if (!list.length) {
      rowsEl.innerHTML = '<tr class="empty-row"><td colspan="8">조건에 맞는 문의가 없습니다.</td></tr>';
      countEl.textContent = 0;
      return;
    }
    rowsEl.innerHTML = list.map((q) => `
      <tr data-id="${q.id}">
        <td class="num">${q.id}</td>
        <td><span class="tag role">상품문의</span></td>
        <td class="strong">${q.title}</td>
        <td>${q.author}</td>
        <td class="muted">${q.product}</td>
        <td><span class="tag ${q.status}">${STATUS[q.status]}</span></td>
        <td class="muted">${q.created}</td>
        <td><button class="btn sm" data-act="view">내용 보기</button></td>
      </tr>`).join("");
    countEl.textContent = total;
  }

  const listController = AdminUI.createListController({ pager: document.querySelector(".pager"), render });

  function applyFilter() {
    const q = qEl.value.trim().toLowerCase();
    const status = statusEl ? statusEl.value : "";
    listController.setItems(QNA.filter((item) =>
      (!status || item.status === status) &&
      (!q || item.title.toLowerCase().includes(q) || item.author.toLowerCase().includes(q) || (item.product || "").toLowerCase().includes(q))
    ));
  }
  qEl.addEventListener("input", applyFilter);
  if (typeEl) typeEl.addEventListener("change", applyFilter);
  if (statusEl) statusEl.addEventListener("change", applyFilter);

  rowsEl.addEventListener("click", (e) => {
    const btn = e.target.closest('button[data-act="view"]');
    if (!btn) return;
    const id = btn.closest("tr").dataset.id;
    const item = QNA.find((x) => String(x.id) === String(id));
    if (!item) return;
    const answerText = item.answer && item.answer.content ? `\n\n[답변] ${item.answer.content}` : "\n\n(미답변)";
    AdminUI.confirm({
      title: `${item.title}`,
      message: `${item.content}${answerText}`,
      okText: "닫기",
    });
  });

  async function load() {
    try {
      const data = await AdminApi.list("/qna?size=200");
      QNA = data.map(mapRow);
      applyFilter();
    } catch (err) {
      rowsEl.innerHTML = `<tr class="empty-row"><td colspan="8">${err.message || "목록을 불러오지 못했습니다."}</td></tr>`;
      countEl.textContent = 0;
    }
  }

  load();
})();
