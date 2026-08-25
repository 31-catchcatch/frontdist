(function () {
  "use strict";

  const STATUS = { wait: "대기", ok: "승인", stop: "반려" };
  const FROM_ENUM = { PENDING: "wait", APPROVED: "ok", REJECTED: "stop", CANCELED: "stop" };

  const NOTIFY_API = "/api/v1/notifications/send";
  const NOTIFY_TYPE = "QNA_ANSWER";

  const rowsEl = document.getElementById("rows");
  const headRowEl = document.getElementById("headRow");
  const countEl = document.getElementById("count");
  const qEl = document.getElementById("q");
  const statusEl = document.getElementById("statusFilter");
  const viewEl = document.getElementById("viewFilter");
  const createBtn = document.getElementById("createBtn");
  const badgeEl = document.querySelector(".preview-badge");


  const VIEWS = {
    requests: {
      head: ["판매자", "쿠폰명", "할인", "발행수량", "사용기간", "요청일", "상태", "인가"],
      badge: "실시간 데이터 · /api/v1/admin/coupons/requests",
    },
    coupons: {
      head: ["발행 주체", "쿠폰명", "할인", "발행수량", "사용기간", "발행일", "상태", "관리"],
      badge: "실시간 데이터 · /api/v1/admin/coupons",
    },
  };

  let view = "requests";
  let COUPONS = [];

  function formatDiscount(type, value) {
    const v = Number(value);
    if (type && String(type).toUpperCase().includes("PERCENT")) return `${v}%`;
    return `${AdminUI.num(v)}원`;
  }


  function mapCouponRow(c) {
    const soldOut = (c.issuedQuantity ?? 0) >= (c.totalQuantity ?? 0);
    return {
      id: c.couponId,
      seller: c.sellerName || `판매자#${c.sellerId}`,
      name: c.couponName,
      discount: formatDiscount(c.discountType, c.discountValue),
      qty: `${AdminUI.num(c.issuedQuantity ?? 0)} / ${AdminUI.num(c.totalQuantity ?? 0)}`,
      period: c.validUntil ? `~${String(c.validUntil).slice(0, 10)}` : "-",
      created: (c.createdAt || "").slice(0, 10),

      status: !c.active ? "stop" : (soldOut ? "wait" : "ok"),
      statusLabel: !c.active ? "중지" : (soldOut ? "소진" : "발행중"),
    };
  }


  function mapRow(c) {
    return {
      id: c.requestId,
      sellerId: c.sellerId,
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
      const empty = view === "requests" ? "조건에 맞는 요청이 없습니다." : "발행된 쿠폰이 없습니다.";
      rowsEl.innerHTML = `<tr class="empty-row"><td colspan="8">${empty}</td></tr>`;
      countEl.textContent = 0;
      return;
    }

    if (view === "coupons") {
      rowsEl.innerHTML = list.map((c) => `
      <tr data-id="${c.id}">
        <td class="muted">${esc(c.seller)}</td>
        <td class="strong">${esc(c.name)}</td>
        <td class="num">${c.discount}</td>
        <td class="num">${c.qty}</td>
        <td class="muted">${c.period}</td>
        <td class="muted">${c.created}</td>
        <td><span class="tag ${c.status}">${c.statusLabel}</span></td>
        <td><span class="muted">-</span></td>
      </tr>`).join("");
      countEl.textContent = total;
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

  const sellerByApplication = new Map();
  const loadedStatuses = new Set();
  let usernameByUserId = null;

  async function loadApplications(status) {
    if (loadedStatuses.has(status)) return;
    let list;
    try {
      list = await AdminApi.list(`/sellers/applications?status=${status}`);
    } catch (_) {
      return;
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
    if (!info) return `판매자#${applicationId}`;

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

    const status = view === "requests" && statusEl ? statusEl.value : "";
    listController.setItems(COUPONS.filter((c) =>
      (!status || c.status === status) &&
      (!q || c.seller.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
    ));
  }


  function applyView() {
    const conf = VIEWS[view];
    headRowEl.innerHTML = conf.head
      .map((h, i) => `<th${i === 1 ? ' class="grow"' : (i === 2 || i === 3 ? ' class="num"' : "")}>${h}</th>`)
      .join("");
    if (badgeEl) badgeEl.textContent = conf.badge;
    statusEl.hidden = view !== "requests";
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
      if (view === "coupons") {
        const data = await AdminApi.list("/coupons?size=200");
        COUPONS = data.map(mapCouponRow);
      } else {
        const data = await AdminApi.list("/coupons/requests?size=200");

        await loadSellerDirectory(data.map((c) => c.sellerId));
        COUPONS = data.map(mapRow);
      }
      applyFilter();
    } catch (err) {
      rowsEl.innerHTML = `<tr class="empty-row"><td colspan="8">${esc(err.message || "목록을 불러오지 못했습니다.")}</td></tr>`;
      countEl.textContent = 0;
    }
  }

  viewEl.addEventListener("change", () => {
    view = viewEl.value;
    applyView();
    load();
  });


  async function sellerOptions() {
    await Promise.all([loadApplications("APPROVED"), loadUsernames()]);
    return [...sellerByApplication.keys()]
      .map((applicationId) => ({ value: applicationId, label: sellerLabel(applicationId) }))
      .sort((a, b) => a.label.localeCompare(b.label, "ko"));
  }

  function validateCouponDraft(d) {
    const name = (d.couponName || "").trim();
    if (!d.sellerId) return "쿠폰을 발행할 입점업체를 선택해 주세요.";
    const discountValue = Number(d.discountValue);
    const totalQuantity = Number(d.totalQuantity);
    const isPercent = d.discountType === "PERCENTAGE";

    if (!name) return "쿠폰명을 입력해 주세요.";
    if (name.length > 100) return "쿠폰명은 100자 이하여야 합니다.";
    if (!discountValue || discountValue <= 0) return "할인 값은 0보다 커야 합니다.";
    if (isPercent && (discountValue < 1 || discountValue > 100)) return "정률 할인은 1~100 사이여야 합니다.";
    if (!Number.isInteger(totalQuantity) || totalQuantity < 1) return "발행 수량은 1개 이상이어야 합니다.";
    if (!d.validFrom || !d.validUntil) return "사용 기간을 입력해 주세요.";
    if (d.validUntil <= d.validFrom) return "사용 종료일은 시작일보다 이후여야 합니다.";
    return null;
  }

  createBtn.addEventListener("click", async () => {
    const pad = (n) => String(n).padStart(2, "0");
    const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const today = new Date();


    const sellers = await sellerOptions();
    if (!sellers.length) {
      AdminUI.toast("승인된 입점업체가 없어 쿠폰을 발행할 수 없습니다.");
      return;
    }

    const draft = {
      sellerId: sellers[0].value,
      couponName: "", discountType: "FIXED_AMOUNT", discountValue: "",
      minimumOrderAmount: "0", maximumDiscountAmount: "", totalQuantity: "",
      validFrom: ymd(today),
      validUntil: ymd(new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)),
    };

    while (true) {
      const res = await AdminUI.form({
        title: "쿠폰 직접 발행",
        message: "판매자 요청 없이 관리자가 바로 발행합니다. 쿠폰은 선택한 업체의 상품에만 사용할 수 있습니다.",
        okText: "발행",
        fields: [
          { name: "sellerId", label: "발행 대상 업체", type: "select", value: draft.sellerId, options: sellers },
          { name: "couponName", label: "쿠폰명", value: draft.couponName, placeholder: "예) 여름 할인" },
          { name: "discountType", label: "할인 방식", type: "select", value: draft.discountType, options: [
            { value: "FIXED_AMOUNT", label: "정액 할인(원)" },
            { value: "PERCENTAGE", label: "정률 할인(%)" },
          ] },
          { name: "discountValue", label: "할인 값", type: "number", value: draft.discountValue, placeholder: "정액이면 원, 정률이면 1~100" },
          { name: "minimumOrderAmount", label: "최소 주문금액", type: "number", value: draft.minimumOrderAmount },
          { name: "maximumDiscountAmount", label: "최대 할인금액 (정률일 때만)", type: "number", value: draft.maximumDiscountAmount, placeholder: "비우면 제한 없음" },
          { name: "totalQuantity", label: "발행 수량", type: "number", value: draft.totalQuantity, placeholder: "예) 100" },
          { name: "validFrom", label: "사용 시작일", type: "date", value: draft.validFrom },
          { name: "validUntil", label: "사용 종료일", type: "date", value: draft.validUntil },
        ],
      });
      if (!res) return;
      Object.assign(draft, res);

      const message = validateCouponDraft(draft);
      if (message) { AdminUI.toast(message); continue; }

      const isPercent = draft.discountType === "PERCENTAGE";

      const body = {
        sellerId: Number(draft.sellerId),
        couponName: draft.couponName.trim(),
        discountType: draft.discountType,
        discountValue: Number(draft.discountValue),
        minimumOrderAmount: Number(draft.minimumOrderAmount || 0),
        maximumDiscountAmount: isPercent && draft.maximumDiscountAmount ? Number(draft.maximumDiscountAmount) : null,
        totalQuantity: Number(draft.totalQuantity),
        validFrom: `${draft.validFrom}T00:00`,
        validUntil: `${draft.validUntil}T23:59`,
      };

      try {
        await AdminApi.post("/coupons", body);
        AdminUI.toast("쿠폰이 발행되었습니다.");

        view = "coupons";
        viewEl.value = "coupons";
        applyView();
        await load();
        return;
      } catch (err) {
        AdminUI.toast(err.message || "쿠폰 발행에 실패했습니다.");
        return;
      }
    }
  });

  applyView();
  load();
})();
