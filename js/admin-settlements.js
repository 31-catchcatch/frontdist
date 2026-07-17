/* 관리자 - 플랫폼 정산 (GET /admin/settlements, GET /admin/settlements/sellers)
   PATCH /admin/settlements/sellers/{sellerId}/complete - 판매자 단위 일괄 지급완료 처리 */
(function () {
  "use strict";

  const rowsEl = document.getElementById("rows");
  const countEl = document.getElementById("count");
  const qEl = document.getElementById("q");
  const statusEl = document.getElementById("statusFilter");

  let SELLERS = [];

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function mapRow(s) {
    const status = s.pendingAmount > 0 ? "wait" : "ok";
    return {
      id: s.sellerId,
      company: s.businessName,
      sale: s.saleAmount,
      fee: s.feeAmount,
      pending: s.pendingAmount,
      completed: s.completedAmount,
      status,
    };
  }

  function render(list) {
    if (!list.length) {
      rowsEl.innerHTML = '<tr class="empty-row"><td colspan="7">조건에 맞는 업체가 없습니다.</td></tr>';
      countEl.textContent = 0;
      return;
    }
    rowsEl.innerHTML = list.map((s) => `
      <tr data-id="${AdminUI.escape(s.id)}">
        <td class="strong">${AdminUI.escape(s.company)}</td>
        <td class="num">${AdminUI.won(s.sale)}</td>
        <td class="num">${AdminUI.won(s.fee)}</td>
        <td class="num">${AdminUI.won(s.pending)}</td>
        <td class="muted">월 1회</td>
        <td><span class="tag ${s.status}">${s.status === "wait" ? "정산대기" : "정산완료"}</span></td>
        <td>
          ${s.status === "wait"
            ? `<button class="btn sm ok" data-act="complete">정산 완료 처리</button>`
            : '<span class="muted">처리완료</span>'}
        </td>
      </tr>`).join("");
    countEl.textContent = list.length;
  }

  function applyFilter() {
    const q = qEl.value.trim().toLowerCase();
    const status = statusEl ? statusEl.value : "";
    render(SELLERS.filter((s) =>
      (!status || s.status === status) &&
      (!q || s.company.toLowerCase().includes(q))
    ));
  }
  qEl.addEventListener("input", applyFilter);
  if (statusEl) statusEl.addEventListener("change", applyFilter);

  rowsEl.addEventListener("click", async (e) => {
    const btn = e.target.closest('button[data-act="complete"]');
    if (!btn) return;
    const id = btn.closest("tr").dataset.id;
    const s = SELLERS.find((x) => String(x.id) === String(id));
    if (!s) return;

    const ok = await AdminUI.confirm({
      title: "정산 완료 처리",
      message: `[${s.company}] 이달 정산 대기 금액 ${AdminUI.won(s.pending)}을(를) 지급 완료 처리하시겠습니까?`,
      okText: "완료 처리",
    });
    if (!ok) return;

    try {
      await AdminApi.patch(`/settlements/sellers/${s.id}/complete`, {});
      AdminUI.toast("정산이 완료 처리되었습니다.");
      load();
    } catch (err) {
      AdminUI.toast(err.message || "처리에 실패했습니다.");
    }
  });

  async function load() {
    try {
      const [summary, sellers] = await Promise.all([
        AdminApi.get("/settlements"),
        AdminApi.list("/settlements/sellers"),
      ]);

      const sales = Number(summary.totalSalesAmount || 0);
      const fee = Number(summary.totalCommissionAmount || 0);
      const payout = Number(summary.totalPayoutAmount || 0);

      setText("stTotal", AdminUI.won(sales));
      setText("stFee", AdminUI.won(fee));

      SELLERS = sellers.map(mapRow);
      const pendingSum = SELLERS.reduce((sum, s) => sum + s.pending, 0);
      const completedSum = SELLERS.reduce((sum, s) => sum + s.completed, 0);
      setText("stPending", AdminUI.won(pendingSum));
      setText("stDone", AdminUI.won(completedSum));

      applyFilter();
    } catch (err) {
      rowsEl.innerHTML = `<tr class="empty-row"><td colspan="7">${AdminUI.escape(err.message || "정산 데이터를 불러오지 못했습니다.")}</td></tr>`;
      countEl.textContent = 0;
    }
  }

  load();
})();
