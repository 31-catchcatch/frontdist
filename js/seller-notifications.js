// seller-notifications.js — 판매자 알림센터 조회 및 읽음 처리

document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = (window.CATCHCATCH_API_BASE_URL || "/api/v1").replace(/\/$/, "");
  const NOTIFICATION_API = `${API_BASE}/notifications`;

  const listElement = document.querySelector('[data-role="notification-list"]');
  const emptyElement = document.querySelector('[data-role="notification-empty"]');
  const messageElement = document.querySelector('[data-role="notification-message"]');
  const summaryElement = document.querySelector(".notification-summary");
  const filterButtons = [...document.querySelectorAll(".notification-summary-card")];
  const filterTitle = document.querySelector('[data-role="filter-title"]');
  const filterDescription = document.querySelector('[data-role="filter-description"]');
  const markAllButton = document.querySelector('[data-action="mark-all-read"]');

  let notifications = [];
  let currentFilter = "all";

  if (window.CatchAuth && typeof CatchAuth.requireLogin === "function") {
    if (!CatchAuth.requireLogin()) return;
  }

  const isFilePreview = location.protocol === "file:";

  const previewNotifications = [
    {
      notificationId: 301,
      type: "COUPON_APPROVED",
      title: "쿠폰 발행 요청이 승인되었습니다.",
      message: "‘여름 시즌 10% 할인’ 쿠폰 발행 요청이 관리자 승인되었습니다. 설정한 사용 기간에 맞춰 쿠폰이 활성화됩니다.",
      couponName: "여름 시즌 10% 할인",
      requestId: 12,
      createdAt: "2026-07-16T14:20:00",
      isRead: false
    },
    {
      notificationId: 300,
      type: "COUPON_REJECTED",
      title: "쿠폰 발행 요청이 반려되었습니다.",
      message: "‘신규 회원 정액 할인’ 요청이 반려되었습니다. 반려 사유: 최대 할인금액을 다시 확인해 주세요.",
      couponName: "신규 회원 정액 할인",
      requestId: 11,
      rejectionReason: "최대 할인금액을 다시 확인해 주세요.",
      createdAt: "2026-07-15T11:05:00",
      isRead: true
    }
  ];

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getBody(result) {
    return result?.data ?? result ?? {};
  }

  function extractItems(result) {
    const body = getBody(result);
    const candidates = [
      body?.content,
      body?.notifications,
      body?.items,
      body?.list,
      body
    ];

    return candidates.find(Array.isArray) || [];
  }

  function normalizeBoolean(value) {
    if (value === true || value === false) return value;
    if (typeof value === "string") return value.toLowerCase() === "true";
    return Boolean(value);
  }

  function inferResult(item) {
    const raw = String(
      item.result ??
      item.status ??
      item.approvalStatus ??
      item.type ??
      item.notificationType ??
      ""
    ).toUpperCase();

    const text = `${item.title ?? ""} ${item.message ?? item.content ?? ""}`;

    if (raw.includes("APPROV") || raw.includes("ACCEPT") || text.includes("승인")) {
      return "approved";
    }
    if (raw.includes("REJECT") || raw.includes("DENY") || text.includes("반려")) {
      return "rejected";
    }
    if (raw.includes("PENDING") || text.includes("대기")) {
      return "pending";
    }
    return "general";
  }

  function normalizeNotification(item, index) {
    const data = item.data && typeof item.data === "object" ? item.data : {};
    const result = inferResult(item);
    const id = item.notificationId ?? item.id ?? item.notification_id ?? `local-${index}`;
    const isRead = normalizeBoolean(
      item.isRead ?? item.read ?? item.readYn ?? item.readAt != null
    );

    return {
      id,
      result,
      title:
        item.title ||
        (result === "approved"
          ? "쿠폰 발행 요청이 승인되었습니다."
          : result === "rejected"
            ? "쿠폰 발행 요청이 반려되었습니다."
            : "새로운 알림이 도착했습니다."),
      message: item.message ?? item.content ?? item.body ?? "알림 내용을 확인해 주세요.",
      couponName: item.couponName ?? data.couponName ?? data.coupon_name ?? "",
      requestId: item.requestId ?? data.requestId ?? data.couponRequestId ?? "",
      rejectionReason: item.rejectionReason ?? data.rejectionReason ?? "",
      createdAt: item.createdAt ?? item.sentAt ?? item.date ?? item.updatedAt ?? "",
      isRead
    };
  }

  function formatDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).replace("T", " ").slice(0, 16);

    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(date);
  }

  function resultText(result) {
    return {
      approved: "승인",
      rejected: "반려",
      pending: "대기",
      general: "알림"
    }[result] || "알림";
  }

  function resultIcon(result) {
    return {
      approved: "✓",
      rejected: "!",
      pending: "…",
      general: "i"
    }[result] || "i";
  }

  function getFilteredItems() {
    if (currentFilter === "unread") return notifications.filter((item) => !item.isRead);
    if (currentFilter === "approved") return notifications.filter((item) => item.result === "approved");
    if (currentFilter === "rejected") return notifications.filter((item) => item.result === "rejected");
    return notifications;
  }

  function updateCounts() {
    const counts = {
      all: notifications.length,
      unread: notifications.filter((item) => !item.isRead).length,
      approved: notifications.filter((item) => item.result === "approved").length,
      rejected: notifications.filter((item) => item.result === "rejected").length
    };

    document.querySelector('[data-role="count-all"]').textContent = `${counts.all}건`;
    document.querySelector('[data-role="count-unread"]').textContent = `${counts.unread}건`;
    document.querySelector('[data-role="count-approved"]').textContent = `${counts.approved}건`;
    document.querySelector('[data-role="count-rejected"]').textContent = `${counts.rejected}건`;

    summaryElement?.setAttribute("aria-busy", "false");
    markAllButton.disabled = counts.unread === 0;
  }

  function updateFilterCopy() {
    const copy = {
      all: ["전체 알림", "최근 알림부터 표시됩니다."],
      unread: ["읽지 않은 알림", "아직 확인하지 않은 알림만 표시됩니다."],
      approved: ["승인 알림", "관리자가 승인한 쿠폰 발행 요청입니다."],
      rejected: ["반려 알림", "관리자가 반려한 쿠폰 발행 요청입니다."]
    }[currentFilter];

    filterTitle.textContent = copy[0];
    filterDescription.textContent = copy[1];
  }

  function render() {
    const items = getFilteredItems();
    updateCounts();
    updateFilterCopy();

    listElement.setAttribute("aria-busy", "false");

    if (items.length === 0) {
      listElement.hidden = true;
      emptyElement.hidden = false;
      return;
    }

    listElement.hidden = false;
    emptyElement.hidden = true;

    listElement.innerHTML = items.map((item) => {
      const meta = [
        item.couponName ? `쿠폰명: ${escapeHTML(item.couponName)}` : "",
        item.requestId !== "" ? `요청 ID: ${escapeHTML(item.requestId)}` : "",
        item.rejectionReason ? `반려 사유: ${escapeHTML(item.rejectionReason)}` : ""
      ].filter(Boolean);

      return `
        <article class="notification-item ${item.isRead ? "" : "is-unread"}" data-id="${escapeHTML(item.id)}" data-result="${item.result}">
          <div class="notification-icon" aria-hidden="true">${resultIcon(item.result)}</div>

          <div class="notification-content">
            <div class="notification-headline">
              <h4>${escapeHTML(item.title)}</h4>
              <span class="notification-badge ${item.result}">${resultText(item.result)}</span>
            </div>
            <p class="notification-text">${escapeHTML(item.message)}</p>
            ${meta.length ? `<div class="notification-meta">${meta.map((value) => `<span>${value}</span>`).join("")}</div>` : ""}
          </div>

          <div class="notification-side">
            <time class="notification-date">${formatDate(item.createdAt)}</time>
            <button type="button" class="btn-read" data-action="read" ${item.isRead ? "disabled" : ""}>
              ${item.isRead ? "읽음" : "읽음 처리"}
            </button>
          </div>

          ${item.isRead ? "" : '<span class="unread-dot" aria-label="읽지 않은 알림"></span>'}
        </article>
      `;
    }).join("");
  }

  async function requestApi(url, options = {}) {
    const response = await fetch(url, {
      credentials: "include",
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.headers || {})
      }
    });

    let result = {};
    try {
      result = await response.json();
    } catch (_) {
      result = {};
    }

    if (response.status === 401 || response.status === 403) {
      if (window.CatchAuth && typeof CatchAuth.logout === "function") {
        CatchAuth.logout();
      }
      throw new Error("판매자 로그인이 필요합니다.");
    }

    if (!response.ok) {
      throw new Error(result.message || `알림 요청에 실패했습니다. (${response.status})`);
    }

    return result;
  }

  async function loadNotifications() {
    messageElement.hidden = true;

    if (isFilePreview) {
      notifications = previewNotifications.map(normalizeNotification);
      render();
      return;
    }

    const result = await requestApi(NOTIFICATION_API, { method: "GET" });
    notifications = extractItems(result)
      .map(normalizeNotification)
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    render();
  }

  async function markAsRead(id) {
    if (!isFilePreview) {
      await requestApi(`${NOTIFICATION_API}/${encodeURIComponent(id)}/read`, {
        method: "PATCH"
      });
    }

    const target = notifications.find((item) => String(item.id) === String(id));
    if (target) target.isRead = true;
    render();
  }

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      currentFilter = button.dataset.filter || "all";
      filterButtons.forEach((item) => item.classList.toggle("active", item === button));
      render();
    });
  });

  listElement.addEventListener("click", async (event) => {
    const button = event.target.closest('[data-action="read"]');
    if (!button) return;

    const item = button.closest(".notification-item");
    if (!item) return;

    button.disabled = true;
    try {
      await markAsRead(item.dataset.id);
    } catch (error) {
      button.disabled = false;
      messageElement.textContent = error.message;
      messageElement.hidden = false;
    }
  });

  markAllButton.addEventListener("click", async () => {
    const unreadItems = notifications.filter((item) => !item.isRead);
    if (unreadItems.length === 0) return;

    markAllButton.disabled = true;
    markAllButton.textContent = "처리 중...";

    try {
      for (const item of unreadItems) {
        await markAsRead(item.id);
      }
    } catch (error) {
      messageElement.textContent = error.message;
      messageElement.hidden = false;
    } finally {
      markAllButton.textContent = "모두 읽음 처리";
      updateCounts();
    }
  });

  loadNotifications().catch((error) => {
    console.error("판매자 알림센터 조회 실패:", error);
    listElement.setAttribute("aria-busy", "false");
    listElement.innerHTML = '<div class="notification-loading">알림을 불러오지 못했습니다.</div>';
    messageElement.textContent = error.message;
    messageElement.hidden = false;
    updateCounts();
  });
});
