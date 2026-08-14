(function () {
  "use strict";

  const STATUS = { wait: "대기", ok: "승인", stop: "반려" };
  const FROM_ENUM = { PENDING: "wait", APPROVED: "ok", REJECTED: "stop", CANCELED: "stop" };

  const NOTIFY_API = "/api/v1/notifications/send";
  const NOTIFY_TYPE = "QNA_ANSWER";

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
      sellerId: c.sellerId,          // 알림 발송용 (아래 resolveUserId 참고)
      seller: sellerLabel(c.sellerId),
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
      rowsEl.innerHTML = '<tr class="empty-row"><td colspan="8">조건에 맞는 요청이 없습니다.</td></tr>';
      countEl.textContent = 0;
      return;
    }
    rowsEl.innerHTML = list.map((c) => `
      <tr data-id="${c.id}">
        <td class="muted">${esc(c.seller)}</td>
        <td class="strong">${esc(c.name)}</td>
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

  const sellerByApplication = new Map();   // applicationId → { userId, businessName }
  const loadedStatuses = new Set();
  let usernameByUserId = null;             // userId → 로그인 아이디 (1회 조회)

  async function loadApplications(status) {
    if (loadedStatuses.has(status)) return;
    let list;
    try {
      list = await AdminApi.list(`/sellers/applications?status=${status}`);
    } catch (_) {
      return;                                    // 다음 조회 때 재시도할 수 있게 미표시로 남긴다
    }
    loadedStatuses.add(status);
    list.forEach((a) => {
      if (a && a.applicationId != null && a.userId != null) {
        sellerByApplication.set(String(a.applicationId), {
          userId: a.userId,
          businessName: a.businessName || ""
        });
      }
    });
  }

  async function loadUsernames() {
    if (usernameByUserId) return;
    const map = new Map();
    try {
      const users = await AdminApi.list("/users?size=200");
      users.forEach((u) => {
        if (u && u.userId != null && u.username) map.set(String(u.userId), u.username);
      });
    } catch (_) {
      // 실패해도 상호명으로는 표시할 수 있게 빈 표로 확정한다
    }
    usernameByUserId = map;
  }

  async function loadSellerDirectory(applicationIds) {
    await Promise.all([loadApplications("APPROVED"), loadUsernames()]);

    const isCovered = () => applicationIds.every((id) => sellerByApplication.has(String(id)));
    if (isCovered()) return;

    for (const status of ["PENDING", "REJECTED", "CANCELED"]) {
      await loadApplications(status);
      if (isCovered()) return;
    }
  }

  function sellerLabel(applicationId) {
    const info = sellerByApplication.get(String(applicationId));
    if (!info) return `판매자#${applicationId}`;          // 사전 조회 실패 시 기존 표기로 폴백

    const username = usernameByUserId && usernameByUserId.get(String(info.userId));
    if (username && info.businessName) return `${username} (${info.businessName})`;
    return username || info.businessName || `판매자#${applicationId}`;
  }

  async function resolveUserId(applicationId) {
    const key = String(applicationId);
    for (const status of ["APPROVED", "PENDING", "REJECTED", "CANCELED"]) {
      await loadApplications(status);
      const info = sellerByApplication.get(key);
      if (info) return info.userId;
    }
    return null;
  }

  function clamp(text, max) {
    const s = String(text ?? "");
    return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
  }

  async function notifySeller(userId, title, content) {
    const response = await fetch(NOTIFY_API, {
      method: "POST",
      headers: Object.assign(
        { Accept: "application/json", "Content-Type": "application/json" },
        AdminAuth.authorizationHeader()
      ),
      body: JSON.stringify({
        userId,
        type: NOTIFY_TYPE,
        title: clamp(title, 100),
        content: clamp(content, 255),
      }),
    });

    let payload = null;
    try {
      const text = await response.text();
      payload = text ? JSON.parse(text) : null;
    } catch (_) {
      payload = null;
    }

    if (!response.ok || (payload && payload.success === false)) {
      throw new Error((payload && payload.message) || `알림 발송에 실패했습니다. (${response.status})`);
    }
  }

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
    let rejectionReason = "";

    if (approve) {
      const ok = await AdminUI.confirm({
        title: "쿠폰 발행 승인",
        message: `[${c.seller}] '${c.name}' 쿠폰 발행을 승인하시겠습니까?`,
        okText: "승인",
      });
      if (!ok) return;
    } else {
      // 반려 사유는 판매자 알림 본문에 그대로 실리므로 관리자가 직접 입력받는다.
      const input = await AdminUI.form({
        title: "쿠폰 발행 반려",
        message: `[${c.seller}] '${c.name}' 쿠폰 발행 요청을 반려합니다. 입력한 사유가 판매자 알림에 그대로 표시됩니다.`,
        fields: [{
          name: "reason", label: "반려 사유", type: "textarea",
          placeholder: "예) 최대 할인금액을 다시 확인해 주세요.",
        }],
        okText: "반려",
      });
      if (input === null) return;

      rejectionReason = (input.reason || "").trim();
      if (!rejectionReason) {
        AdminUI.toast("반려 사유를 입력해 주세요.");
        return;
      }
    }

    try {
      await AdminApi.put(`/coupons/requests/${c.id}`, approve
        ? { decision: "APPROVE" }
        : { decision: "REJECT", rejectionReason });
      AdminUI.toast(approve ? "쿠폰 발행이 승인되었습니다." : "반려 처리되었습니다.");
    } catch (err) {
      AdminUI.toast(err.message || "처리에 실패했습니다.");
      return;
    }

    // 심사는 이미 확정됐다. 알림 발송이 실패해도 심사 실패로 보이면 안 되므로 따로 처리한다.
    try {
      const userId = await resolveUserId(c.sellerId);
      if (userId == null) {
        AdminUI.toast("심사는 완료됐지만 판매자 계정을 찾지 못해 알림을 보내지 못했습니다.");
      } else {
        await notifySeller(
          userId,
          approve ? "쿠폰 발행 요청이 승인되었습니다." : "쿠폰 발행 요청이 반려되었습니다.",
          approve
            ? `'${c.name}' 쿠폰 발행 요청(요청 ID: ${c.id})이 승인되었습니다. 설정하신 사용 기간에 맞춰 쿠폰이 활성화됩니다.`
            : `'${c.name}' 쿠폰 발행 요청(요청 ID: ${c.id})이 반려되었습니다. 반려 사유: ${rejectionReason}`
        );
      }
    } catch (err) {
      AdminUI.toast(`심사는 완료됐지만 판매자 알림 발송에 실패했습니다. (${err.message || "원인 미상"})`);
    }

    load();
  });

  async function load() {
    try {
      const data = await AdminApi.list("/coupons/requests?size=200");

      await loadSellerDirectory(data.map((c) => c.sellerId));

      COUPONS = data.map(mapRow);
      applyFilter();
    } catch (err) {
      rowsEl.innerHTML = `<tr class="empty-row"><td colspan="8">${err.message || "목록을 불러오지 못했습니다."}</td></tr>`;
      countEl.textContent = 0;
    }
  }

  load();
})();
