(function () {
  "use strict";

  const STATUS = { wait: "대기", ok: "승인", stop: "반려" };
  const TO_ENUM = { wait: "PENDING", ok: "APPROVED", stop: "REJECTED", "": "PENDING" };
  // 백엔드 status → 화면 코드
  const FROM_ENUM = { PENDING: "wait", APPROVED: "ok", REJECTED: "stop", CANCELED: "stop" };

  const rowsEl = document.getElementById("rows");
  const countEl = document.getElementById("count");
  const qEl = document.getElementById("q");
  const statusEl = document.getElementById("statusFilter");

  let APPS = [];

  function mapRow(a) {
    return {
      id: a.applicationId,
      company: a.businessName,
      biz: a.businessRegistrationNumber,
      ceo: a.representativeName,
      category: "-",
      fileUrl: a.businessRegistrationFileUrl,
      created: (a.createdAt || "").slice(0, 10),
      status: FROM_ENUM[a.status] || "wait",
    };
  }

  function render(list, total = list.length) {
    if (!list.length) {
      rowsEl.innerHTML = '<tr class="empty-row"><td colspan="9">조건에 맞는 신청이 없습니다.</td></tr>';
      countEl.textContent = 0;
      return;
    }
    rowsEl.innerHTML = list.map((a) => `
      <tr data-id="${a.id}">
        <td class="num">${a.id}</td>
        <td class="strong">${esc(a.company)}</td>
        <td class="muted">${esc(a.biz)}</td>
        <td>${esc(a.ceo)}</td>
        <td class="muted">${a.category}</td>
        <td><button class="btn sm ghost" data-act="docs">서류 보기</button></td>
        <td class="muted">${a.created}</td>
        <td><span class="tag ${a.status}">${STATUS[a.status]}</span></td>
        <td>
          ${a.status === "wait"
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

  function applySearch() {
    const q = qEl.value.trim().toLowerCase();
    listController.setItems(APPS.filter((a) =>
      !q || a.company.toLowerCase().includes(q) || a.ceo.toLowerCase().includes(q) || (a.biz || "").includes(q)
    ));
  }
  qEl.addEventListener("input", applySearch);
  if (statusEl) statusEl.addEventListener("change", () => load());

  rowsEl.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const id = btn.closest("tr").dataset.id;
    const app = APPS.find((x) => String(x.id) === String(id));
    if (!app) return;
    const act = btn.dataset.act;

    if (act === "docs") {
      if (app.fileUrl && /^https?:\/\//i.test(app.fileUrl)) window.open(app.fileUrl, "_blank", "noopener");
      else if (app.fileUrl) AdminUI.toast("서류 URL 형식이 올바르지 않습니다.");
      else AdminUI.toast("제출된 서류 파일이 없습니다.");
      return;
    }

    if (act === "approve") {
      const ok = await AdminUI.confirm({
        title: "입점 승인",
        message: `[${app.company}]의 입점을 승인하시겠습니까? 승인 시 판매자 계정이 활성화됩니다.`,
        okText: "승인",
      });
      if (!ok) return;
      try {
        await AdminApi.post(`/sellers/applications/${app.id}/status`, { decision: "APPROVE" });
        AdminUI.toast("입점이 승인되었습니다.");
        load();
      } catch (err) { AdminUI.toast(err.message || "승인에 실패했습니다."); }
    } else {
      const res = await AdminUI.form({
        title: "입점 반려",
        message: `[${app.company}] 신청을 반려합니다. 사유를 입력하세요.`,
        okText: "반려 처리",
        fields: [{ name: "reason", label: "반려 사유", type: "textarea", placeholder: "예: 사업자등록증 사본이 불명확합니다." }],
      });
      if (!res) return;
      try {
        await AdminApi.post(`/sellers/applications/${app.id}/status`, { decision: "REJECT", rejectionReason: res.reason || "" });
        AdminUI.toast("반려 처리되었습니다.");
        load();
      } catch (err) { AdminUI.toast(err.message || "반려에 실패했습니다."); }
    }
  });

  async function load() {
    const enumStatus = TO_ENUM[statusEl ? statusEl.value : ""] || "PENDING";
    try {
      const data = await AdminApi.list(`/sellers/applications?status=${enumStatus}`);
      APPS = data.map(mapRow);
      applySearch();
    } catch (err) {
      rowsEl.innerHTML = `<tr class="empty-row"><td colspan="9">${esc(err.message || "목록을 불러오지 못했습니다.")}</td></tr>`;
      countEl.textContent = 0;
    }
  }

  load();
})();
