/* 관리자 - 쿠폰 발행 요청 심사
   GET /admin/coupons/requests (승인대기 목록)
   PUT /admin/coupons/requests/{requestId}  {decision, rejectionReason} */
(function () {
  "use strict";

  const STATUS = { wait: "대기", ok: "승인", stop: "반려" };
  const FROM_ENUM = { PENDING: "wait", APPROVED: "ok", REJECTED: "stop", CANCELED: "stop" };

  const rowsEl = document.getElementById("rows");
  const countEl = document.getElementById("count");
  const qEl = document.getElementById("q");
  const statusEl = document.getElementById("statusFilter");

  let COUPONS = [];

  function formatDiscount(type, value) {
    const v = Number(value);
    if (type && String(type).toUpperCase().includes("PERCENT")) return `${v}%`;
    return `${AdminUI.num(v)}원`;
  }

  function mapRow(c) {
    return {
      id: c.requestId,
      seller: `판매자#${c.sellerId}`,
      name: c.couponName,
      discount: formatDiscount(c.discountType, c.discountValue),
      qty: c.totalQuantity ?? 0,
      period: c.validUntil ? `~${String(c.validUntil).slice(0, 10)}` : "-",
      created: (c.requestedAt || "").slice(0, 10),
      status: FROM_ENUM[c.status] || "wait",
    };
  }

  function render(list, total = list.length) {
    if (!list.length) {
      rowsEl.innerHTML = '<tr class="empty-row"><td colspan="9">조건에 맞는 요청이 없습니다.</td></tr>';
      countEl.textContent = 0;
      return;
    }
    rowsEl.innerHTML = list.map((c) => `
      <tr data-id="${c.id}">
        <td class="num">${c.id}</td>
        <td class="muted">${c.seller}</td>
        <td class="strong">${c.name}</td>
        <td class="num">${c.discount}</td>
        <td class="num">${AdminUI.num(c.qty)}</td>
        <td class="muted">${c.period}</td>
        <td class="muted">${c.created}</td>
        <td><span class="tag ${c.status}">${STATUS[c.status]}</span></td>
        <td>
          ${c.status === "wait"
            ? `<div class="row-actions">
                 <button class="btn sm ok" data-act="approve">승인</button>
                 <button class="btn sm danger" data-act="reject">반려</button>
               </div>`
            : '<span class="muted">처리완료</span>'}
        </td>
      </tr>`).join("");
    countEl.textContent = total;
  }

  const listController = AdminUI.createListController({ pager: document.querySelector(".pager"), render });

  function applyFilter() {
    const q = qEl.value.trim().toLowerCase();
    const status = statusEl ? statusEl.value : "";
    listController.setItems(COUPONS.filter((c) =>
      (!status || c.status === status) &&
      (!q || c.seller.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
    ));
  }
  qEl.addEventListener("input", applyFilter);
  if (statusEl) statusEl.addEventListener("change", applyFilter);

  rowsEl.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const id = btn.closest("tr").dataset.id;
    const c = COUPONS.find((x) => String(x.id) === String(id));
    if (!c) return;

    const approve = btn.dataset.act === "approve";
    const ok = await AdminUI.confirm({
      title: approve ? "쿠폰 발행 승인" : "쿠폰 발행 반려",
      message: `[${c.seller}] '${c.name}' 쿠폰 발행을 ${approve ? "승인" : "반려"}하시겠습니까?`,
      okText: approve ? "승인" : "반려", danger: !approve,
    });
    if (!ok) return;

    try {
      await AdminApi.put(`/coupons/requests/${c.id}`, approve
        ? { decision: "APPROVE" }
        : { decision: "REJECT", rejectionReason: "관리자 반려" });
      AdminUI.toast(approve ? "쿠폰 발행이 승인되었습니다." : "반려 처리되었습니다.");
      load();
    } catch (err) {
      AdminUI.toast(err.message || "처리에 실패했습니다.");
    }
  });

  async function load() {
    try {
      const data = await AdminApi.list("/coupons/requests?size=200");
      COUPONS = data.map(mapRow);
      applyFilter();
    } catch (err) {
      rowsEl.innerHTML = `<tr class="empty-row"><td colspan="9">${err.message || "목록을 불러오지 못했습니다."}</td></tr>`;
      countEl.textContent = 0;
    }
  }

  load();
})();
