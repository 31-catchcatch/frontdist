(function () {
  "use strict";

  const rowsEl = document.getElementById("rows");
  const countEl = document.getElementById("count");
  const qEl = document.getElementById("q");

  let POINTS = [];

  function mapRow(u) {
    return {
      id: u.userId,
      username: u.username || `#${u.userId}`,   // username 이 비면 내부 ID 로 대체
      name: u.name || "-",
      balance: u.point,
    };
  }

  function render(list, total = list.length) {
    if (!list.length) {
      rowsEl.innerHTML = '<tr class="empty-row"><td colspan="4">조건에 맞는 사용자가 없습니다.</td></tr>';
      countEl.textContent = 0;
      return;
    }
    rowsEl.innerHTML = list.map((p) => `
      <tr data-id="${p.id}">
        <td class="strong">${esc(p.username)}</td>
        <td>${esc(p.name)}</td>
        <td class="num strong">${AdminUI.num(p.balance)} P</td>
        <td><button class="btn sm" data-act="adjust">조정</button></td>
      </tr>`).join("");
    countEl.textContent = total;
  }

  const listController = AdminUI.createListController({ pager: document.querySelector(".pager"), render });

  function applyFilter() {
    const q = qEl.value.trim().toLowerCase();
    listController.setItems(POINTS.filter((p) =>
      !q ||
      p.username.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      String(p.id).toLowerCase().includes(q)
    ));
  }
  qEl.addEventListener("input", applyFilter);

  rowsEl.addEventListener("click", async (e) => {
    const btn = e.target.closest('button[data-act="adjust"]');
    if (!btn) return;
    const id = btn.closest("tr").dataset.id;
    const p = POINTS.find((x) => String(x.id) === String(id));
    if (!p) return;

    const res = await AdminUI.form({
      // 이름이 비어 있는 계정이 많아 조정 모달도 로그인 아이디 기준으로 표시한다
      title: `${p.username} 포인트 강제 조정`,
      message: `현재 보유 ${AdminUI.num(p.balance)} P. 더할 값은 양수, 뺄 값은 음수로 입력하세요.`,
      okText: "조정 적용",
      fields: [
        { name: "amount", label: "조정 포인트 (+/-)", type: "number", placeholder: "예: -1000 또는 5000" },
        { name: "reason", label: "조정 사유", type: "textarea", placeholder: "예: 이벤트 오적립 회수" },
      ],
    });
    if (!res) return;
    const amount = Number(res.amount);
    if (!amount || Number.isNaN(amount)) { AdminUI.toast("조정 포인트를 올바르게 입력하세요."); return; }
    if (!res.reason || !res.reason.trim()) { AdminUI.toast("조정 사유를 입력하세요."); return; }
    if (p.balance + amount < 0) { AdminUI.toast("보유 포인트보다 큰 값을 차감할 수 없습니다."); return; }

    try {
      const history = await AdminApi.patch(`/users/${p.id}/points`, { amount, reason: res.reason.trim() });
      p.balance = history && typeof history.balanceAfter === "number" ? history.balanceAfter : p.balance + amount;
      applyFilter();
      AdminUI.toast(`${amount > 0 ? "+" : ""}${AdminUI.num(amount)} P 조정되었습니다.`);
    } catch (err) {
      AdminUI.toast(err.message || "포인트 조정에 실패했습니다.");
    }
  });

  async function load() {
    try {
      const data = await AdminApi.list("/users/points?size=200");
      POINTS = data.map(mapRow);
      applyFilter();
    } catch (err) {
      rowsEl.innerHTML = `<tr class="empty-row"><td colspan="4">${err.message || "목록을 불러오지 못했습니다."}</td></tr>`;
      countEl.textContent = 0;
    }
  }

  load();
})();
