(function () {
  "use strict";

  const STATUS = { ok: "정상", wait: "일시정지", stop: "폐점" };
  const FROM_ENUM = { ACTIVE: "ok", SUSPENDED: "wait", CLOSED: "stop", FORCED_CLOSED: "stop" };
  const TO_ENUM = { ok: "ACTIVE", wait: "SUSPENDED", stop: "FORCED_CLOSED" };

  const rowsEl = document.getElementById("rows");
  const countEl = document.getElementById("count");
  const qEl = document.getElementById("q");
  const statusEl = document.getElementById("statusFilter");

  let SELLERS = [];

  function mapRow(s) {
    return {
      id: s.sellerId,
      userId: s.userId,
      company: s.businessName,
      ceo: s.representativeName,
      biz: s.businessRegistrationNumber,
      contact: s.contactNumber,
      address: s.businessAddress,
      joined: (s.createdAt || "").slice(0, 10),
      createdAt: s.createdAt,
      status: FROM_ENUM[s.status] || "ok",
    };
  }

  function render(list, total = list.length) {
    if (!list.length) {
      rowsEl.innerHTML = '<tr class="empty-row"><td colspan="6">조건에 맞는 업체가 없습니다.</td></tr>';
      countEl.textContent = 0;
      return;
    }
    rowsEl.innerHTML = list.map((s) => `
      <tr data-id="${s.id}">
        <td class="num">${s.id}</td>
        <td class="strong">${esc(s.company)}</td>
        <td>${esc(s.ceo)}</td>
        <td class="muted">${s.joined}</td>
        <td><span class="tag ${s.status}">${STATUS[s.status]}</span></td>
        <td>
          <div class="row-actions">
            <button class="btn sm" data-act="detail">상세</button>
            <button class="btn sm" data-act="change">상태 변경</button>
          </div>
        </td>
      </tr>`).join("");
    countEl.textContent = total;
  }

  const listController = AdminUI.createListController({ pager: document.querySelector(".pager"), render });

  function applyFilter() {
    const q = qEl.value.trim().toLowerCase();
    const status = statusEl ? statusEl.value : "";
    listController.setItems(SELLERS.filter((s) =>
      (!status || s.status === status) &&
      (!q || s.company.toLowerCase().includes(q) || s.ceo.toLowerCase().includes(q) || String(s.id).toLowerCase().includes(q))
    ));
  }
  qEl.addEventListener("input", applyFilter);
  if (statusEl) statusEl.addEventListener("change", applyFilter);

  rowsEl.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const id = btn.closest("tr").dataset.id;
    const s = SELLERS.find((x) => String(x.id) === String(id));
    if (!s) return;

    if (btn.dataset.act === "detail") {
      AdminUI.detail("입점 업체 상세", [
        ["판매자 ID", s.id],
        ["연결 사용자 ID", s.userId],
        ["상호명", s.company],
        ["대표자", s.ceo],
        ["사업자등록번호", s.biz],
        ["연락처", s.contact],
        ["사업장 주소", s.address],
        ["운영 상태", STATUS[s.status]],
        ["등록일시", (s.createdAt || "-").replace("T", " ").slice(0, 19)],
      ]);
      return;
    }

    const res = await AdminUI.form({
      title: `${s.company} 상태 변경`,
      message: "변경할 운영 상태를 선택하세요.",
      okText: "변경",
      fields: [{
        name: "status", label: "운영 상태", type: "select", value: s.status,
        options: [
          { value: "ok", label: "정상" },
          { value: "wait", label: "일시정지" },
          { value: "stop", label: "강제폐점" },
        ],
      }],
    });
    if (!res) return;
    const enumStatus = TO_ENUM[res.status];
    try {
      await AdminApi.put(`/sellers/${s.id}/status`, { status: enumStatus });
      s.status = res.status;
      applyFilter();
      AdminUI.toast(`상태가 '${STATUS[res.status]}'(으)로 변경되었습니다.`);
    } catch (err) {
      AdminUI.toast(err.message || "상태 변경에 실패했습니다.");
    }
  });

  async function load() {
    try {
      const data = await AdminApi.list("/sellers");
      SELLERS = data.map(mapRow);
      applyFilter();
    } catch (err) {
      rowsEl.innerHTML = `<tr class="empty-row"><td colspan="6">${err.message || "목록을 불러오지 못했습니다."}</td></tr>`;
      countEl.textContent = 0;
    }
  }

  load();
})();
