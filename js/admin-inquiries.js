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

  // 펼쳐진 문의 (아코디언: 한 번에 하나만 연다)
  let openId = null;
  // 작성 중인 답변. 필터 변경·재렌더로 입력이 날아가지 않게 따로 들고 있는다.
  const answerDrafts = new Map();

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
    rowsEl.innerHTML = list.map((i) => {
      const open = String(i.id) === String(openId);
      return `
      <tr data-id="${i.id}"${open ? ' class="is-open"' : ""}>
        <td class="num">${i.id}</td>
        <td><span class="tag role">${i.category}</span></td>
        <td class="strong">${esc(i.title)}</td>
        <td>${esc(i.author)}</td>
        <td><span class="tag ${i.status}">${STATUS[i.status]}</span></td>
        <td class="muted">${i.created}</td>
        <td>
          <div class="row-actions">
            <button class="btn sm" data-act="view" aria-expanded="${open}">${open ? "접기" : "내용 보기"}</button>
          </div>
        </td>
      </tr>${open ? detailRow(i) : ""}`;
    }).join("");
    countEl.textContent = total;
  }

  /* 목록 행 바로 아래에 붙는 상세 패널.
     문의 원문 + 답변 입력 + 답변 등록/수정·삭제를 한 자리에서 처리한다. */
  function detailRow(item) {
    const key = String(item.id);
    const draft = answerDrafts.has(key) ? answerDrafts.get(key) : (item.answer || "");
    const answered = item.status === "ok";

    const meta = [
      item.author,
      item.category,
      item.created,
      item.orderNumber ? `주문번호 ${item.orderNumber}` : ""
    ].filter(Boolean);

    return `
      <tr class="detail-row" data-detail-for="${item.id}">
        <td colspan="7">
          <div class="detail-panel">
            <section>
              <h4>${esc(item.title)}</h4>
              <p class="detail-meta">${meta.map((v) => `<span>${esc(String(v))}</span>`).join("")}</p>
              <p class="detail-body">${esc(item.content || "(내용 없음)")}</p>
            </section>

            <section class="inq-answer">
              <label class="detail-label" for="inqAnswer-${item.id}">
                답변 <span class="tag ${item.status}">${STATUS[item.status]}</span>
                ${answered && item.answeredAt ? `<em>최종 답변 ${esc(String(item.answeredAt).slice(0, 10))}</em>` : ""}
              </label>
              <textarea
                id="inqAnswer-${item.id}"
                data-role="answer-input"
                rows="4"
                placeholder="고객에게 전달할 답변을 입력하세요."
              >${esc(draft)}</textarea>
            </section>

            <div class="detail-actions">
              <button class="btn sm primary" data-act="save">${answered ? "답변 수정" : "답변 등록"}</button>
              <button class="btn sm" data-act="close">닫기</button>
              <button class="btn sm danger" data-act="delete">문의 삭제</button>
            </div>
          </div>
        </td>
      </tr>`;
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

  // 입력 중인 답변을 보관한다. 재렌더(필터·페이지 이동) 후에도 그대로 복원된다.
  rowsEl.addEventListener("input", (e) => {
    const textarea = e.target.closest('[data-role="answer-input"]');
    if (!textarea) return;
    const row = textarea.closest("tr");
    if (row) answerDrafts.set(String(row.dataset.detailFor), textarea.value);
  });

  rowsEl.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;

    // 목록 행은 data-id, 펼쳐진 상세 행은 data-detail-for 로 문의를 가리킨다.
    const row = btn.closest("tr");
    const id = row.dataset.id || row.dataset.detailFor;
    const item = INQUIRIES.find((x) => String(x.id) === String(id));
    if (!item) return;

    if (btn.dataset.act === "view") {
      openId = String(openId) === String(item.id) ? null : item.id;
      listController.refresh();          // 현재 페이지 유지 (applyFilter 는 1페이지로 되돌아간다)
      return;
    }

    if (btn.dataset.act === "close") {
      openId = null;
      listController.refresh();
      return;
    }

    if (btn.dataset.act === "save") {
      const textarea = row.querySelector('[data-role="answer-input"]');
      const content = (textarea ? textarea.value : "").trim();
      if (!content) {
        AdminUI.toast("답변 내용을 입력해 주세요.");
        if (textarea) textarea.focus();
        return;
      }

      const originalText = btn.textContent;
      try {
        btn.disabled = true;
        btn.textContent = "저장 중...";

        await AdminApi.post(`/inquiries/${item.id}/answer`, { content });

        // 로컬 상태 갱신 후 임시 저장분은 버린다 (서버 값이 정본이 됐으므로)
        item.status = "ok";
        item.answer = content;
        answerDrafts.delete(String(item.id));

        listController.refresh();
        AdminUI.toast("답변이 등록되었습니다.");
      } catch (err) {
        btn.disabled = false;
        btn.textContent = originalText;
        AdminUI.toast(err.message || "답변 등록에 실패했습니다.");
      }
      return;
    }

    if (btn.dataset.act === "delete") {
      const confirmed = await AdminUI.confirm({
        title: "1:1 문의 삭제",
        message: `[${item.title}] 문의를 삭제합니다. 삭제한 문의는 복구할 수 없습니다.`,
        okText: "삭제",
        danger: true,
      });
      if (!confirmed) return;
      try {
        await AdminApi.del(`/inquiries/${item.id}`);
        // 로컬 목록에서 제거 후 다시 렌더 (총 건수·빈 화면까지 반영)
        INQUIRIES = INQUIRIES.filter((x) => String(x.id) !== String(item.id));
        if (String(openId) === String(item.id)) openId = null;   // 펼쳐둔 패널도 함께 닫는다
        answerDrafts.delete(String(item.id));
        applyFilter();
        AdminUI.toast("문의가 삭제되었습니다.");
      } catch (err) {
        AdminUI.toast(err.message || "문의 삭제에 실패했습니다.");
      }
    }
  });

  async function load() {
    try {
      const data = await AdminApi.list("/inquiries?size=200");
      INQUIRIES = data.map(mapRow);
      applyFilter();
    } catch (err) {
      rowsEl.innerHTML = `<tr class="empty-row"><td colspan="7">${esc(err.message || "목록을 불러오지 못했습니다.")}</td></tr>`;
      countEl.textContent = 0;
    }
  }

  load();
})();
