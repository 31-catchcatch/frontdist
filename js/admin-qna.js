(function () {
  "use strict";

  const STATUS = { ok: "답변완료", wait: "미답변" };

  const rowsEl = document.getElementById("rows");
  const countEl = document.getElementById("count");
  const qEl = document.getElementById("q");
  const statusEl = document.getElementById("statusFilter");

  let QNA = [];


  let openId = null;


  let usersById = null;

  async function loadUsers() {
    if (usersById) return;
    const map = new Map();
    try {
      const users = await AdminApi.list("/users?size=200");
      users.forEach((u) => {
        if (u && u.userId != null) {
          map.set(String(u.userId), { username: u.username || "", name: u.name || "" });
        }
      });
    } catch (_) {

    }
    usersById = map;
  }

  function authorLabel(userId) {
    const info = usersById && usersById.get(String(userId));
    if (!info || !info.username) return `사용자#${userId}`;
    return info.name ? `${info.name}(${info.username})` : info.username;
  }

  function mapRow(q) {
    return {
      id: q.qnaId,
      productId: q.productId,
      secret: Boolean(q.secret),
      title: q.title,
      content: q.content,
      author: authorLabel(q.userId),
      product: q.productName,
      status: q.answered ? "ok" : "wait",
      created: (q.createdAt || "").slice(0, 10),

      answer: q.answer && q.answer.content ? String(q.answer.content) : "",
      answeredAt: (q.answer && (q.answer.answerUpdatedAt || q.answer.answeredAt)) || ""
    };
  }

  function render(list, total = list.length) {
    if (!list.length) {
      rowsEl.innerHTML = '<tr class="empty-row"><td colspan="8">조건에 맞는 문의가 없습니다.</td></tr>';
      countEl.textContent = 0;
      return;
    }

    rowsEl.innerHTML = list.map((q) => {
      const open = String(q.id) === String(openId);
      return `
      <tr data-id="${q.id}"${open ? ' class="is-open"' : ""}>
        <td class="num">${q.id}</td>
        <td><span class="tag role">상품문의</span></td>
        <td class="strong">${q.secret ? "🔒 " : ""}${esc(q.title)}</td>
        <td>${esc(q.author)}</td>
        <td class="muted">${esc(q.product)}</td>
        <td><span class="tag ${q.status}">${STATUS[q.status]}</span></td>
        <td class="muted">${q.created}</td>
        <td>
          <div class="row-actions">
            <button type="button" class="btn sm" data-act="view" aria-expanded="${open}">${open ? "접기" : "내용 보기"}</button>
          </div>
        </td>
      </tr>${open ? detailRow(q) : ""}`;
    }).join("");

    countEl.textContent = total;
  }


  function detailRow(item) {
    const answered = item.status === "ok";

    const meta = [
      item.author,
      item.product ? `상품: ${item.product}` : "",
      item.created,
      item.secret ? "비밀글" : ""
    ].filter(Boolean);


    const productLink = item.productId
      ? `<a class="product-link" href="product-detail.html?id=${encodeURIComponent(item.productId)}" target="_blank" rel="noopener">상품 페이지 열기</a>`
      : "";

    return `
      <tr class="detail-row" data-detail-for="${item.id}">
        <td colspan="8">
          <div class="detail-panel">
            <section>
              <h4>${item.secret ? "🔒 " : ""}${esc(item.title)}</h4>
              <p class="detail-meta">${meta.map((v) => `<span>${esc(String(v))}</span>`).join("")}</p>
              <p class="detail-body">${esc(item.content || "(내용 없음)")}</p>
            </section>

            <section class="qna-answer${answered ? " is-answered" : ""}">
              <p class="detail-label">
                판매자 답변 <span class="tag ${item.status}">${STATUS[item.status]}</span>
                ${answered && item.answeredAt ? `<em>${esc(String(item.answeredAt).slice(0, 10))}</em>` : ""}
              </p>
              ${answered
                ? `<p class="detail-body">${esc(item.answer || "(내용 없음)")}</p>`
                : '<p class="qna-empty">아직 판매자가 답변하지 않았습니다. 답변은 판매자만 작성할 수 있습니다.</p>'}
            </section>

            <div class="detail-actions">
              <button type="button" class="btn sm" data-act="close">닫기</button>
              ${productLink}
            </div>
          </div>
        </td>
      </tr>`;
  }

  const listController = AdminUI.createListController({ pager: document.querySelector(".pager"), render });

  function applyFilter() {
    const keyword = qEl.value.trim().toLowerCase();
    const status = statusEl ? statusEl.value : "";

    listController.setItems(QNA.filter((item) =>
      (!status || item.status === status) &&
      (!keyword ||
        item.title.toLowerCase().includes(keyword) ||
        item.author.toLowerCase().includes(keyword) ||
        (item.product || "").toLowerCase().includes(keyword))
    ));
  }

  qEl.addEventListener("input", applyFilter);
  if (statusEl) statusEl.addEventListener("change", applyFilter);

  rowsEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;


    const row = btn.closest("tr");
    const id = row.dataset.id || row.dataset.detailFor;

    if (btn.dataset.act === "view") {
      openId = String(openId) === String(id) ? null : id;
    } else if (btn.dataset.act === "close") {
      openId = null;
    } else {
      return;
    }

    listController.refresh();
  });

  async function load() {
    try {

      const [data] = await Promise.all([
        AdminApi.list("/qna?size=200"),
        loadUsers()
      ]);
      QNA = data.map(mapRow);
      applyFilter();
    } catch (err) {
      rowsEl.innerHTML = `<tr class="empty-row"><td colspan="8">${esc(err.message || "목록을 불러오지 못했습니다.")}</td></tr>`;
      countEl.textContent = 0;
    }
  }

  load();
})();
