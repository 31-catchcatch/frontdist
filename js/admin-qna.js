/* 관리자 - 상품 Q&A 모니터링
   GET /api/v1/admin/qna

   [알아둘 것] 이 화면은 조회 전용이다. 관리자 Q&A API 는 위 GET 하나뿐이고,
   답변 작성·수정은 판매자 몫(/api/v1/seller/qna)이라 관리자가 개입할 엔드포인트가 없다.
   그래서 [내용 보기]는 1:1 문의 화면과 같은 인라인 패널을 쓰되, 답변은 읽기 전용으로만 보여준다.
*/
(function () {
  "use strict";

  const STATUS = { ok: "답변완료", wait: "미답변" };

  const rowsEl = document.getElementById("rows");
  const countEl = document.getElementById("count");
  const qEl = document.getElementById("q");
  const statusEl = document.getElementById("statusFilter");

  let QNA = [];

  // 펼쳐진 문의 (아코디언: 한 번에 하나만 연다)
  let openId = null;

  /* ---------------------------------------------------------
     작성자 표기

     Q&A 응답은 userId(내부 숫자)만 준다. 계정 정보를 가진 건 GET /admin/users 뿐이라
     한 번 받아 userId → 이름·아이디 표를 만들어 쓴다.
     표기 형식은 1:1 문의 화면과 맞춘다 — "이름(아이디)".
     --------------------------------------------------------- */
  let usersById = null;   // userId → { username, name }

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
      // 실패해도 목록 자체는 보여야 하므로 빈 표로 확정하고 폴백 표기를 쓴다
    }
    usersById = map;
  }

  function authorLabel(userId) {
    const info = usersById && usersById.get(String(userId));
    if (!info || !info.username) return `사용자#${userId}`;   // 조회 실패 시 기존 표기로 폴백
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
      // 답변은 객체로 온다 (QnaAnswerResponse). 미답변이면 null.
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

  /* 목록 행 바로 아래에 펼쳐지는 상세 패널.
     껍데기 클래스(.detail-row/.detail-panel/...)는 admin.css 공용 컴포넌트다. */
  function detailRow(item) {
    const answered = item.status === "ok";

    const meta = [
      item.author,
      item.product ? `상품: ${item.product}` : "",
      item.created,
      item.secret ? "비밀글" : ""
    ].filter(Boolean);

    // 상품 상세는 공개 페이지라 관리자도 그대로 열 수 있다. 새 탭으로 열어 목록 상태를 지킨다.
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

    // 목록 행은 data-id, 펼쳐진 상세 행은 data-detail-for 로 문의를 가리킨다.
    const row = btn.closest("tr");
    const id = row.dataset.id || row.dataset.detailFor;

    if (btn.dataset.act === "view") {
      openId = String(openId) === String(id) ? null : id;
    } else if (btn.dataset.act === "close") {
      openId = null;
    } else {
      return;
    }

    listController.refresh();   // 현재 페이지 유지 (applyFilter 는 1페이지로 되돌아간다)
  });

  async function load() {
    try {
      // mapRow 가 authorLabel 을 쓰므로 매핑 전에 사용자 표가 준비돼 있어야 한다
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
