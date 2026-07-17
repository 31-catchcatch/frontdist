(() => {
  "use strict";

  const ORDERS_API = "/api/v1/seller/orders";
  const PAGE_SIZE = 10;
  const FILE_PREVIEW_MODE = location.protocol === "file:";

  const tableBody = document.getElementById("ordersTableBody");
  const mobileList = document.getElementById("mobileOrderList");
  const pagination = document.getElementById("pagination");
  const searchForm = document.getElementById("orderSearchForm");
  const keywordInput = document.getElementById("orderKeyword");
  const statusFilter = document.getElementById("statusFilter");
  const sortFilter = document.getElementById("sortFilter");
  const pageMessage = document.getElementById("pageMessage");

  const totalCount = document.getElementById("totalCount");
  const paidCount = document.getElementById("paidCount");
  const readyCount = document.getElementById("readyCount");
  const shippingCount = document.getElementById("shippingCount");

  const deliveryModal = document.getElementById("deliveryModal");
  const deliveryForm = document.getElementById("deliveryForm");
  const modalOrderNumber = document.getElementById("modalOrderNumber");
  const modalOrderDetailId = document.getElementById("modalOrderDetailId");
  const courierCompany = document.getElementById("courierCompany");
  const trackingNumber = document.getElementById("trackingNumber");
  const modalMessage = document.getElementById("modalMessage");
  const modalCancelButton = document.getElementById("modalCancelButton");
  const modalSubmitButton = document.getElementById("modalSubmitButton");

  let currentPage = 0;
  let totalPages = 1;
  let currentOrders = [];

  const previewOrders = [
    {
      orderDetailId: 1201,
      orderNumber: "CC202607140001",
      orderedAt: "2026-07-14T11:20:00",
      productName: "릴렉스 핏 쿨 코튼 반팔 티셔츠",
      optionText: "화이트 / L",
      imageUrl: "",
      buyerName: "김민수",
      quantity: 2,
      paymentAmount: 39800,
      status: "PAYMENT_COMPLETED"
    },
    {
      orderDetailId: 1202,
      orderNumber: "CC202607140002",
      orderedAt: "2026-07-14T10:15:00",
      productName: "와이드 원턱 코튼 팬츠",
      optionText: "블랙 / M",
      imageUrl: "",
      buyerName: "이서연",
      quantity: 1,
      paymentAmount: 39900,
      status: "PREPARING"
    },
    {
      orderDetailId: 1203,
      orderNumber: "CC202607130008",
      orderedAt: "2026-07-13T18:40:00",
      productName: "미니멀 데일리 크로스백",
      optionText: "블랙",
      imageUrl: "",
      buyerName: "박지훈",
      quantity: 1,
      paymentAmount: 32900,
      status: "SHIPPING",
      courierCompany: "CJ_LOGISTICS",
      trackingNumber: "123456789012"
    }
  ];

  function isSellerLoggedIn() {
    const loggedIn =
      sessionStorage.getItem("catchcatch.loggedIn") === "true" ||
      Boolean(sessionStorage.getItem("catchcatch.accessToken")) ||
      Boolean(localStorage.getItem("catchcatch.accessToken"));

    return (
      loggedIn &&
      sessionStorage.getItem("catchcatch.loginType") === "seller"
    );
  }

  function moveToSellerLogin() {
    location.replace(
      "login.html?type=seller&redirect=seller-orders.html"
    );
  }

  if (!FILE_PREVIEW_MODE && !isSellerLoggedIn()) {
    moveToSellerLogin();
    return;
  }

  function clearLoginState() {
    sessionStorage.removeItem("catchcatch.loggedIn");
    sessionStorage.removeItem("catchcatch.loginType");
    sessionStorage.removeItem("catchcatch.accessToken");
    localStorage.removeItem("catchcatch.accessToken");
  }

  function handleUnauthorized(response) {
    if (response.status !== 401 && response.status !== 403) {
      return false;
    }

    clearLoginState();
    moveToSellerLogin();
    return true;
  }

  function showMessage(message, type = "error") {
    pageMessage.textContent = message;
    pageMessage.classList.add("show");
    pageMessage.classList.toggle("success", type === "success");
  }

  function clearMessage() {
    pageMessage.textContent = "";
    pageMessage.classList.remove("show", "success");
  }

  function showModalMessage(message) {
    modalMessage.textContent = message;
    modalMessage.classList.add("show");
  }

  function clearModalMessage() {
    modalMessage.textContent = "";
    modalMessage.classList.remove("show");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatPrice(value) {
    const number = Number(value);
    return Number.isFinite(number)
      ? `${number.toLocaleString("ko-KR")}원`
      : "-";
  }

  function formatDate(value) {
    if (!value) return "-";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function normalizeStatus(rawStatus) {
    const code = String(rawStatus || "PAYMENT_COMPLETED").toUpperCase();

    const map = {
      PAYMENT_COMPLETED: {
        label: "결제 완료",
        className: "status-paid"
      },
      PREPARING: {
        label: "배송 준비",
        className: "status-preparing"
      },
      SHIPPING: {
        label: "배송 중",
        className: "status-shipping"
      },
      DELIVERED: {
        label: "배송 완료",
        className: "status-delivered"
      },
      CONFIRMED: {
        label: "구매 확정",
        className: "status-delivered"
      },
      CANCELED: {
        label: "취소",
        className: "status-cancelled"
      }
    };

    return {
      code,
      ...(map[code] || map.PAYMENT_COMPLETED)
    };
  }

  function normalizeOrder(raw) {
    return {
      orderDetailId:
        raw.orderDetailId ??
        raw.id ??
        "",
      orderNumber:
        raw.orderNumber ??
        raw.orderNo ??
        raw.orderId ??
        "-",
      orderedAt:
        raw.orderedAt ??
        raw.createdAt ??
        raw.orderDate ??
        "",
      productName:
        raw.productName ??
        raw.product?.name ??
        "상품명 없음",
      optionText:
        raw.optionText ??
        raw.optionName ??
        raw.productOption ??
        "",
      imageUrl:
        raw.thumbnailUrl ??
        raw.imageUrl ??
        raw.product?.thumbnailUrl ??
        "",
      buyerName:
        raw.buyerName ??
        raw.customerName ??
        raw.userName ??
        "-",
      quantity:
        raw.quantity ??
        raw.orderQuantity ??
        1,
      paymentAmount:
        raw.paymentAmount ??
        raw.totalPrice ??
        raw.orderPrice ??
        0,
      status: normalizeStatus(
        raw.deliveryStatus ??
        raw.orderStatus ??
        raw.status
      ),
      courierCompany:
        raw.courierCompany ??
        raw.courier ??
        "",
      trackingNumber:
        raw.trackingNumber ??
        raw.invoiceNumber ??
        ""
    };
  }

  function extractPageData(data) {
    const body = data?.data ?? data ?? {};

    const rawItems =
      body.content ??
      body.items ??
      body.orders ??
      body.list ??
      (Array.isArray(body) ? body : []);

    const orders = Array.isArray(rawItems)
      ? rawItems.map(normalizeOrder)
      : [];

    return {
      orders,
      totalElements: Number(
        body.totalElements ??
        body.totalCount ??
        orders.length
      ),
      totalPages: Number(body.totalPages ?? 1),
      page: Number(body.number ?? body.page ?? currentPage)
    };
  }

  function renderStatus(status) {
    return `
      <span class="status-badge ${status.className}">
        ${escapeHtml(status.label)}
      </span>
    `;
  }

  function canUpdateDelivery(status) {
    // 백엔드는 결제완료/배송준비 상태에서만 택배사·운송장 등록을 허용한다.
    return ["PAYMENT_COMPLETED", "PREPARING"].includes(status.code);
  }

  function renderDesktop(orders) {
    if (!orders.length) {
      tableBody.innerHTML = `
        <tr>
          <td class="state-cell" colspan="7">조건에 맞는 주문이 없습니다.</td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = orders.map((order) => `
      <tr>
        <td>
          <strong class="order-number">${escapeHtml(order.orderNumber)}</strong>
          <span class="order-date">${escapeHtml(formatDate(order.orderedAt))}</span>
        </td>
        <td>
          <div class="product-info">
            ${
              order.imageUrl
                ? `<img class="product-thumb" src="${escapeHtml(order.imageUrl)}" alt="">`
                : `<div class="product-thumb" aria-hidden="true"></div>`
            }
            <div class="product-copy">
              <strong>${escapeHtml(order.productName)}</strong>
              <span>${escapeHtml(order.optionText || "옵션 없음")}</span>
            </div>
          </div>
        </td>
        <td>${escapeHtml(order.buyerName)}</td>
        <td>${Number(order.quantity).toLocaleString("ko-KR")}개</td>
        <td>${formatPrice(order.paymentAmount)}</td>
        <td>${renderStatus(order.status)}</td>
        <td>
          <button
            class="delivery-button"
            type="button"
            data-order-detail-id="${escapeHtml(order.orderDetailId)}"
            ${canUpdateDelivery(order.status) ? "" : "disabled"}
          >
            배송 등록
          </button>
        </td>
      </tr>
    `).join("");
  }

  function renderMobile(orders) {
    if (!orders.length) {
      mobileList.innerHTML =
        '<p class="mobile-state">조건에 맞는 주문이 없습니다.</p>';
      return;
    }

    mobileList.innerHTML = orders.map((order) => `
      <article class="mobile-order-card">
        <div class="mobile-order-head">
          <div>
            <strong class="order-number">${escapeHtml(order.orderNumber)}</strong>
            <span class="order-date">${escapeHtml(formatDate(order.orderedAt))}</span>
          </div>
          ${renderStatus(order.status)}
        </div>

        <div class="mobile-product-row">
          ${
            order.imageUrl
              ? `<img class="product-thumb" src="${escapeHtml(order.imageUrl)}" alt="">`
              : `<div class="product-thumb" aria-hidden="true"></div>`
          }
          <div class="product-copy">
            <strong>${escapeHtml(order.productName)}</strong>
            <span>${escapeHtml(order.optionText || "옵션 없음")}</span>
          </div>
        </div>

        <div class="mobile-order-meta">
          <span>구매자</span><b>${escapeHtml(order.buyerName)}</b>
          <span>수량</span><b>${Number(order.quantity).toLocaleString("ko-KR")}개</b>
          <span>결제 금액</span><b>${formatPrice(order.paymentAmount)}</b>
        </div>

        <button
          class="delivery-button"
          type="button"
          data-order-detail-id="${escapeHtml(order.orderDetailId)}"
          ${canUpdateDelivery(order.status) ? "" : "disabled"}
        >
          배송 정보 등록
        </button>
      </article>
    `).join("");
  }

  function renderSummary(orders, serverTotal) {
    const counts = {
      PAID: 0,
      PREPARING: 0,
      SHIPPING: 0
    };

    orders.forEach((order) => {
      if (counts[order.status.code] !== undefined) {
        counts[order.status.code] += 1;
      }
    });

    totalCount.textContent =
      Number(serverTotal || orders.length).toLocaleString("ko-KR");
    paidCount.textContent =
      counts.PAID.toLocaleString("ko-KR");
    readyCount.textContent =
      counts.PREPARING.toLocaleString("ko-KR");
    shippingCount.textContent =
      counts.SHIPPING.toLocaleString("ko-KR");
  }

  function renderPagination() {
    pagination.innerHTML = "";

    if (totalPages <= 1) return;

    const previous = document.createElement("button");
    previous.type = "button";
    previous.textContent = "‹";
    previous.disabled = currentPage === 0;
    previous.addEventListener("click", () => loadOrders(currentPage - 1));
    pagination.appendChild(previous);

    const start = Math.max(0, currentPage - 2);
    const end = Math.min(totalPages, start + 5);

    for (let page = start; page < end; page += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = String(page + 1);
      button.classList.toggle("on", page === currentPage);
      button.addEventListener("click", () => loadOrders(page));
      pagination.appendChild(button);
    }

    const next = document.createElement("button");
    next.type = "button";
    next.textContent = "›";
    next.disabled = currentPage >= totalPages - 1;
    next.addEventListener("click", () => loadOrders(currentPage + 1));
    pagination.appendChild(next);
  }

  function getFilteredPreviewOrders() {
    const keyword = keywordInput.value.trim().toLowerCase();
    const status = statusFilter.value;

    return previewOrders
      .map(normalizeOrder)
      .filter((order) => {
        const matchesKeyword =
          !keyword ||
          order.orderNumber.toLowerCase().includes(keyword) ||
          order.buyerName.toLowerCase().includes(keyword) ||
          order.productName.toLowerCase().includes(keyword);

        const matchesStatus =
          !status ||
          order.status.code === status;

        return matchesKeyword && matchesStatus;
      });
  }

  async function loadOrders(page = 0) {
    clearMessage();

    tableBody.innerHTML = `
      <tr>
        <td class="state-cell" colspan="7">주문 목록을 불러오는 중입니다.</td>
      </tr>
    `;
    mobileList.innerHTML =
      '<p class="mobile-state">주문 목록을 불러오는 중입니다.</p>';

    if (FILE_PREVIEW_MODE) {
      currentOrders = getFilteredPreviewOrders();
      currentPage = 0;
      totalPages = 1;

      renderDesktop(currentOrders);
      renderMobile(currentOrders);
      renderSummary(currentOrders, currentOrders.length);
      renderPagination();
      return;
    }

    // 백엔드(SellerOrderSearchRequest)는 page/size/deliveryStatus만 지원한다.
    // keyword/sort는 서버에 없는 파라미터라 보내지 않고, keyword는 받아온 페이지 안에서만 클라이언트 필터링한다.
    const params = new URLSearchParams({
      page: String(page),
      size: String(PAGE_SIZE)
    });

    const status = statusFilter.value;
    if (status) params.set("deliveryStatus", status);

    try {
      const response = await fetch(
        `${ORDERS_API}?${params.toString()}`,
        {
          method: "GET",
          credentials: "include"
        }
      );

      if (handleUnauthorized(response)) return;

      let data = {};
      try {
        data = await response.json();
      } catch (_) {}

      if (!response.ok) {
        throw new Error(
          data.message || "주문 목록을 불러오지 못했습니다."
        );
      }

      const pageData = extractPageData(data);
      const keyword = keywordInput.value.trim().toLowerCase();

      currentOrders = keyword
        ? pageData.orders.filter((order) =>
            order.orderNumber.toLowerCase().includes(keyword) ||
            order.buyerName.toLowerCase().includes(keyword) ||
            order.productName.toLowerCase().includes(keyword))
        : pageData.orders;
      currentPage = pageData.page;
      totalPages = Math.max(1, pageData.totalPages);

      renderDesktop(currentOrders);
      renderMobile(currentOrders);
      renderSummary(currentOrders, pageData.totalElements);
      renderPagination();
    } catch (error) {
      tableBody.innerHTML = `
        <tr>
          <td class="state-cell" colspan="7">주문 목록을 불러오지 못했습니다.</td>
        </tr>
      `;
      mobileList.innerHTML =
        '<p class="mobile-state">주문 목록을 불러오지 못했습니다.</p>';

      showMessage(
        error instanceof TypeError
          ? "서버에 연결할 수 없습니다. WEB/WAS 서버 상태를 확인해 주세요."
          : error.message
      );
    }
  }

  function openDeliveryModal(orderDetailId) {
    const order = currentOrders.find(
      (item) => String(item.orderDetailId) === String(orderDetailId)
    );

    if (!order) return;

    modalOrderDetailId.value = order.orderDetailId;
    modalOrderNumber.textContent = order.orderNumber;
    courierCompany.value = order.courierCompany || "";
    trackingNumber.value = order.trackingNumber || "";

    clearModalMessage();
    deliveryModal.hidden = false;
    courierCompany.focus();
  }

  function closeDeliveryModal() {
    deliveryModal.hidden = true;
    deliveryForm.reset();
    modalOrderDetailId.value = "";
    clearModalMessage();
  }

  async function submitDelivery(event) {
    event.preventDefault();
    clearModalMessage();

    if (!deliveryForm.checkValidity()) {
      deliveryForm.reportValidity();
      return;
    }

    const orderDetailId = modalOrderDetailId.value;
    const payload = {
      courierCompany: courierCompany.value,
      trackingNumber: trackingNumber.value.trim()
    };

    modalSubmitButton.disabled = true;
    modalSubmitButton.textContent = "저장 중...";

    try {
      if (FILE_PREVIEW_MODE) {
        const previewOrder = previewOrders.find(
          (order) => String(order.orderDetailId) === String(orderDetailId)
        );

        if (previewOrder) {
          previewOrder.courierCompany = payload.courierCompany;
          previewOrder.trackingNumber = payload.trackingNumber;
          previewOrder.status = "SHIPPING";
        }

        closeDeliveryModal();
        showMessage("미리보기 모드에서 배송 정보가 반영되었습니다.", "success");
        loadOrders(currentPage);
        return;
      }

      const response = await fetch(
        `${ORDERS_API}/${encodeURIComponent(orderDetailId)}/delivery`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json"
          },
          credentials: "include",
          body: JSON.stringify(payload)
        }
      );

      if (handleUnauthorized(response)) return;

      let data = {};
      try {
        data = await response.json();
      } catch (_) {}

      if (!response.ok) {
        throw new Error(
          data.message || "배송 정보 저장에 실패했습니다."
        );
      }

      closeDeliveryModal();
      showMessage("배송 정보가 저장되었습니다.", "success");
      loadOrders(currentPage);
    } catch (error) {
      showModalMessage(
        error instanceof TypeError
          ? "서버에 연결할 수 없습니다."
          : error.message
      );
    } finally {
      modalSubmitButton.disabled = false;
      modalSubmitButton.textContent = "저장";
    }
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-order-detail-id]");
    if (!button || button.disabled) return;

    openDeliveryModal(button.dataset.orderDetailId);
  });

  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    loadOrders(0);
  });

  statusFilter.addEventListener("change", () => loadOrders(0));
  sortFilter.addEventListener("change", () => loadOrders(0));

  deliveryForm.addEventListener("submit", submitDelivery);
  modalCancelButton.addEventListener("click", closeDeliveryModal);

  deliveryModal.addEventListener("click", (event) => {
    if (event.target === deliveryModal) {
      closeDeliveryModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !deliveryModal.hidden) {
      closeDeliveryModal();
    }
  });

  loadOrders();
})();
