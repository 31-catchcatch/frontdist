(() => {
  "use strict";

  // 🔧 API 주소: Live Server(5500)에서 백엔드(8080)로 보내려면 절대경로 필요
  const API_URL = "http://localhost:8080/api/v1/seller/products";
  const PAGE_SIZE = 10;
  const FILE_PREVIEW_MODE = location.protocol === "file:";

  const tableBody = document.getElementById("productTableBody");
  const mobileList = document.getElementById("mobileProductList");
  const pagination = document.getElementById("pagination");
  const searchForm = document.getElementById("productSearchForm");
  const keywordInput = document.getElementById("productKeyword");
  const statusFilter = document.getElementById("statusFilter");
  const pageMessage = document.getElementById("pageMessage");

  const deleteModal = document.getElementById("deleteModal");
  const deleteProductName = document.getElementById("deleteProductName");
  const deleteCancelButton = document.getElementById("deleteCancelButton");
  const deleteConfirmButton = document.getElementById("deleteConfirmButton");

  const totalCount = document.getElementById("totalCount");
  const sellingCount = document.getElementById("sellingCount");
  const soldOutCount = document.getElementById("soldOutCount");
  const stoppedCount = document.getElementById("stoppedCount");

  let currentPage = 0;
  let totalPages = 1;
  let selectedProduct = null;

  // 🔧 토큰 꺼내기
  function getToken() {
    return localStorage.getItem("catchcatch.accessToken");
  }

  // 🔧 로그인 체크: 토큰만 있으면 통과 (loginType 요구 안 함)
  function isLoggedIn() {
    return Boolean(getToken());
  }

  function moveToSellerLogin() {
    location.replace(
      `login.html?type=seller&redirect=${encodeURIComponent("seller-products.html")}`
    );
  }

  function clearLoginState() {
    sessionStorage.removeItem("catchcatch.loggedIn");
    sessionStorage.removeItem("catchcatch.loginType");
    sessionStorage.removeItem("catchcatch.accessToken");
    localStorage.removeItem("catchcatch.accessToken");
  }

  if (!FILE_PREVIEW_MODE && !isLoggedIn()) {
    moveToSellerLogin();
    return;
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

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatPrice(value) {
    const price = Number(value);
    return Number.isFinite(price) ? `${price.toLocaleString("ko-KR")}원` : "-";
  }

  function formatDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric", month: "2-digit", day: "2-digit"
    }).format(date);
  }

  function normalizeStatus(rawStatus, stock, deleted) {
    // 🔧 백엔드에 status/stock이 없고 deleted만 있음
    if (deleted === true) {
      return { code: "STOPPED", label: "판매 중지", className: "status-stopped" };
    }
    const status = String(rawStatus || "").toUpperCase();
    if (["SELLING", "ON_SALE", "ACTIVE"].includes(status)) {
      return { code: "SELLING", label: "판매 중", className: "status-selling" };
    }
    if (status === "SOLD_OUT" || Number(stock) === 0) {
      // stock 정보가 없으면 기본 '판매 중'으로 처리
      if (rawStatus === undefined && stock === undefined) {
        return { code: "SELLING", label: "판매 중", className: "status-selling" };
      }
      return { code: "SOLD_OUT", label: "품절", className: "status-sold-out" };
    }
    return { code: "SELLING", label: "판매 중", className: "status-selling" };
  }

  function normalizeProduct(raw) {
    const productId = raw.productId ?? raw.id ?? raw.productNo ?? "";
    const stock = raw.stock ?? raw.stockQuantity ?? raw.quantity ?? undefined;

    return {
      productId,
      productName: raw.productName ?? raw.name ?? "상품명 없음",
      brandName: raw.brandName ?? raw.categoryName ?? raw.brand?.name ?? "",
      imageUrl: raw.thumbnailUrl ?? raw.imageUrl ?? raw.mainImageUrl ?? raw.images?.[0]?.url ?? "",
      price: raw.finalPrice ?? raw.salePrice ?? raw.discountPrice ?? raw.price ?? 0,
      stock: stock ?? "-",
      status: normalizeStatus(raw.status ?? raw.salesStatus, stock, raw.deleted),
      createdAt: raw.createdAt ?? raw.registeredAt ?? raw.createdDate ?? ""
    };
  }

  function extractPageData(data) {
    const body = data?.data ?? data ?? {};
    const rawItems =
      body.products ?? body.content ?? body.items ?? body.list ??
      (Array.isArray(body) ? body : []);
    const products = Array.isArray(rawItems) ? rawItems.map(normalizeProduct) : [];
    return {
      products,
      totalElements: Number(body.totalElements ?? body.totalCount ?? products.length),
      totalPages: Number(body.totalPages ?? 1),
      page: Number(body.number ?? body.page ?? currentPage)
    };
  }

  function statusBadge(status) {
    return `<span class="status-badge ${status.className}">${escapeHtml(status.label)}</span>`;
  }

  function renderDesktop(products) {
    if (!products.length) {
      tableBody.innerHTML = `<tr><td class="state-cell" colspan="7">조건에 맞는 상품이 없습니다.</td></tr>`;
      return;
    }
    tableBody.innerHTML = products.map((product) => `
      <tr>
        <td>
          <div class="product-info">
            ${product.imageUrl
              ? `<img class="product-thumb" src="${escapeHtml(product.imageUrl)}" alt="">`
              : `<div class="product-thumb" aria-hidden="true"></div>`}
            <div class="product-copy">
              <strong title="${escapeHtml(product.productName)}">${escapeHtml(product.productName)}</strong>
              <span>${escapeHtml(product.brandName || "정보 없음")}</span>
            </div>
          </div>
        </td>
        <td>${escapeHtml(product.productId)}</td>
        <td>${formatPrice(product.price)}</td>
        <td>${escapeHtml(product.stock)}</td>
        <td>${statusBadge(product.status)}</td>
        <td>${escapeHtml(formatDate(product.createdAt))}</td>
        <td>
          <div class="manage-buttons">
            <a href="seller-product-form.html?id=${encodeURIComponent(product.productId)}">수정</a>
            <button class="delete-button" type="button"
              data-delete-id="${escapeHtml(product.productId)}"
              data-delete-name="${escapeHtml(product.productName)}">삭제</button>
          </div>
        </td>
      </tr>
    `).join("");
  }

  function renderMobile(products) {
    if (!products.length) {
      mobileList.innerHTML = '<p class="mobile-state">조건에 맞는 상품이 없습니다.</p>';
      return;
    }
    mobileList.innerHTML = products.map((product) => `
      <article class="mobile-product-card">
        ${product.imageUrl
          ? `<img class="product-thumb" src="${escapeHtml(product.imageUrl)}" alt="">`
          : `<div class="product-thumb" aria-hidden="true"></div>`}
        <div class="mobile-card-body">
          <div class="mobile-card-head">
            <strong>${escapeHtml(product.productName)}</strong>
            ${statusBadge(product.status)}
          </div>
          <div class="mobile-meta">
            <span>상품번호</span><b>${escapeHtml(product.productId)}</b>
            <span>판매가</span><b>${formatPrice(product.price)}</b>
            <span>재고</span><b>${escapeHtml(product.stock)}</b>
          </div>
          <div class="manage-buttons">
            <a href="seller-product-form.html?id=${encodeURIComponent(product.productId)}">수정</a>
            <button class="delete-button" type="button"
              data-delete-id="${escapeHtml(product.productId)}"
              data-delete-name="${escapeHtml(product.productName)}">삭제</button>
          </div>
        </div>
      </article>
    `).join("");
  }

  function renderSummary(products, serverTotal) {
    const counts = { SELLING: 0, SOLD_OUT: 0, STOPPED: 0 };
    products.forEach((product) => { counts[product.status.code] += 1; });
    totalCount.textContent = Number(serverTotal || products.length).toLocaleString("ko-KR");
    sellingCount.textContent = counts.SELLING.toLocaleString("ko-KR");
    soldOutCount.textContent = counts.SOLD_OUT.toLocaleString("ko-KR");
    stoppedCount.textContent = counts.STOPPED.toLocaleString("ko-KR");
  }

  function renderPagination() {
    pagination.innerHTML = "";
    if (totalPages <= 1) return;
    const previous = document.createElement("button");
    previous.type = "button";
    previous.textContent = "‹";
    previous.disabled = currentPage === 0;
    previous.addEventListener("click", () => loadProducts(currentPage - 1));
    pagination.appendChild(previous);
    const start = Math.max(0, currentPage - 2);
    const end = Math.min(totalPages, start + 5);
    for (let page = start; page < end; page += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = String(page + 1);
      button.classList.toggle("on", page === currentPage);
      button.addEventListener("click", () => loadProducts(page));
      pagination.appendChild(button);
    }
    const next = document.createElement("button");
    next.type = "button";
    next.textContent = "›";
    next.disabled = currentPage >= totalPages - 1;
    next.addEventListener("click", () => loadProducts(currentPage + 1));
    pagination.appendChild(next);
  }

  async function loadProducts(page = 0) {
    clearMessage();
    tableBody.innerHTML = `<tr><td class="state-cell" colspan="7">상품 목록을 불러오는 중입니다.</td></tr>`;
    mobileList.innerHTML = '<p class="mobile-state">상품 목록을 불러오는 중입니다.</p>';

    const params = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) });
    const keyword = keywordInput.value.trim();
    const status = statusFilter.value;
    if (keyword) params.set("keyword", keyword);
    if (status) params.set("status", status);

    try {
      // 🔧 토큰 방식으로 요청
      const response = await fetch(`${API_URL}?${params.toString()}`, {
        method: "GET",
        headers: { "Authorization": "Bearer " + getToken() }
      });

      if (handleUnauthorized(response)) return;

      let data = {};
      try { data = await response.json(); } catch (_) {}

      if (!response.ok) {
        throw new Error(data.message || "상품 목록을 불러오지 못했습니다.");
      }

      console.log("받은 상품:", data);  // 확인용

      const pageData = extractPageData(data);
      currentPage = pageData.page;
      totalPages = Math.max(1, pageData.totalPages);

      renderDesktop(pageData.products);
      renderMobile(pageData.products);
      renderSummary(pageData.products, pageData.totalElements);
      renderPagination();
    } catch (error) {
      tableBody.innerHTML = `<tr><td class="state-cell" colspan="7">상품 목록을 불러오지 못했습니다.</td></tr>`;
      mobileList.innerHTML = '<p class="mobile-state">상품 목록을 불러오지 못했습니다.</p>';
      showMessage(
        error instanceof TypeError
          ? "서버에 연결할 수 없습니다. 백엔드 서버 상태를 확인해 주세요."
          : error.message
      );
    }
  }

  function openDeleteModal(productId, productName) {
    selectedProduct = { productId, productName };
    deleteProductName.textContent = productName || "선택한 상품";
    deleteModal.hidden = false;
    deleteConfirmButton.focus();
  }

  function closeDeleteModal() {
    selectedProduct = null;
    deleteModal.hidden = true;
  }

  async function deleteProduct() {
    if (!selectedProduct) return;
    deleteConfirmButton.disabled = true;
    deleteConfirmButton.textContent = "삭제 중...";

    try {
      // 🔧 토큰 방식으로 삭제
      const response = await fetch(
        `${API_URL}/${encodeURIComponent(selectedProduct.productId)}`,
        {
          method: "DELETE",
          headers: { "Authorization": "Bearer " + getToken() }
        }
      );

      if (handleUnauthorized(response)) return;

      let data = {};
      try { data = await response.json(); } catch (_) {}

      if (!response.ok) {
        throw new Error(data.message || "상품 삭제에 실패했습니다.");
      }

      closeDeleteModal();
      await loadProducts(currentPage);
      showMessage("상품이 삭제되었습니다.", "success");
    } catch (error) {
      closeDeleteModal();
      showMessage(
        error instanceof TypeError
          ? "서버에 연결할 수 없습니다. 백엔드 서버 상태를 확인해 주세요."
          : error.message
      );
    } finally {
      deleteConfirmButton.disabled = false;
      deleteConfirmButton.textContent = "삭제";
    }
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-delete-id]");
    if (!button) return;
    openDeleteModal(button.dataset.deleteId, button.dataset.deleteName);
  });

  deleteCancelButton.addEventListener("click", closeDeleteModal);
  deleteConfirmButton.addEventListener("click", deleteProduct);
  deleteModal.addEventListener("click", (event) => {
    if (event.target === deleteModal) closeDeleteModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !deleteModal.hidden) closeDeleteModal();
  });
  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    loadProducts(0);
  });
  statusFilter.addEventListener("change", () => loadProducts(0));

  loadProducts();
})();